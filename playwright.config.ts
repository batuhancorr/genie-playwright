import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';
import { BROWSER_ARGS, DEMO_SLOWMO } from './browser-options';

export default defineConfig({
  testDir: './tests',
  // AI yanitlari agdan ve modelden dolayi degisken sureli; testler ve beklemeler buna gore genis.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  // Ucretsiz kotayi korumak, sohbet testlerinin birbirini etkilememesi ve
  // kalici profilin (tek seferde tek tarayici acabilir) kilitlenmemesi icin tek worker.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    launchOptions: { args: BROWSER_ARGS, slowMo: DEMO_SLOWMO },
    baseURL: process.env.BASE_URL ?? 'https://chatbotai.com',
    locale: 'en-US',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: process.env.VIDEO === 'on' ? 'on' : 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'guest', testDir: './tests/guest' },
    // Giris gerektiren testler tests/fixtures.ts icindeki kalici profili (.auth/profile) kullanir.
    { name: 'authenticated', testDir: './tests/authenticated' },
    // Performans ölçümleri normal koşuya dahil değil: npm run test:perf
    { name: 'perf', testDir: './tests/perf', timeout: 300_000 },
    // Bug kayitlari icin ekran goruntusu toplar: npm run evidence
    { name: 'evidence', testDir: './tests/evidence' },
  ],
});
