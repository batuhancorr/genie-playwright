import fs from 'node:fs';
import { test, authTest, expect } from '../fixtures';
import { ChatPage } from '../../pages/ChatPage';

/**
 * Web performans ölçümleri. Normal test koşusuna dahil değil, ayrıca çalıştırılır:
 *   npm run test:perf
 * Sonuçlar konsola tablo olarak yazılır ve perf-results/ klasörüne JSON olarak kaydedilir.
 */

const RESULTS_DIR = 'perf-results';
const LOAD_RUNS = 3;
const CHAT_RUNS = 5;
const PROMPT = 'Kahve nasıl demlenir? 3 maddede kısaca anlat.';

function save(name: string, data: unknown): void {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(`${RESULTS_DIR}/${name}.json`, JSON.stringify(data, null, 2));
}

function summary(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  return { ort: avg, min: sorted[0], max: sorted[sorted.length - 1] };
}

/** Sayfa açılmadan önce yüklenir. LCP, CLS ve uzun görevleri en baştan kaydeder. */
const OBSERVERS = () => {
  const w = window as unknown as { __perf: { lcp: number; cls: number; longtasks: [number, number][] } };
  w.__perf = { lcp: 0, cls: 0, longtasks: [] };
  new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__perf.lcp = e.startTime))).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) =>
    l.getEntries().forEach((e) => {
      const s = e as PerformanceEntry & { hadRecentInput: boolean; value: number };
      if (!s.hadRecentInput) w.__perf.cls += s.value;
    }),
  ).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__perf.longtasks.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true });
};

test.describe('Web performans', () => {
  for (const path of ['/', '/pricing']) {
    test(`Sayfa açılış metrikleri (soğuk önbellek) | ${path}`, async ({ browser }) => {
      const runs = [];
      for (let i = 0; i < LOAD_RUNS; i++) {
        // Her ölçüm yeni ve boş bir tarayıcı bağlamında yapılır, yani önbellek soğuk.
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
        const page = await context.newPage();
        await page.addInitScript(OBSERVERS);
        await page.goto(path, { waitUntil: 'load' });
        await page.waitForTimeout(5_000);
        const m = await page.evaluate(() => {
          const w = window as unknown as { __perf: { lcp: number; cls: number; longtasks: [number, number][] } };
          const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
          const tbt = w.__perf.longtasks.filter(([s]) => s > fcp).reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
          return {
            ttfb: Math.round(nav.responseStart),
            fcp: Math.round(fcp),
            lcp: Math.round(w.__perf.lcp),
            tbt: Math.round(tbt),
            cls: Number(w.__perf.cls.toFixed(4)),
            domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
            load: Math.round(nav.loadEventEnd),
          };
        });
        runs.push(m);
        await context.close();
      }
      console.table(runs);
      save(`sayfa-acilis${path === '/' ? '-ana-sayfa' : path.replace('/', '-')}`, runs);
      expect(runs.every((r) => r.fcp > 0)).toBe(true);
    });
  }
});

authTest.describe('Web performans (giriş yapılmış)', () => {
  authTest('Sohbet yanıt süresi | İlk kelime ve tamamlanma', async ({ page }) => {
    const chat = new ChatPage(page);
    const runs = [];
    for (let i = 0; i < CHAT_RUNS; i++) {
      await chat.open('/');
      const model = (await chat.modelTrigger.innerText()).trim();
      await chat.typeMessage(PROMPT);
      const t0 = Date.now();
      await page.keyboard.press('Enter');
      // İlk kelime: yeni asistan mesajında metin belirdiği an.
      await page.waitForFunction(
        () => (document.querySelector('[data-message-id]') as HTMLElement | null)?.innerText.trim().length,
        undefined,
        { polling: 50, timeout: 60_000 },
      );
      const ttft = Date.now() - t0;
      // Tamamlanma: akış bitince görünen 'yeniden üret' butonu.
      await expect(page.locator('#regenerate-message-button').first()).toBeVisible({ timeout: 60_000 });
      const total = Date.now() - t0;
      runs.push({ model, ilkKelimeMs: ttft, tamamlanmaMs: total });
    }
    console.table(runs);
    console.log('İlk kelime', summary(runs.map((r) => r.ilkKelimeMs)), 'Tamamlanma', summary(runs.map((r) => r.tamamlanmaMs)));
    save('sohbet-yanit-suresi', runs);
  });

  authTest('Sohbet geçişleri | Yeni sohbet ve geçmişten sohbet açma', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.open('/');
    const yeniSohbet: number[] = [];
    const gecmis: number[] = [];
    for (let i = 0; i < CHAT_RUNS; i++) {
      // Geçmişten bir sohbet aç ve mesajlar görünene kadar geçen süreyi ölç.
      // Geçmiş öğeleri link değil, "More options" düğmesi olan liste elemanları.
      const historyItem = page
        .getByRole('listitem')
        .filter({ has: page.getByRole('button', { name: 'More options' }) })
        .nth(i % 3);
      await historyItem.waitFor();
      const t1 = Date.now();
      await historyItem.locator('p').first().click();
      await expect(chat.assistantMessages.first()).toBeVisible();
      gecmis.push(Date.now() - t1);
      // Yeni sohbete dön ve mesaj alanı kullanılabilir olana kadar geçen süreyi ölç.
      const t2 = Date.now();
      await page.getByRole('link', { name: 'New Chat' }).first().click();
      await expect(page).toHaveURL(/chatbotai\.com\/?$/);
      await expect(chat.input).toBeEditable();
      yeniSohbet.push(Date.now() - t2);
    }
    const result = { yeniSohbetMs: yeniSohbet, gecmistenSohbetMs: gecmis };
    console.log('Yeni sohbet', summary(yeniSohbet), 'Geçmişten sohbet', summary(gecmis));
    save('sohbet-gecisleri', result);
  });
});
