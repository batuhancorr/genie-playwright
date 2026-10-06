import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginModal extends BasePage {
  readonly dialog: Locator;

  constructor(page: Page) {
    super(page);
    this.dialog = page.getByRole('dialog').filter({ hasText: 'Welcome to chatbotai.com' });
  }

  async expectOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible();
    await expect(this.page).toHaveURL(/login=true/);
  }

  providerButton(name: 'Google' | 'Facebook' | 'Apple' | 'Microsoft' | 'Email'): Locator {
    return this.dialog.getByRole('button', { name: `Continue with ${name}` });
  }

  get emailInput(): Locator {
    return this.dialog.getByPlaceholder('Your email address');
  }

  async closeWithEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.dialog).toBeHidden();
  }
}
