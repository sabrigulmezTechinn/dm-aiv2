import { expect, test } from '@playwright/test';
import { createCharacter, openHome, sendMessage, startCampaign, tid, T, type Lang } from './helpers';

const langs: Lang[] = ['en', 'tr'];
const viewports = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };

for (const lang of langs) {
  for (const [vpName, viewport] of Object.entries(viewports)) {
    test.describe(`${lang} / ${vpName}`, () => {
      test.use({ viewport, locale: lang === 'tr' ? 'tr-TR' : 'en-US' });
      test.describe.configure({ mode: 'serial' });

      test('full flow: home, character, campaign, play, sheet, settings', async ({ page }) => {
        await test.step('home screen', async () => {
          await openHome(page, lang);
          await expect(page.getByText(T[lang].noCampaigns)).toBeVisible();
          await expect(tid(page, 'new-adventure')).toContainText(T[lang].newAdventure);
        });

        await test.step('create a character', async () => {
          await createCharacter(page, `Tester ${lang} ${vpName}`);
        });

        await test.step('start a campaign', async () => {
          await startCampaign(page);
        });

        await test.step('play a few turns', async () => {
          const before = await page.locator('body').innerText();
          await sendMessage(page, 'I look around carefully');
          await sendMessage(page, 'I move on');
          const after = await page.locator('body').innerText();
          expect(after.length).toBeGreaterThan(before.length);
          // DM replied: the message is no longer the last thing in the log.
          expect(after.split('I move on').pop()!.trim().length).toBeGreaterThan(0);
        });

        await test.step('character sheet', async () => {
          await tid(page, 'open-sheet').click();
          await expect(page.getByText(`Tester ${lang} ${vpName}`).first()).toBeVisible();
          await expect(page.getByText(T[lang].sheet, { exact: true }).locator('visible=true').first()).toBeVisible();
        });
      });

      test('settings language switch', async ({ page }) => {
        await openHome(page, lang);
        const other: Lang = lang === 'en' ? 'tr' : 'en';
        await tid(page, 'settings').click();
        await expect(page.getByText(T[lang].interfaceLanguage)).toBeVisible();
        await tid(page, `lang-${other}`).click();
        await expect(page.getByText(T[other].interfaceLanguage)).toBeVisible();
        await tid(page, `lang-${lang}`).click();
        await expect(page.getByText(T[lang].interfaceLanguage)).toBeVisible();
      });
    });
  }
}
