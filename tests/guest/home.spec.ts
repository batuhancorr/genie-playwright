import { test, expect } from '../fixtures';
import { ChatPage } from '../../pages/ChatPage';

test.describe('Ana sayfa (misafir)', () => {
  test('WEB-01 | Ana sayfa temel bileşenleriyle yüklenir @smoke', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.open();

    await expect(page.getByRole('heading', { name: /Welcome to chatbotai\.com/ })).toBeVisible();
    await expect(chat.input).toBeEditable();
    await expect(chat.loginButton).toBeVisible();
    await expect(chat.modelTrigger).toContainText('Auto');

    for (const [name, href] of [
      ['Terms of Service', '/terms'],
      ['Privacy Policy', '/privacy'],
      ['Refund Policy', '/refund'],
    ] as const) {
      await expect(page.getByRole('link', { name }).first()).toHaveAttribute('href', href);
    }
  });

  test('BUG-W04 | Footer\'daki destek saati "24/7/365" olmalı', async ({ page }) => {
    test.info().annotations.push({ type: 'issue', description: 'BUG-W04: footer "24/07/365" yazıyor' });
    test.fail(true, 'Bilinen bug: BUG-W04 düzeltilince bu test PASS olacak ve işaret kaldırılmalı');

    await new ChatPage(page).open();
    await expect(page.locator('footer, [role=contentinfo]').first()).toContainText('24/7/365', { timeout: 5_000 });
  });

  test('BUG-W05 | İkon butonlarının erişilebilir adı olmalı', async ({ page }) => {
    test.info().annotations.push({ type: 'issue', description: 'BUG-W05: ikon butonlarda aria-label yok' });
    test.fail(true, 'Bilinen bug: BUG-W05');

    await new ChatPage(page).open();
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .filter((b) => (b as HTMLElement).offsetParent !== null)
        .filter((b) => !(b.innerText.trim() || b.getAttribute('aria-label') || b.getAttribute('title')))
        .map((b) => b.id || b.outerHTML.slice(0, 60)),
    );
    expect(unnamed, `Erisilebilir adi olmayan butonlar: ${unnamed.join(', ')}`).toEqual([]);
  });
});
