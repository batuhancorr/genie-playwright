import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
  type PlaywrightTestOptions,
  type PlaywrightWorkerArgs,
  type TestInfo,
} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BROWSER_ARGS, DEMO_SLOWMO } from '../browser-options';

/** Giris yapilmis kalici tarayici profili (npm run auth ile olusturulur, .gitignore'da). */
export const PROFILE_DIR = '.auth/profile';

/**
 * CookieScript banner'i sayfanin herhangi bir aninda acilip tiklamalari engelleyebiliyor.
 * addLocatorHandler ile banner her gorundugunde otomatik olarak "Decline all" (yalnizca zorunlu cerezler) secilir.
 */
async function registerCookieHandler(page: Page): Promise<void> {
  const banner = page.locator('#cookiescript_injected_wrapper');
  await page.addLocatorHandler(
    banner,
    async (overlay) => {
      // Banner kayarak acilip kapandigi icin normal click "not stable / not visible" ile takilabiliyor.
      // Butona DOM uzerinden tiklanir; banner o arada kaybolduysa hata yutulur (handler tekrar tetiklenir).
      await overlay
        .locator('#cookiescript_reject')
        .evaluate((el) => (el as HTMLElement).click(), undefined, { timeout: 3_000 })
        .catch(() => {});
      await overlay.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
    },
    { noWaitAfter: true },
  );
}

/**
 * CookieScript "Decline all" secilince sayfayi yeniden yukluyor (UX-30). Test ortasinda gelen bu yenileme
 * yazilan metni siliyor ve elementleri DOM'dan kopariyor. Bu yuzden banner script'i testlerde hic yuklenmez.
 * Locator handler yedek olarak kalir.
 */
async function blockCookieBanner(target: Page | BrowserContext): Promise<void> {
  await target.route(/cookie-script\.com/, (route) => route.abort());
}

/**
 * Demo kaydi (VIDEO=on): Izleyen ne oldugunu anlasin diye sayfanin ustunde test adini gosteren bir etiket
 * cikar, test bitince sonucu yazar ve tarayici kapanmadan once kisa bir sure bekler.
 * Etiket aria-hidden ve tiklamalari engellemez, bu yuzden testlerin sonucunu etkilemez.
 */
const DEMO = process.env.VIDEO === 'on';
const BANNER_ID = '__demo_banner';

async function showDemoBanner(page: Page, testInfo: TestInfo): Promise<void> {
  if (!DEMO) return;
  await page.addInitScript(
    ({ id, text }) => {
      const show = () => {
        if (document.getElementById(id)) return;
        const el = document.createElement('div');
        el.id = id;
        el.setAttribute('aria-hidden', 'true');
        el.textContent = text;
        Object.assign(el.style, {
          position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: '2147483647',
          background: 'rgba(17,24,39,0.92)', color: '#fff', font: '600 15px/1.4 -apple-system, Segoe UI, sans-serif',
          padding: '8px 16px', borderRadius: '10px', pointerEvents: 'none', maxWidth: '60vw', textAlign: 'center',
        });
        document.documentElement.appendChild(el);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
      else show();
    },
    { id: BANNER_ID, text: `▶ ${testInfo.title}` },
  );
}

async function finishDemoBanner(page: Page, testInfo: TestInfo): Promise<void> {
  if (!DEMO || page.isClosed()) return;
  const result =
    testInfo.status === 'skipped' ? `⏭ Atlandı: ${testInfo.annotations.find((a) => a.type === 'skip')?.description ?? ''}`
    : testInfo.expectedStatus === 'failed' && testInfo.status === 'failed' ? '✔ Bilinen bug doğrulandı (beklenen hata)'
    : testInfo.status === testInfo.expectedStatus ? '✔ Test geçti'
    : '✖ Test başarısız';
  await page
    .evaluate(({ id, text }) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }, { id: BANNER_ID, text: `${testInfo.title} — ${result}` })
    .catch(() => {});
  await page.waitForTimeout(1500).catch(() => {});
}

