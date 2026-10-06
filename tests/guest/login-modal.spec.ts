import { test, expect } from '../fixtures';
import { ChatPage } from '../../pages/ChatPage';
import { LoginModal } from '../../pages/LoginModal';

test.describe('Giriş penceresi (misafir)', () => {
  test('WEB-02 | Misafir mesaj gönderince giriş penceresi açılır ve yazılan metin korunur @smoke', async ({ page }) => {
    const chat = new ChatPage(page);
    const login = new LoginModal(page);
    const message = "Türkiye'nin başkenti neresi?";

    await chat.open();
    await chat.sendMessage(message);
    await login.expectOpen();

    await login.closeWithEscape();
    await login.expectPageInteractive();
    expect(await chat.inputText()).toBe(message);
  });

  test('WEB-03 | Giriş seçenekleri listelenir', async ({ page }) => {
    const chat = new ChatPage(page);
    const login = new LoginModal(page);

    await chat.open();
    await chat.loginButton.click();
    await login.expectOpen();

    for (const provider of ['Google', 'Facebook', 'Apple', 'Microsoft', 'Email'] as const) {
      await expect(login.providerButton(provider)).toBeVisible();
    }
    await expect(login.emailInput).toBeVisible();
    await expect(login.dialog.getByRole('link', { name: 'Terms of Use' })).toBeVisible();
    await expect(login.dialog.getByRole('link', { name: 'Privacy Policy' })).toBeVisible();
  });

  test('EC-21 | Dil değiştirilince yazılan metin kaybolmaz', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.open();
    await chat.typeMessage('Kaybolmaması gereken metin');

    await chat.selectFooterLanguage('German', /\/de\/?$/);
    expect(await chat.inputText()).toBe('Kaybolmaması gereken metin');
  });
});
