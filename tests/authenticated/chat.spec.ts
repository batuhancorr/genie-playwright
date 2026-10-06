import { authTest as test, expect } from '../fixtures';
import { ChatPage } from '../../pages/ChatPage';

/**
 * Ana akis: giris yapmis ucretsiz kullanici mesaj gonderir, akisli yanit tamamlanir,
 * ayni sohbette baglam korunur ve sohbet gecmise duser.
 * Not: Bu dosya ucretsiz gunluk kotadan 2 sorgu harcar.
 */
test.describe('Sohbet ana akışı (giriş yapılmış)', () => {
  test.describe.configure({ mode: 'serial' });

  test('WEB-06 / WEB-10 / WEB-11 | Mesaj gönderilir, yanıt doğrulanır, bağlam korunur @smoke', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.open('/');
    await expect(chat.getProButton).toBeVisible();
    await chat.selectModel('Auto');

    await test.step('Bilgi doğruluğu: doğrulanabilir bir soru', async () => {
      const answer = await chat.askAndWaitForAnswer('Benim adım Batu. Türkiye\'nin başkenti neresi? Tek cümleyle cevap ver.');
      expect(answer).toMatch(/Ankara/i);
    });

    await test.step('Bağlam: aynı sohbette önceki bilgiyi hatırlama', async () => {
      const answer = await chat.askAndWaitForAnswer('Adım neydi? Sadece adı yaz.');
      expect(answer).toMatch(/Batu/i);
    });

    await test.step('Sohbet, geçmişte "Today" başlığı altında görünür', async () => {
      // Genis ekranda sol menu acik gelir; kapaliysa gorunen "Toggle Sidebar" ile acilir.
      const today = page.getByText('Today', { exact: true }).first();
      if (!(await today.isVisible())) {
        await chat.visible(page.getByRole('button', { name: 'Toggle Sidebar' })).click();
      }
      await expect(today).toBeVisible();
    });
  });

  test('WEB-09 | HTML/script yanıtta çalıştırılmaz, metin olarak gösterilir', async ({ page }) => {
    let dialogFired = false;
    page.on('dialog', async (d) => {
      dialogFired = true;
      await d.dismiss();
    });

    const chat = new ChatPage(page);
    await chat.open('/');
    await chat.selectModel('Auto');
    await chat.askAndWaitForAnswer('Şu satırı kod bloğu içinde aynen geri yaz: <script>alert(1)</script>');

    expect(dialogFired, 'Sayfada alert() çalıştı - XSS riski').toBe(false);
    await expect(chat.assistantMessages.last().locator('script')).toHaveCount(0);
    await expect(chat.assistantMessages.last()).toContainText('alert(1)');
  });
});
