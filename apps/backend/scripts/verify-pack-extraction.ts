/**
 * Fixture-based smoke test for the per-supplier pack extractors.
 *
 * Run: pnpm tsx scripts/verify-pack-extraction.ts
 *
 * Reads each supplier's listing fixture from
 *   src/features/suppliers/<supplier>/listing.{html,json}
 * runs the matching extractor on every product card, then:
 *   1. Prints coverage stats per supplier.
 *   2. Prints the first 5 extracted rows.
 *   3. Hard-asserts known-good anchor values. Exits non-zero on mismatch.
 *
 * Anchors are the ground truth checks — if an extractor regresses, CI can
 * wire this script in once a formal runner is adopted.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

import { extractBarryPackData } from '../src/features/suppliers/barry-group/barry-group.pack-extractor.js';
import { extractMusgravePackData } from '../src/features/suppliers/musgrave/musgrave.pack-extractor.js';
import { extractOreillysPackData } from '../src/features/suppliers/oreillys/oreillys.pack-extractor.js';
import { extractSWPackData } from '../src/features/suppliers/savage-whitten/savage-whitten.pack-extractor.js';
import type { PackData } from '../src/shared/services/pack-parser/index.js';
import type { MusgraveApiProduct } from '../src/features/suppliers/musgrave/musgrave.types.js';

// ANSI colors — tiny, no dependency.
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SUPPLIERS_DIR = join(__dirname, '..', 'src', 'features', 'suppliers');

// ---------------------------------------------------------------------------
// Anchor assertions: ground-truth values picked from the fixtures. Tight
// enough to catch regressions, loose enough to survive fixture reshuffling.
// ---------------------------------------------------------------------------

interface Anchor {
  /** Lookup key: whatever identifies one card in the fixture (sku / code). */
  id: string;
  expect: Partial<PackData>;
}

const MUSGRAVE_ANCHORS: Anchor[] = [
  { id: '798827', expect: { unitCostInclVat: 3.6, packCount: 10, packUnitSize: '10 x 10 Pack' } },
  { id: '272472', expect: { unitCostInclVat: 4.17, packCount: 6, packUnitSize: '6 x 250 g' } },
  { id: '639431', expect: { unitCostInclVat: 2.06, packCount: 6, packUnitSize: '6 x (40 x 125 g)' } },
];

const BARRY_ANCHORS: Anchor[] = [
  { id: '2400023', expect: { unitCostInclVat: 1.54, packCount: 12, packUnitSize: '1.25l' } },
];

// 102104 = first S&W card in the fixture (Punjana Teabags).
const SW_ANCHORS: Anchor[] = [
  { id: '102104', expect: { unitCostInclVat: 1.8, packCount: 12 } },
];

const OREILLYS_ANCHORS: Anchor[] = [
  // 048235 = first fixture card (Applied Nutrition Protein Chips).
  // Note: unit-cost only — O'Reillys pack line may or may not be present.
  { id: '048235', expect: { unitCostInclVat: 1.57 } },
];

// ---------------------------------------------------------------------------
// Per-supplier runners. Each returns (sku → PackData) + the count of cards
// attempted.
// ---------------------------------------------------------------------------

interface RunResult {
  supplier: string;
  rows: Map<string, PackData>;
  cardCount: number;
}

function runMusgrave(): RunResult {
  const path = join(SUPPLIERS_DIR, 'musgrave', 'listing.json');
  const data = JSON.parse(readFileSync(path, 'utf8')) as { elements: MusgraveApiProduct[] };

  const rows = new Map<string, PackData>();
  for (const product of data.elements) {
    const sku =
      (product.attributes?.find((a) => a.name === 'sku')?.value as string | undefined) ?? '?';
    rows.set(sku, extractMusgravePackData(product));
  }
  return { supplier: 'Musgrave', rows, cardCount: data.elements.length };
}

function runBarry(): RunResult {
  const path = join(SUPPLIERS_DIR, 'barry-group', 'listing.html');
  const html = readFileSync(path, 'utf8');
  const $ = cheerio.load(html);

  // Fixture is the gridlist view (.GridCell cards). UCIV + pack data are only
  // exposed here — list.asp returns a flatter table without them, which is
  // why we'll switch the scraper to gridlist.asp alongside this change.
  const rows = new Map<string, PackData>();
  let count = 0;
  $('div.GridCell').each((_, el) => {
    count++;
    const card = $(el);
    const code = (card.find('input[name="product_code"]').val() as string) ?? String(count);
    rows.set(code, extractBarryPackData($, card));
  });
  return { supplier: 'Barry Group', rows, cardCount: count };
}

