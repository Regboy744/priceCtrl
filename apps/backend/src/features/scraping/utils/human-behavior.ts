import type { ElementHandle, Page } from 'puppeteer';
import {
  type BezierConfig,
  DEFAULT_BEZIER_CONFIG,
  mouseMoveToElement,
  randomBetween,
} from './bezier.js';

// Re-export randomBetween for convenience
export { randomBetween };

/**
 * Configuration for human-like typing behavior.
 */
export interface TypingConfig {
  minDelay: number;
  maxDelay: number;
  mistakeChance: number;
}

/**
 * Default typing configuration.
 */
export const DEFAULT_TYPING_CONFIG: TypingConfig = {
  minDelay: 50,
  maxDelay: 150,
  mistakeChance: 0.02,
};

/**
 * Combined human behavior configuration.
 */
export interface HumanBehaviorConfig {
  mouse: BezierConfig;
  typing: TypingConfig;
}

/**
 * Default human behavior configuration.
 */
export const DEFAULT_HUMAN_CONFIG: HumanBehaviorConfig = {
  mouse: DEFAULT_BEZIER_CONFIG,
  typing: DEFAULT_TYPING_CONFIG,
};

/**
 * Human-like delay between actions.
 */
export async function humanDelay(minMs = 500, maxMs = 2000): Promise<void> {
  const delay = randomBetween(minMs, maxMs);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Random micro-movements to simulate natural mouse behavior.
 */
export async function microMovements(page: Page): Promise<void> {
  const movements = randomBetween(2, 5);

  for (let i = 0; i < movements; i++) {
    const currentPos = await page.evaluate(() => ({
      x: (window as unknown as { mouseX?: number }).mouseX || 500,
      y: (window as unknown as { mouseY?: number }).mouseY || 300,
    }));

    const newX = currentPos.x + randomBetween(-20, 20);
    const newY = currentPos.y + randomBetween(-20, 20);

    await page.mouse.move(newX, newY);
    await new Promise((resolve) => setTimeout(resolve, randomBetween(100, 300)));
  }
}

/**
 * Click element with human-like behavior.
 */
export async function clickElement(
  page: Page,
  element: ElementHandle<Element>,
  config: BezierConfig = DEFAULT_BEZIER_CONFIG
): Promise<void> {
  await mouseMoveToElement(page, element, config);
  await humanDelay(50, 200);
  await element.click();
  await humanDelay(100, 300);
}

/**
 * Type text into element with human-like behavior.
 */
export async function typeInElement(
  page: Page,
  element: ElementHandle<Element>,
  text: string,
  config: HumanBehaviorConfig = DEFAULT_HUMAN_CONFIG
): Promise<void> {
  await mouseMoveToElement(page, element, config.mouse);
  await humanDelay(100, 300);
  await element.click();
  await humanDelay(200, 400);

  const { minDelay, maxDelay, mistakeChance } = config.typing;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Random chance of making a typo (makes it look more human)
    if (Math.random() < mistakeChance && i > 0) {
      const wrongChar = String.fromCharCode(char.charCodeAt(0) + randomBetween(-1, 1));
      await page.keyboard.type(wrongChar);
      await humanDelay(100, 300);
      await page.keyboard.press('Backspace');
      await humanDelay(50, 150);
    }

    // Type the correct character
    await page.keyboard.type(char);

    // Variable delay between keystrokes
    let typeDelay = randomBetween(minDelay, maxDelay);

    // Pause longer after special characters
    if (char === ' ' || char === '@' || char === '.') {
      typeDelay += randomBetween(50, 150);
    }

    await new Promise((resolve) => setTimeout(resolve, typeDelay));
  }
}

/**
 * Clear input field and fill with new value using human-like behavior.
 * Uses Ctrl+A -> Backspace to clear, which is more reliable than triple-click.
 */
export async function clearAndFillInput(
  page: Page,
  element: ElementHandle<Element>,
  value: string,
  config: HumanBehaviorConfig = DEFAULT_HUMAN_CONFIG
): Promise<void> {
  // Random pause before interacting
  await humanDelay(300, 800);

  // Move to element
  await mouseMoveToElement(page, element, config.mouse);
  await humanDelay(50, 150);

  // Click to focus
  await element.click();
  await humanDelay(100, 200);

  // Select all and delete (Ctrl+A, Backspace)
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  await humanDelay(50, 100);
  await page.keyboard.press('Backspace');
  await humanDelay(200, 400);

  // Type with human-like behavior
  await typeInElement(page, element, value, config);
}

/**
 * Wait for page to be fully loaded and ready for interaction.
 */
export async function waitForPageReady(page: Page, timeout = 10000): Promise<void> {
  await page.waitForFunction(() => document.readyState === 'complete', { timeout });
  await humanDelay(200, 500);
  await microMovements(page);
}
