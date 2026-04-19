import type { ElementHandle, Page } from 'puppeteer';

/**
 * Utility function to generate random number between min and max (inclusive).
 */
export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Configuration for bezier curve mouse movement.
 */
export interface BezierConfig {
  steps: number;
  minSpeed: number;
  maxSpeed: number;
}

/**
 * Default bezier curve configuration.
 */
export const DEFAULT_BEZIER_CONFIG: BezierConfig = {
  steps: 25,
  minSpeed: 50,
  maxSpeed: 150,
};

/**
 * Generates points along a bezier curve for natural mouse movement.
 * Real humans don't move mice in straight lines!
 */
export function generateBezierCurve(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  steps: number
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];

  // Create two random control points for the curve
  const cp1x = startX + (endX - startX) * 0.25 + randomBetween(-50, 50);
  const cp1y = startY + (endY - startY) * 0.25 + randomBetween(-50, 50);
  const cp2x = startX + (endX - startX) * 0.75 + randomBetween(-50, 50);
  const cp2y = startY + (endY - startY) * 0.75 + randomBetween(-50, 50);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;

    // Cubic bezier formula
    const x =
      (1 - t) ** 3 * startX +
      3 * (1 - t) ** 2 * t * cp1x +
      3 * (1 - t) * t ** 2 * cp2x +
      t ** 3 * endX;

    const y =
      (1 - t) ** 3 * startY +
      3 * (1 - t) ** 2 * t * cp1y +
      3 * (1 - t) * t ** 2 * cp2y +
      t ** 3 * endY;

    points.push({ x: Math.round(x), y: Math.round(y) });
  }

  return points;
}

/**
 * Move mouse to element with human-like bezier curve movement.
 */
export async function mouseMoveToElement(
  page: Page,
  element: ElementHandle<Element>,
  config: BezierConfig = DEFAULT_BEZIER_CONFIG
): Promise<void> {
  // Get current mouse position (or start from random position)
  const currentPosition = await page.evaluate(() => ({
    x: (window as unknown as { mouseX?: number }).mouseX || Math.random() * 500,
    y: (window as unknown as { mouseY?: number }).mouseY || Math.random() * 300,
  }));

  const box = await element.boundingBox();
  if (!box) return;

  // Target a random point within the element
  const targetX = box.x + randomBetween(5, Math.max(10, box.width - 5));
  const targetY = box.y + randomBetween(5, Math.max(10, box.height - 5));

  // Generate curved path using bezier
  const points = generateBezierCurve(
    currentPosition.x,
    currentPosition.y,
    targetX,
    targetY,
    config.steps
  );

  // Move through each point with variable speed
  for (const point of points) {
    await page.mouse.move(point.x, point.y);
    await new Promise((resolve) =>
      setTimeout(resolve, randomBetween(config.minSpeed, config.maxSpeed))
    );
  }

  // Store current position for next movement
  await page.evaluate(
    (x, y) => {
      (window as unknown as { mouseX: number; mouseY: number }).mouseX = x;
      (window as unknown as { mouseY: number }).mouseY = y;
    },
    targetX,
    targetY
  );
}