function runSW(): RunResult {
  const path = join(SUPPLIERS_DIR, 'savage-whitten', 'listing.html');
  const html = readFileSync(path, 'utf8');
  const $ = cheerio.load(html);

  const rows = new Map<string, PackData>();
  let count = 0;
  $('#js-resultsContainer form.c-product-item-card').each((_, el) => {
    count++;
    const card = $(el);
    const code = (card.find('input[name="productCode"]').val() as string) ?? String(count);
    rows.set(code, extractSWPackData($, card));
  });
  return { supplier: 'Savage & Whitten', rows, cardCount: count };
}

function runOreillys(): RunResult {
  const path = join(SUPPLIERS_DIR, 'oreillys', 'listing.html');
  const html = readFileSync(path, 'utf8');
  const $ = cheerio.load(html);

  const rows = new Map<string, PackData>();
  let count = 0;
  $('table.ProductBox').each((_, el) => {
    count++;
    const card = $(el);
    const code = (card.find('input[name="product_code"]').val() as string) ?? String(count);
    rows.set(code, extractOreillysPackData($, card));
  });
  return { supplier: "O'Reillys", rows, cardCount: count };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function printReport(result: RunResult): void {
  const { supplier, rows, cardCount } = result;
  const values = Array.from(rows.values());
  const withCost = values.filter((p) => p.unitCostInclVat !== null).length;
  const withCount = values.filter((p) => p.packCount !== null).length;
  const withSize = values.filter((p) => p.packUnitSize !== null).length;

  const fmt = (n: number) =>
    cardCount === 0 ? '—' : `${n}/${cardCount} (${Math.round((n / cardCount) * 100)}%)`;

  console.log(`\n${supplier}`);
  console.log(`  cards parsed:     ${cardCount}`);
  console.log(`  unit cost found:  ${fmt(withCost)}`);
  console.log(`  pack count found: ${fmt(withCount)}`);
  console.log(`  unit size found:  ${fmt(withSize)}`);

  // First 5 rows preview.
  console.log(`  ${DIM}first 5:${RESET}`);
  const preview = Array.from(rows.entries()).slice(0, 5);
  for (const [id, p] of preview) {
    const costStr = p.unitCostInclVat !== null ? `€${p.unitCostInclVat.toFixed(2)}` : '—';
    const countStr = p.packCount !== null ? String(p.packCount) : '—';
    const sizeStr = p.packUnitSize ?? '—';
    console.log(`    ${DIM}${id.padEnd(10)}${RESET} cost=${costStr.padEnd(7)} × ${countStr.padEnd(4)} ${sizeStr}`);
  }
}

/** Compare actual PackData against anchor expected values. */
function checkAnchors(result: RunResult, anchors: Anchor[]): string[] {
  const failures: string[] = [];
  for (const { id, expect } of anchors) {
    const actual = result.rows.get(id);
    if (!actual) {
      failures.push(`${result.supplier}[${id}]: card not found in fixture`);
      continue;
    }
    for (const key of Object.keys(expect) as (keyof PackData)[]) {
      const expected = expect[key];
      const got = actual[key];
      if (expected !== got) {
        failures.push(
          `${result.supplier}[${id}].${key}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`
        );
      }
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): number {
  console.log(`${DIM}Running pack extractor smoke tests against repo fixtures...${RESET}`);

  const runners: Array<() => { result: RunResult; anchors: Anchor[] }> = [
    () => ({ result: runMusgrave(), anchors: MUSGRAVE_ANCHORS }),
    () => ({ result: runBarry(), anchors: BARRY_ANCHORS }),
    () => ({ result: runSW(), anchors: SW_ANCHORS }),
    () => ({ result: runOreillys(), anchors: OREILLYS_ANCHORS }),
  ];

  const allFailures: string[] = [];
  for (const run of runners) {
    try {
      const { result, anchors } = run();
      printReport(result);
      allFailures.push(...checkAnchors(result, anchors));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      allFailures.push(`runner threw: ${msg}`);
    }
  }

  console.log();
  if (allFailures.length === 0) {
    console.log(`${GREEN}✓ all anchors passed${RESET}`);
    return 0;
  }
  console.log(`${RED}✗ ${allFailures.length} anchor failure(s):${RESET}`);
  for (const f of allFailures) console.log(`  ${YELLOW}· ${f}${RESET}`);
  return 1;
}

process.exit(main());
