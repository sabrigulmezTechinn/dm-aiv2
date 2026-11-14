import { expect, test } from '@playwright/test';
import { createCharacter, openHome, startCampaign, tid } from './helpers';

// Regression check for plan item 1: the Send button must stay on screen and the page must not scroll sideways.
const widths = [320, 360, 375, 390, 414];

test.describe('phone widths', () => {
  test.use({ viewport: { width: 390, height: 844 }, locale: 'tr-TR' });

  for (const width of widths) {
    test(`play screen fits at ${width}px`, async ({ page }) => {
      await openHome(page, 'tr');
      await createCharacter(page, `Width ${width}`);
      await startCampaign(page);
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(300);

      const m = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
      const box = await tid(page, 'send').boundingBox();
      expect(box, 'Send button has a box').not.toBeNull();
      const right = box!.x + box!.width;
      expect.soft(m.scrollWidth, `scrollWidth ${m.scrollWidth} > innerWidth ${m.innerWidth} at ${width}px`).toBeLessThanOrEqual(m.innerWidth);
      expect.soft(box!.x, `Send left edge at ${width}px`).toBeGreaterThanOrEqual(0);
      expect.soft(right, `Send right edge ${right} > ${m.innerWidth} at ${width}px`).toBeLessThanOrEqual(m.innerWidth);
    });
  }
});
