// Cerez banner'inda "Decline all" secilince sayfa yenileniyor mu ve yazilan metin kayboluyor mu?
// Temiz bir tarayici acar (onceki cerez tercihi yok), mesaj alanina yazar, banner'da reddet'e basar
// ve sonucu ekran goruntusu + video olarak Kanitlar/Web klasorune kaydeder.
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const OUT = '../Kanitlar/Web';
const TEXT = 'Bu metin kaybolmamali';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: false, slowMo: 300 });
const context = await browser.newContext({
  locale: 'en-US',
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: OUT, size: { width: 1280, height: 800 } },
});
const page = await context.newPage();

let reloads = 0;
page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) reloads++;
});

await page.goto('https://chatbotai.com/');
const input = page.locator('#chat-input-textarea');
await input.waitFor();
await page.waitForTimeout(1500);
// Banner acikken mesaj alanina tiklanamiyor (banner tiklamalari engelliyor). Ama alan sayfa acilinca
// odakta ise kullanici klavyeyle yazabilir. Once odagin nerede oldugu kaydedilir, sonra klavyeyle yazilir.
const autofocus = await page.evaluate(() => document.activeElement?.id === 'chat-input-textarea');
console.log(`Sayfa acilinca mesaj alani odakta mi (autofocus): ${autofocus ? 'EVET' : 'hayir'}`);
if (!autofocus) await input.evaluate((el) => el.focus());
await page.keyboard.type(TEXT, { delay: 40 });
const typed = await input.innerText();
console.log(`Banner acikken yazilan metin alana girdi mi: ${typed.includes(TEXT) ? 'EVET' : 'hayir'}`);

const reject = page.locator('#cookiescript_reject');
try {
  await reject.waitFor({ state: 'visible', timeout: 20_000 });
} catch {
  console.log('Cerez banner\'i 20 saniye icinde gorunmedi. Test yapilamadi.');
  await context.close();
  await browser.close();
  process.exit(1);
}

await page.screenshot({ path: `${OUT}/WEB_cerez_once_metin_yazili.png` });
const before = reloads;
await reject.click();
await page.waitForTimeout(5000);
await page.screenshot({ path: `${OUT}/WEB_cerez_sonra_reddet.png` });

const value = (await page.locator('#chat-input-textarea').innerText().catch(() => '')).trim();
const reloaded = reloads > before;
console.log('\nSonuc');
console.log(`  Sayfa yeniden yuklendi mi: ${reloaded ? 'EVET' : 'hayir'}`);
console.log(`  Reddetten once mesaj alani: "${TEXT}"`);
console.log(`  Reddetten sonra mesaj alani: "${value}"`);
console.log(`  Metin korundu mu: ${value === TEXT ? 'EVET' : 'HAYIR'}`);

const video = page.video();
await context.close();
await browser.close();
if (video) {
  const p = await video.path();
  fs.renameSync(p, `${OUT}/WEB_cerez_reddet_sayfa_yenileniyor.webm`);
}
console.log(`\nKanitlar: ${OUT}`);
