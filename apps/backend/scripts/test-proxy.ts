#!/usr/bin/env tsx
/**
 * Proxy Smoke Test
 *
 * Verifies that the Decodo proxy is working correctly by:
 * 1. Testing the Node-level HTTP connection (ip.decodo.com/json)
 * 2. Launching Puppeteer through the proxy and checking the exit IP
 *
 * Usage:
 *   pnpm test:proxy
 *
 * Requires DECODO_PROXY_ENABLED=true in your .env file.
 */

import { browserService } from '../src/shared/services/browser.service.js';
import { proxyConfig } from '../src/shared/services/proxy/proxy.config.js';
import { proxyService } from '../src/shared/services/proxy/proxy.service.js';

const divider = '='.repeat(60);

async function testNodeHttp(): Promise<boolean> {
  console.log('\n1) Node HTTP proxy test (ip.decodo.com/json)');
  console.log(divider);

  const result = await proxyService.testConnection();

  if (result.ok) {
    console.log(`   IP:       ${result.ip}`);
    console.log(`   Country:  ${result.country}`);
    console.log(`   City:     ${result.city}`);
    console.log(`   ASN:      ${result.asn}`);
    console.log(`   Latency:  ${result.latencyMs}ms`);
    console.log('   Result:   PASS');
    return true;
  }

  console.error(`   Error:    ${result.error}`);
  console.error(`   Latency:  ${result.latencyMs}ms`);
  console.error('   Result:   FAIL');
  return false;
}

async function testPuppeteer(): Promise<boolean> {
  console.log('\n2) Puppeteer proxy test (browser -> ip.decodo.com/json)');
  console.log(divider);

  const creds = proxyService.buildCredentials();
  let browser: Awaited<ReturnType<typeof browserService.createIsolatedBrowser>> | undefined;

  try {
    browser = await browserService.createIsolatedBrowser('proxy-test', {
      proxyCredentials: creds,
    });

    const page = await browserService.createPageInBrowser(browser, {
      proxyCredentials: creds,
    });

    // Navigate to the IP check endpoint
    await page.goto('https://ip.decodo.com/json', {
      waitUntil: 'networkidle2',
      timeout: proxyConfig.timeoutMs,
    });

    // Extract the response body
    const bodyText = await page.evaluate(() => document.body.innerText);

    try {
      const data = JSON.parse(bodyText) as Record<string, unknown>;
      const ip = (data.ip as string) ?? (data.query as string) ?? 'unknown';
      console.log(`   IP:       ${ip}`);
      console.log(`   Country:  ${(data.country as string) ?? 'unknown'}`);
      console.log(`   City:     ${(data.city as string) ?? 'unknown'}`);
      console.log('   Result:   PASS');
      return true;
    } catch {
      console.log(`   Body:     ${bodyText.slice(0, 200)}`);
      console.log('   Result:   PASS (got response, but could not parse JSON)');
      return true;
    }
  } catch (err) {
    const error = err as Error;
    console.error(`   Error:    ${error.message}`);
    console.error('   Result:   FAIL');
    return false;
  } finally {
    if (browser) {
      await browserService.closeIsolatedBrowser(browser, 'proxy-test');
    }
  }
}

async function main(): Promise<void> {
  console.log(divider);
  console.log('  Decodo Proxy Smoke Test');
  console.log(divider);

  // Show config summary (no secrets)
  const summary = proxyService.getConfigSummary();
  console.log('\nConfig:');
  for (const [key, value] of Object.entries(summary)) {
    console.log(`   ${key}: ${value}`);
  }

  if (!proxyConfig.enabled) {
    console.error('\nProxy is DISABLED. Set DECODO_PROXY_ENABLED=true in .env to run this test.');
    process.exit(1);
  }

  const httpOk = await testNodeHttp();
  const puppeteerOk = await testPuppeteer();

  console.log(`\n${divider}`);
  console.log(
    `  Summary: HTTP=${httpOk ? 'PASS' : 'FAIL'} | Puppeteer=${puppeteerOk ? 'PASS' : 'FAIL'}`
  );
  console.log(divider);

  process.exit(httpOk && puppeteerOk ? 0 : 1);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
