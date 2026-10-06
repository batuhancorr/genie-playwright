import { authTest as test, expect } from '../fixtures';
import { ChatPage } from '../../pages/ChatPage';
import { Paywall } from '../../pages/Paywall';

test.describe('Model seçimi (giriş yapılmış, Free)', () => {

  test.afterEach(async ({ page }) => {
    // Secilen model hesapta kalici oldugu icin sonraki testleri etkilemesin diye Auto'ya donulur.
    const chat = new ChatPage(page);
    await chat.open('/');
    await chat.selectModel('Auto');
  });

  test('WEB-15 | Model listesi beklenen sağlayıcıları içerir', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.open('/');
    const models = await chat.modelOptions();

    expect(models[0]).toBe('Auto');
    for (const family of ['GPT', 'Claude', 'Gemini', 'Grok', 'DeepSeek']) {
      expect(models.some((m) => m.includes(family)), `${family} modeli listede yok`).toBe(true);
    }
  });

  test('WEB-15 | Ücretsiz kullanıcı Pro modelle mesaj gönderince yükseltmeye yönlendirilir', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.open('/');
    await chat.selectModel('Claude Opus 5');
    await chat.sendMessage('2+2 kaç?');

    // Gozlem: urun iki farkli davranis gosterdi (A/B testi olabilir):
    //  a) yanit balonunda "not subscribed to the pro version" mesaji + Get Pro butonu
    //  b) dogrudan "Upgrade your account" paywall'i
    // Ikisi de kabul edilir; onemli olan Pro modelin ucretsiz kullaniciya yanit uretmemesi.
    const upgradeMessage = chat.assistantMessages.last().filter({ hasText: /not subscribed to the pro version/i });
    const paywall = new Paywall(page);
    await expect(upgradeMessage.or(paywall.dialog)).toBeVisible({ timeout: 30_000 });
    if (await paywall.dialog.isVisible()) {
      test.info().annotations.push({ type: 'gözlem', description: 'Pro model mesajı doğrudan paywall açtı' });
      await paywall.closeWithEscape();
    } else {
      await expect(upgradeMessage.getByRole('button', { name: 'Get Pro' })).toBeVisible();
    }
  });
});
