import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Mirrors the 60rem breakpoint in ActiveGame.module.css at the browsers' 16px root size.
export const TWO_COLUMN_MIN_WIDTH_PX = 960;

// Layout rounds to fractions of a pixel, and a border can sit half a pixel past its box.
const SUBPIXEL_TOLERANCE_PX = 0.5;

export const expectNoHorizontalOverflow = async ({ page }: { page: Page }) => {
  const fitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );

  expect(fitsViewport).toBe(true);
};

const boxOf = async ({ locator }: { locator: Locator }) => {
  const box = await locator.boundingBox();

  expect(box, 'the panel is laid out').not.toBeNull();

  return box as NonNullable<typeof box>;
};

// The page-level check above only fires once content also crosses the viewport edge. A card can
// push its children into its own padding long before that, and a narrower browser then clips them.
export const expectContentWithinCard = async ({ card }: { card: Locator }) => {
  const spillingElements = await card.evaluate((cardElement, tolerance) => {
    const cardStyle = getComputedStyle(cardElement);
    const contentRight =
      cardElement.getBoundingClientRect().right -
      parseFloat(cardStyle.paddingRight) -
      parseFloat(cardStyle.borderRightWidth);

    return [...cardElement.querySelectorAll('*')]
      .map((element) => ({
        name: element.tagName.toLowerCase(),
        right: element.getBoundingClientRect().right,
      }))
      .filter(({ right }) => right > contentRight + tolerance)
      .map(({ name, right }) => `${name} ends at ${right}, past ${contentRight}`);
  }, SUBPIXEL_TOLERANCE_PX);

  expect(spillingElements, 'elements spilling out of the card content box').toEqual([]);
};

// Blocks stacked in one column that differ in width read as three different layouts.
export const expectSameWidth = async ({ locators }: { locators: Locator[] }) => {
  const boxes = await Promise.all(locators.map((locator) => boxOf({ locator })));
  const [firstBox] = boxes;

  for (const { width } of boxes) {
    expect(width).toBeCloseTo((firstBox as NonNullable<typeof firstBox>).width, 0);
  }
};

// A single-column page at phone and tablet widths, two columns from the breakpoint up.
export const expectBoardLayoutForWidth = async ({
  page,
  board,
  shop,
}: {
  page: Page;
  board: Locator;
  shop: Locator;
}) => {
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  const boardBox = await boxOf({ locator: board });
  const shopBox = await boxOf({ locator: shop });

  if (viewportWidth >= TWO_COLUMN_MIN_WIDTH_PX) {
    expect(shopBox.x).toBeGreaterThanOrEqual(boardBox.x + boardBox.width);
    expect(shopBox.y).toBeLessThan(boardBox.y + boardBox.height);

    return;
  }

  expect(shopBox.y).toBeGreaterThanOrEqual(boardBox.y + boardBox.height);
  expect(shopBox.x).toBeLessThan(boardBox.x + boardBox.width);
};
