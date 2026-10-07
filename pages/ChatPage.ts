import { expect, test, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class ChatPage extends BasePage {
  readonly input: Locator;
  readonly modelTrigger: Locator;
  readonly addButton: Locator;
  readonly assistantMessages: Locator;
  readonly userMessages: Locator;

  constructor(page: Page) {
    super(page);
    // Lexical tabanli contenteditable editor; site sabit id'ler kullaniyor.
    this.input = page.locator('#chat-input-textarea');
    this.modelTrigger = page.locator('#model-select-trigger');
    this.addButton = page.locator('#chat-input-add-button');
    // Not: "assistant-message-container" id'si her mesajda tekrar ediyor; benzersiz alan data-message-id.
    this.assistantMessages = page.locator('[data-message-id]');
    this.userMessages = page.locator('[id^="user-message-"]:not([id^="user-message-container"]):not(#user-message-actions)');
  }

  async open(path = '/'): Promise<void> {
    await this.page.goto(path);
    await expect(this.input).toBeVisible();
    await this.waitForAppReady();
  }

  /**
   * Sayfa ilk acilista bir kez daha render oluyor (Firebase oturumu / misafir icin anonim oturum acilir,
   * ardindan ust bar ve sohbet gecmisi yuklenir). Bu bitmeden yapilan tiklamalar kayboluyor
   * (ornek: acilan dil listesi kendiliginden kapaniyor). Hazir olma isareti: ust bardaki Login veya Get Pro
   * butonu gorundu ve gecmis listesindeki "Loading" gostergesi kayboldu.
   */
  async waitForAppReady(): Promise<void> {
    await expect(this.loginButton.or(this.getProButton)).toBeVisible({ timeout: 45_000 });
    await expect(this.page.getByRole('img', { name: 'Loading', exact: true })).toHaveCount(0, { timeout: 30_000 });
  }

  get loginButton(): Locator {
    return this.visible(this.page.getByRole('button', { name: 'Login', exact: true }));
  }

  get getProButton(): Locator {
    return this.visible(this.page.getByRole('button', { name: 'Get Pro', exact: true }));
  }

  async typeMessage(text: string): Promise<void> {
    await this.input.click();
    // Site yarim kalan mesaji taslak olarak sakliyor. Onceki kosudan kalan metin varsa once temizlenir.
    await this.page.keyboard.press('ControlOrMeta+A');
    await this.page.keyboard.press('Backspace');
    await this.page.keyboard.type(text);
  }

  async sendMessage(text: string): Promise<void> {
    await this.typeMessage(text);
    await this.page.keyboard.press('Enter');
  }

  async inputText(): Promise<string> {
    return (await this.input.innerText()).trim();
  }

  /**
   * Mesaj gonderir ve yeni asistan yanitinin akisinin bitmesini bekler.
   * AI ciktisi deterministik olmadigi icin birebir metin yerine davranis dogrulanir:
   * yeni yanit balonu olustu, bos degil ve "yeniden uret" aksiyonu gorundu (akis tamamlandi).
   */
  async askAndWaitForAnswer(text: string, timeout = 60_000): Promise<string> {
    const before = await this.assistantMessages.count();
    await this.sendMessage(text);

    // Ucretsiz gunluk sorgu kotasi dolunca yanit yerine paywall aciliyor. Bu bir urun hatasi degil,
    // test ortaminin durumu; bu yuzden test FAIL yerine aciklamayla SKIP edilir.
    const paywall = this.page.getByRole('dialog').filter({ hasText: 'Upgrade your account' });
    await expect(this.assistantMessages.nth(before).or(paywall)).toBeVisible({ timeout });
    if (await paywall.isVisible()) {
      test.skip(true, 'Ücretsiz günlük sorgu kotası doldu: mesaj gönderilince paywall açıldı. Kota yenilenince tekrar koşun.');
    }

    await expect(this.page).toHaveURL(/\/c\/[0-9a-f-]{36}/);
    await expect(this.assistantMessages).toHaveCount(before + 1, { timeout });
    const last = this.assistantMessages.last();
    // Akisin bittigini anlamak icin: yanit metni bos degil ve art arda iki okumada degismiyor.
    let previous = '';
    await expect
      .poll(
        async () => {
          const current = (await last.innerText()).trim();
          const stable = current.length > 0 && current === previous;
          previous = current;
          return stable;
        },
        { timeout, intervals: [1_500], message: 'asistan yanıtı tamamlanmadı' },
      )
      .toBe(true);
    await expect(this.page.locator('#regenerate-message-button').last()).toBeVisible({ timeout });
    return previous;
  }

  /** Model seciciden aciklama metniyle model secer (ornek: "Smart model that adapts to your needs"). */
  async selectModel(name: string): Promise<void> {
    await this.modelTrigger.click();
    await this.page.getByRole('option', { name: new RegExp(`^${escapeRegExp(name)}\\b`) }).first().click();
    await expect(this.modelTrigger).toContainText(name);
  }

  /**
   * Footer dil secicisi (Radix Select). Secim sonrasi sayfa yeni dil yoluna gider (ornek: /de).
   * Liste animasyon/yeniden render sirasinda kapanabildigi icin ac-sec-dogrula adimi toPass ile tekrar denenir.
   */
  async selectFooterLanguage(language: string, expectedUrl: RegExp): Promise<void> {
    const trigger = this.page.getByRole('combobox').filter({ hasText: /English|Deutsch|Español|Français/ });
    await expect(async () => {
      if (!(await this.page.getByRole('option', { name: language, exact: true }).isVisible())) {
        await trigger.click({ timeout: 5_000 });
      }
      await this.page.getByRole('option', { name: language, exact: true }).click({ timeout: 5_000 });
      await expect(this.page).toHaveURL(expectedUrl, { timeout: 10_000 });
    }).toPass({ timeout: 45_000 });
  }

  async modelOptions(): Promise<string[]> {
    await this.modelTrigger.click();
    const options = this.page.getByRole('option');
    await expect(options.first()).toBeVisible();
    const names = (await options.allInnerTexts()).map((t) => t.split('\n')[0].trim());
    await this.page.keyboard.press('Escape');
    return names;
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
