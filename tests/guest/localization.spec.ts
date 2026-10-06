import { test, expect } from '../fixtures';
import { ChatPage } from '../../pages/ChatPage';

test.describe('Dil seçimi (misafir)', () => {
  test('WEB-27 | Footer\'daki dil seçiciyle Almancaya geçilir', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.open();

    await page.getByRole('combobox').filter({ hasText: 'English' }).click();
    const languages = await page.getByRole('option').allInnerTexts();
    expect(languages).toEqual(expect.arrayContaining(['English', 'German', 'Spanish', 'French']));

    await page.keyboard.press('Escape');
    await chat.selectFooterLanguage('German', /\/de\/?$/);
    await expect(page.getByRole('heading', { name: /Willkommen bei chatbotai\.com/ })).toBeVisible();
    await expect(chat.loginButton.or(page.getByRole('button', { name: 'Anmelden' }).first())).toBeVisible();
  });

  test('UX-17 | Web dil listesinde Türkçe bulunmalı', async ({ page }) => {
    test.info().annotations.push({ type: 'issue', description: 'UX-17: web dil seçicisinde Türkçe yok' });
    test.fail(true, 'Bilinen eksik: UX-17');

    await new ChatPage(page).open();
    await page.getByRole('combobox').filter({ hasText: 'English' }).click();
    const languages = await page.getByRole('option').allInnerTexts();
    expect(languages.some((l) => /Türkçe|Turkish/.test(l))).toBe(true);
  });
});
