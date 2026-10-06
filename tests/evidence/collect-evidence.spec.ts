// Bug kayitlari icin ekran goruntusu toplar. Normal kosuya dahil degil: npm run evidence
// Goruntuler ../Kanitlar/Web klasorune yazilir. Hicbir testte satin alma yapilmaz.
import fs from 'node:fs';
import { test, authTest, expect } from '../fixtures';
import { ChatPage } from '../../pages/ChatPage';
import { Paywall } from '../../pages/Paywall';

const OUT = '../Kanitlar/Web';
fs.mkdirSync(OUT, { recursive: true });

test('Kanıt | BUG-W04 footer yazımı ve BUG-W05 isimsiz ikon butonları', async ({ page }) => {
  const chat = new ChatPage(page);
  await chat.open();

  // BUG-W05: erisilebilir adi olmayan gorunur butonlari kirmizi cerceveyle isaretle.
  const unnamed = await page.evaluate(() => {
    const list = [...document.querySelectorAll('button')]
      .filter((b) => (b as HTMLElement).offsetParent !== null)
      .filter((b) => !(b.innerText.trim() || b.getAttribute('aria-label') || b.getAttribute('title')));
    list.forEach((b) => {
      (b as HTMLElement).style.outline = '3px solid red';
      (b as HTMLElement).style.outlineOffset = '2px';
    });
    return list.map((b) => b.id || b.outerHTML.slice(0, 80));
  });
  await page.screenshot({ path: `${OUT}/WEB_BUG-W05_isimsiz_ikon_butonlari.png` });
  fs.writeFileSync(`${OUT}/WEB_BUG-W05_isimsiz_butonlar_listesi.txt`, unnamed.join('\n') + '\n');

  // BUG-W04: footer'daki "24/07/365" yazisini isaretle.
  const footer = page.locator('footer').first();
  await footer.scrollIntoViewIfNeeded();
  await footer.evaluate((f) => {
    const el = [...f.querySelectorAll('*')].find((e) => e.childElementCount === 0 && /24\/07\/365/.test(e.textContent ?? ''));
    if (el) {
      (el as HTMLElement).style.outline = '3px solid red';
      (el as HTMLElement).style.outlineOffset = '3px';
    }
  });
  await footer.screenshot({ path: `${OUT}/WEB_BUG-W04_footer_24-07-365.png` });
});

authTest.describe('Türkçe tarayıcı (tr-TR)', () => {
  authTest.use({ locale: 'tr-TR' });

  authTest('Kanıt | BUG-W02 paywall para birimi formatı', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.open('/');
    await chat.getProButton.click();
    const paywall = new Paywall(page);
    await paywall.expectOpen();
    await paywall.selectPlan('Monthly');
    // Yalnizca paywall penceresi cekilir, kenar cubugundaki hesap bilgisi goruntuye girmez.
    await paywall.dialog.screenshot({ path: `${OUT}/WEB_BUG-W02_paywall_karisik_format_trTR.png` });
    await paywall.closeWithEscape();
  });
});

authTest('Kanıt | BUG-W07 sürükle-bırak ile .exe dosyası', async ({ page }) => {
  const chat = new ChatPage(page);
  await chat.open('/');
  // Gercek bir dosya surukleme simule edilir: icerigi bos, adi .exe olan bir dosya.
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['MZ'], 'kurulum.exe', { type: 'application/x-msdownload' }));
    const target = document.querySelector('#chat-input-textarea')?.closest('form') ?? document.body;
    for (const type of ['dragenter', 'dragover', 'drop']) {
      target.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
    }
  });
  await page.waitForTimeout(3000);
  const paywallOpen = await new Paywall(page).dialog.isVisible();
  test.info().annotations.push({ type: 'sonuç', description: paywallOpen ? 'Paywall açıldı' : 'Paywall açılmadı' });
  // Sol kenar cubugu (hesap bilgisi) disarida kalsin diye yalnizca sag taraf cekilir.
  const vp = page.viewportSize() ?? { width: 1440, height: 900 };
  await page.screenshot({ path: `${OUT}/WEB_BUG-W07_exe_surukle_birak.png`, clip: { x: 250, y: 0, width: vp.width - 250, height: vp.height } });
  expect(true).toBe(true);
});
