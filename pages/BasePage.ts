import { expect, type Locator, type Page } from '@playwright/test';

export class BasePage {
  constructor(protected readonly page: Page) {}

  /**
   * Modal kapandiktan sonra sayfanin tiklanabilir kaldigini dogrular.
   * Radix Dialog acikken body'ye pointer-events:none ekler; kapanista kaldirilmazsa sayfa kilitlenir (BUG-W03).
   */
  async expectPageInteractive(): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => document.body.style.pointerEvents), {
        message: 'body pointer-events kilidi kaldırılmadı (BUG-W03)',
      })
      .not.toBe('none');
    await expect(this.page.getByRole('dialog')).toHaveCount(0);
  }

  visible(locator: Locator): Locator {
    return locator.filter({ visible: true }).first();
  }
}