/** Giris profilinde Chrome'un ceviri onerisini kapatir (Ingilizce sayfalar icin ceviri balonu cikmaz). */
function disableTranslate(profileDir: string): void {
  const file = `${profileDir}/Default/Preferences`;
  if (!fs.existsSync(file)) return;
  try {
    const prefs = JSON.parse(fs.readFileSync(file, 'utf-8'));
    prefs.translate = { ...(prefs.translate ?? {}), enabled: false };
    prefs.translate_blocked_languages = ['en'];
    fs.writeFileSync(file, JSON.stringify(prefs));
  } catch {
    // Tercih dosyasi okunamazsa test yine calisir, sadece ceviri balonu gorunebilir.
  }
}

type LaunchFixtures = { playwright: PlaywrightWorkerArgs['playwright'] } & Pick<PlaywrightTestOptions, 'headless' | 'viewport' | 'locale'>;

/**
 * Chrome'u verilen profil klasoruyle acar. Iki proje de bunu kullanir:
 *  - misafir: her test icin yeni, bos bir gecici profil (testler birbirinden bagimsiz kalir)
 *  - giris yapilmis: npm run auth ile kaydedilen kalici profil
 * Gecici profil de kalici context olarak acilir, cunku ceviri balonunu kapatan Chrome ayari ancak profil
 * dosyasina yazilarak verilebiliyor (disableTranslate).
 */
async function launchProfile(
  { playwright, headless, viewport, locale }: LaunchFixtures,
  profileDir: string,
  testInfo: TestInfo,
  use: (context: BrowserContext) => Promise<void>,
): Promise<void> {
  disableTranslate(profileDir);
  const recordVideo = { dir: testInfo.outputPath('videos'), size: viewport ?? { width: 1440, height: 900 } };
  const context = await playwright.chromium.launchPersistentContext(profileDir, {
    headless,
    viewport,
    locale,
    recordVideo,
    args: BROWSER_ARGS,
    slowMo: DEMO_SLOWMO,
  });
  await use(context);
  await context.close();
  // Kalici context'te videoyu test runner otomatik eklemiyor; hata olursa veya VIDEO=on ise rapora eklenir.
  const failed = testInfo.status !== testInfo.expectedStatus;
  if (failed || DEMO) {
    for (const file of fs.existsSync(recordVideo.dir) ? fs.readdirSync(recordVideo.dir) : []) {
      await testInfo.attach('video', { path: `${recordVideo.dir}/${file}`, contentType: 'video/webm' });
    }
  }
}

async function preparePage(context: BrowserContext, testInfo: TestInfo): Promise<Page> {
  await blockCookieBanner(context);
  const page = context.pages()[0] ?? (await context.newPage());
  await registerCookieHandler(page);
  await showDemoBanner(page, testInfo);
  return page;
}

/** Misafir testleri: her test bos bir gecici profille baslar, cerez banner'i engelli. */
export const test = base.extend<{ context: BrowserContext; page: Page }>({
  context: async ({ playwright, headless, viewport, locale }, use, testInfo) => {
    const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'genie-guest-'));
    fs.mkdirSync(path.join(tempProfile, 'Default'), { recursive: true });
    fs.writeFileSync(path.join(tempProfile, 'Default', 'Preferences'), '{}');
    try {
      await launchProfile({ playwright, headless, viewport, locale }, tempProfile, testInfo, use);
    } finally {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    }
  },
  page: async ({ context }, use, testInfo) => {
    const page = await preparePage(context, testInfo);
    await use(page);
    await finishDemoBanner(page, testInfo);
  },
});

/**
 * Giris gerektiren testler: kalici profille acilan tarayici.
 * Neden storageState degil? Site Firebase Auth kullaniyor; oturum IndexedDB'de tutuluyor ve
 * storageState ile tasindiginda oturum geri yuklenmedi. Kalici profil tum depolamayi oldugu gibi korur.
 */
export const authTest = base.extend<{ context: BrowserContext; page: Page }>({
  context: async ({ playwright, headless, viewport, locale }, use, testInfo) => {
    testInfo.skip(!fs.existsSync(PROFILE_DIR), `Giriş profili bulunamadı (${PROFILE_DIR}). Önce "npm run auth" çalıştırın.`);
    await launchProfile({ playwright, headless, viewport, locale }, PROFILE_DIR, testInfo, use);
  },
  page: async ({ context }, use, testInfo) => {
    const page = await preparePage(context, testInfo);
    await use(page);
    await finishDemoBanner(page, testInfo);
  },
});

export { expect };
