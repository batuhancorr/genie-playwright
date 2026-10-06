import { test, expect } from '../fixtures';
import { PricingPage } from '../../pages/PricingPage';

test.describe('Pricing sayfası (misafir)', () => {
  test('Pricing sayfası planları ve fiyatları gösterir', async ({ page }) => {
    const pricing = new PricingPage(page);
    await pricing.open();

    for (const plan of ['Yearly', 'Monthly'] as const) {
      const price = await pricing.planPrice(plan);
      expect(price.raw, `${plan} fiyatı bulunamadı`).toMatch(/^₺/);
      expect(price.value).toBeGreaterThan(0);
    }
    await expect(page.getByText('Start', { exact: true })).toHaveCount(2);
  });
});
