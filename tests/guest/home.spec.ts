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
});
