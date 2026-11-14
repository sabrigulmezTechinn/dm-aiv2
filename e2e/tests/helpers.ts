import { expect, type Page } from '@playwright/test';

export type Lang = 'en' | 'tr';

/** Strings from apps/mobile/src/lib/i18n.tsx used for assertions. */
export const T = {
  en: { newAdventure: 'New adventure', settings: 'Settings', noCampaigns: 'No adventures yet', sheet: 'Character', interfaceLanguage: 'Interface language' },
  tr: { newAdventure: 'Yeni macera', settings: 'Ayarlar', noCampaigns: 'Henüz bir maceran yok', sheet: 'Karakter', interfaceLanguage: 'Arayüz dili' },
} as const;

export const tid = (page: Page, id: string) => page.getByTestId(id);

export async function openHome(page: Page, lang: Lang) {
  await page.goto('/');
  // Force the interface language through the settings screen (the app persists it).
  await tid(page, 'settings').click();
  await tid(page, `lang-${lang}`).click();
  await page.goBack();
  await expect(tid(page, 'new-adventure')).toBeVisible();
}

export async function createCharacter(page: Page, name: string) {
  await tid(page, 'characters').click();
  await tid(page, 'create-character').click();
  await tid(page, 'name-input').fill(name);
  for (let i = 0; i < 12; i++) {
    const create = tid(page, 'create');
    if (await create.isVisible()) {
      if (await create.isEnabled()) break;
    }
    const next = tid(page, 'next');
    if ((await next.count()) && (await next.isEnabled())) {
      await next.click();
      continue;
    }
    // Skills step: pick skills until "next" becomes enabled.
    const skills = page.locator('[data-testid^="skill-"]');
    const n = await skills.count();
    for (let k = 0; k < n && !(await next.isEnabled()); k++) await skills.nth(k).click();
  }
  await expect(tid(page, 'create')).toBeEnabled();
  await tid(page, 'create').click();
  await expect(page.getByText(name).first()).toBeVisible();
}

export async function startCampaign(page: Page) {
  await page.goto('/');
  await tid(page, 'new-adventure').click();
  await page.locator('[data-testid^="adventure-"]').first().click();
  await tid(page, 'start').click();
  await expect(tid(page, 'action-input').or(tid(page, 'continue')).first()).toBeVisible({ timeout: 30_000 });
  await settle(page);
}

/** Sends a free-text action and waits until the DM reply has settled. */
export async function sendMessage(page: Page, text: string) {
  const input = tid(page, 'action-input');
  await input.fill(text);
  await tid(page, 'send').click();
  await expect(page.getByText(text).first()).toBeVisible();
  await settle(page);
}

/** Resolves pending rolls / "continue" prompts until the free-text input is usable again. */
export async function settle(page: Page) {
  const input = tid(page, 'action-input');
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) {
    if ((await input.count()) && (await input.isEnabled())) return;
    for (const id of ['roll', 'continue']) {
      const b = tid(page, id);
      if ((await b.count()) && (await b.first().isVisible()) && (await b.first().isEnabled())) {
        await b.first().click();
        break;
      }
    }
    await page.waitForTimeout(250);
  }
  await expect(input).toBeEnabled({ timeout: 1000 });
}
