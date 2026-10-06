import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { CURRENCY_PRICE, parseTry } from './Paywall';

export class PricingPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /** Sayfada ic ice iki <main> var; dis olan tum icerigi kapsar. */
  get main() {
    return this.page.locator('main').first();
  }

  async open(): Promise<void> {
    await this.page.goto('/pricing');
    // Not: Baslik masaustunde "The latest AI models. All in one app.", dar ekranda "Choose best plan for you".
    // Bu yuzden baslik yerine plan kartlari beklenir.
    await expect(this.main.getByText('Yearly', { exact: true }).first()).toBeVisible();
    await expect(this.main.getByText('Monthly', { exact: true }).first()).toBeVisible();
  }

  /** "Monthly ₺1,178.47 / month" gibi bir kartin fiyatini dondurur. */
  async planPrice(plan: 'Yearly' | 'Monthly'): Promise<{ raw: string; value: number }> {
    const text = await this.main.innerText();
    const re = new RegExp(`${plan}\\s*\\n+\\s*(${CURRENCY_PRICE.source})`);
    const raw = text.match(re)?.[1] ?? '';
    return { raw, value: parseTry(raw) };
  }
}
