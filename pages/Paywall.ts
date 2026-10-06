import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Paywall'da iki farkli plan seti goruldu (hesaba gore degisiyor, A/B testi olabilir):
 *  - Varyant A: Monthly / Quarterly / 6 Months (aylik fiyat pricing sayfasindan farkli, BUG-W01)
 *  - Varyant B: Monthly / Quarterly / Yearly (fiyatlar pricing sayfasiyla ayni)
 */
export type Plan = 'Monthly' | 'Quarterly' | '6 Months' | 'Yearly';
export const PLAN_MONTHS: Record<Plan, number> = { Monthly: 1, Quarterly: 3, '6 Months': 6, Yearly: 12 };

export class Paywall extends BasePage {
  readonly dialog: Locator;

  constructor(page: Page) {
    super(page);
    this.dialog = page.getByRole('dialog').filter({ hasText: 'Upgrade your account' });
  }

  async expectOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole('button', { name: 'Subscribe Now' })).toBeVisible();
  }

  /** Plan kartlari Radix RadioGroup: div[role=radio] icinde plan adi, fiyat ve "Per Month". */
  planCard(plan: Plan): Locator {
    return this.dialog.locator('div[role="radio"]').filter({ hasText: plan });
  }

  /** Paywall'da o an gosterilen planlar (kart metninin ilk satiri plan adidir). */
  async availablePlans(): Promise<Plan[]> {
    const cards = this.dialog.locator('div[role="radio"]');
    await expect(cards.first()).toBeVisible();
    const names = (await cards.allInnerTexts()).map((t) => t.trim().split('\n')[0].trim());
    return names.filter((n): n is Plan => n in PLAN_MONTHS);
  }

  async selectPlan(plan: Plan): Promise<void> {
    await this.planCard(plan).click();
    await expect(this.dialog).toContainText(`With the ${plan} plan`);
  }

  /** Planin kartta yazan aylik fiyati (ornek "₺982,35" -> 982.35). */
  async perMonthPrice(plan: Plan): Promise<{ raw: string; value: number }> {
    const raw = (await this.planCard(plan).innerText()).match(/₺\s?[\d.,]+/)?.[0] ?? '';
    return { raw, value: parseTry(raw) };
  }

  /** "you will be charged ₺2,947.06 every 3 months" cumlesindeki tutar. */
  async chargedAmount(): Promise<{ raw: string; value: number }> {
    const text = await this.dialog.innerText();
    const raw = text.match(/charged\s+(₺\s?[\d.,]+)/)?.[1] ?? '';
    return { raw, value: parseTry(raw) };
  }

  async closeWithEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.dialog).toBeHidden();
  }

  async closeWithButton(): Promise<void> {
    // X butonu ekran okuyucuya ozel "Close" metni tasiyor.
    await this.dialog.getByRole('button', { name: 'Close' }).click();
    await expect(this.dialog).toBeHidden();
  }
}

/**
 * Hem TR ("1.768,00") hem EN ("1,768.00") formatini sayiya cevirir.
 * Son ayiricidan sonra 2 hane varsa onu ondalik ayirici kabul eder.
 */
export function parseTry(raw: string): number {
  const digits = raw.replace(/[^\d.,]/g, '');
  const m = digits.match(/^(.*)[.,](\d{2})$/);
  if (!m) return Number(digits.replace(/[.,]/g, ''));
  return Number(`${m[1].replace(/[.,]/g, '')}.${m[2]}`);
}

/** Fiyat metninin TR (virgul ondalik) mi EN (nokta ondalik) mi oldugunu dondurur. */
export function decimalStyle(raw: string): 'comma' | 'dot' | 'unknown' {
  if (/,\d{2}$/.test(raw)) return 'comma';
  if (/\.\d{2}$/.test(raw)) return 'dot';
  return 'unknown';
}
