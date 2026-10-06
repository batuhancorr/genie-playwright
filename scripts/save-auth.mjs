// Tek seferlik giris: kalici bir tarayici profili (.auth/profile) acilir, kullanici kendi hesabiyla giris yapar.
// Giris yapilmis profil testlerde aynen kullanilir. Klasor .gitignore'dadir, repoya girmez.
//
// Neden kalici profil? Site Firebase Auth kullaniyor ve oturumu IndexedDB'de tutuyor.
// storageState ile kaydedilen oturum testlerde geri yuklenmedi; profil ise tum depolamayi korur.
// Profil, testlerin kullandigi Playwright Chromium ile olusturulmali (farkli tarayicinin profili uyumsuz olabilir).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import 'dotenv/config';

const BASE_URL = process.env.BASE_URL ?? 'https://chatbotai.com';
const PROFILE_DIR = '.auth/profile';
const TIMEOUT_MS = 5 * 60_000;

// Eski oturum kalirsa script girisi hemen 'tamamlandi' sanar. Bu yuzden her calistirmada temiz profil acilir.
fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
fs.mkdirSync(PROFILE_DIR, { recursive: true });

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  locale: 'en-US',
  viewport: { width: 1280, height: 860 },
  // Google girisi "otomasyonla kontrol edilen tarayici"yi reddedebiliyor; bu ayarlar o isareti kaldirir.
  ignoreDefaultArgs: ['--enable-automation'],
  args: ['--disable-blink-features=AutomationControlled'],
});
const page = context.pages()[0] ?? (await context.newPage());
await page.goto(`${BASE_URL}/?login=true`);

console.log('\nAçılan tarayıcıda giriş yap.');
console.log('Google engellerse "Continue with Email" ile giriş yapabilirsin.');
console.log('Giriş tamamlanınca profil otomatik kaydedilecek. Süre: 5 dakika.\n');

await page.waitForFunction(
  () => {
    const buttons = [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null);
    const hasLogin = buttons.some((b) => b.innerText.trim() === 'Login');
    const hasGetPro = buttons.some((b) => b.innerText.trim() === 'Get Pro');
    return !hasLogin && (hasGetPro || !!document.querySelector('#chat-header-options-button'));
  },
  null,
  { timeout: TIMEOUT_MS, polling: 1000 },
);

// Firebase'in oturumu diske yazmasi icin kisa bir bekleme, sonra sayfayi yenileyip girisin kalici oldugunu dogrula.
await page.waitForTimeout(3000);
await page.reload();
await page.waitForFunction(
  () => ![...document.querySelectorAll('button')].some((b) => b.offsetParent !== null && b.innerText.trim() === 'Login'),
  null,
  { timeout: 30_000 },
);
await context.close();
console.log(`Giriş kaydedildi: ${PROFILE_DIR}`);
