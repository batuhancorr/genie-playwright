import { authTest as test, expect } from '../fixtures';
import { ChatPage } from '../../pages/ChatPage';
import { Paywall, PLAN_MONTHS, decimalStyle, type Plan } from '../../pages/Paywall';
import { PricingPage } from '../../pages/PricingPage';

/** Gelir acisindan kritik akis. Hicbir testte "Subscribe Now"a basilmaz, satin alma yapilmaz. */
test.describe('Paywall (giriş yapılmış, Free)', () => {

  async function openPaywall(page: import('@playwright/test').Page): Promise<Paywall> {
    const chat = new ChatPage(page);
    await chat.open('/');
    await chat.getProButton.click();
    const paywall = new Paywall(page);
    await paywall.expectOpen();
    return paywall;
  }

  test('WEB-23 | Plan seçimi toplam tutarı doğru hesaplar @smoke', async ({ page }) => {
    const paywall = await openPaywall(page);
    // Plan seti hesaba gore degisebildigi icin sabit liste yerine ekranda gorunen planlar test edilir.
    const plans = await paywall.availablePlans();
    expect(plans.length, 'Paywall en az 2 plan göstermeli').toBeGreaterThanOrEqual(2);

    // Yearly kartindaki aylik fiyat 30 gunluk aya gore hesaplaniyor (yillik / 365 x 30), bu yuzden x12 kontrolu ona uygulanmaz.
    for (const plan of plans.filter((p) => p !== 'Yearly')) {
      await test.step(plan, async () => {
        await paywall.selectPlan(plan);
        const perMonth = await paywall.perMonthPrice(plan);
        const charged = await paywall.chargedAmount();
        expect(perMonth.value, `${plan} aylık fiyat okunamadı`).toBeGreaterThan(0);
        // Kartta yuvarlanmis aylik fiyat gosteriliyor; 1 kurusluk sapmaya izin verilir.
        expect(Math.abs(perMonth.value * PLAN_MONTHS[plan] - charged.value)).toBeLessThanOrEqual(0.05);
      });
    }
  });

  /**
   * BUG-W03 aralikli oldugu icin regresyon olarak yazildi. Kapatmadan sonra:
   *  1) body'de pointer-events:none kalmamali, acik dialog olmamali
   *  2) gercek kullanici etkilesimi calismali: mesaj alanina tiklayip yazi yazilabilmeli
   * Not: Paywall URL degistirmedigi icin tarayici geri tusu sayfadan cikiyor; bu yuzden
   * ucuncu senaryo olarak art arda ac-kapat (durum sizintisi) kullanildi.
   */
  const METHOD_TITLES = {
    'Escape': 'Escape tuşuyla kapatılınca',
    'X butonu': 'X butonuyla kapatılınca',
    'art arda aç-kapat': 'art arda açılıp kapatılınca',
  } as const;

  for (const method of ['Escape', 'X butonu', 'art arda aç-kapat'] as const) {
    test(`BUG-W03 (regresyon) | Paywall ${METHOD_TITLES[method]} sayfa tıklanabilir kalır`, async ({ page }) => {
      const paywall = await openPaywall(page);
      if (method === 'Escape') await paywall.closeWithEscape();
      if (method === 'X butonu') await paywall.closeWithButton();
      if (method === 'art arda aç-kapat') {
        await paywall.closeWithEscape();
        const chat = new ChatPage(page);
        await chat.getProButton.click();
        await paywall.expectOpen();
        await paywall.closeWithButton();
      }
      await paywall.expectPageInteractive();

      const chat = new ChatPage(page);
      await chat.input.click({ timeout: 5_000 });
      // Site yarim kalan mesaji taslak olarak sakliyor; onceki testten kalan metin varsa once temizlenir.
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Backspace');
      await page.keyboard.type('tiklanabilir');
      expect(await chat.inputText()).toBe('tiklanabilir');
    });
  }

  // BUG-W02 yalnizca Turkce tarayici dilinde gorunuyor: kartta "₺1.768,00", toplamda "₺1,768.00".
  // Ingilizce (en-US) tarayicida iki fiyat da "₺1,768.00" oldugu icin bu test tr-TR ile kosar.
  test.describe('Türkçe tarayıcı (tr-TR)', () => {
    test.use({ locale: 'tr-TR' });

    test('BUG-W02 | Paywall\'da para birimi formatı tutarlı olmalı', async ({ page }) => {
      test.info().annotations.push({ type: 'issue', description: 'BUG-W02: "₺1.768,00" ve "₺1,768.00" aynı pencerede' });
      test.fail(true, 'Bilinen bug: BUG-W02');

      const paywall = await openPaywall(page);
      await paywall.selectPlan('Monthly');
      const card = await paywall.perMonthPrice('Monthly');
      const charged = await paywall.chargedAmount();
      expect(decimalStyle(card.raw)).toBe(decimalStyle(charged.raw));
    });
  });

  test('BUG-W01 | Pricing sayfası ile paywall\'daki aylık fiyat aynı olmalı', async ({ page }) => {
    test.info().annotations.push({ type: 'issue', description: 'BUG-W01: Pricing ₺1.178,47 vs paywall ₺1.768,00' });

    const pricing = new PricingPage(page);
    await pricing.open();
    const pricingMonthly = await pricing.planPrice('Monthly');

    const paywall = await openPaywall(page);
    // Fark yalnizca "6 Months" planli paywall varyantinda goruluyor. Diger varyantta fiyatlar ayni.
    const variantA = (await paywall.availablePlans()).includes('6 Months');
    test.info().annotations.push({ type: 'paywall varyantı', description: variantA ? 'A (Monthly/Quarterly/6 Months)' : 'B (Monthly/Quarterly/Yearly)' });
    test.fail(variantA, 'Bilinen bug: BUG-W01 (6 Months planlı paywall varyantı)');
    await paywall.selectPlan('Monthly');
    const paywallMonthly = await paywall.perMonthPrice('Monthly');

    expect(paywallMonthly.value).toBeCloseTo(pricingMonthly.value, 2);
  });
});
