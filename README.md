# Genie Web (chatbotai.com) – Playwright E2E Testleri

AppNation QA Engineer case study kapsamında, Genie'nin web sürümü **chatbotai.com** için hazırlanmış uçtan uca test otomasyonu.

- **Araç:** Playwright Test (TypeScript)
- **Yapı:** Page Object Model
- **Raporlama:** HTML rapor; hata durumunda ekran görüntüsü, video ve trace
- **CI:** GitHub Actions (misafir testleri)

## Neyi test ediyor?

| Proje | Dosya | Kapsam |
|---|---|---|
| `guest` | `home.spec.ts` | Ana sayfa bileşenleri, footer linkleri |
| `guest` | `login-modal.spec.ts` | Misafir mesaj gönderince giriş penceresi; yazılan metnin korunması; giriş seçenekleri |
| `guest` | `localization.spec.ts` | Footer dil seçicisi, Almanca'ya geçiş |
| `guest` | `pricing.spec.ts` | Pricing sayfasındaki plan ve fiyatlar |
| `authenticated` | `chat.spec.ts` | **Ana akış:** mesaj gönderme, akışlı yanıtın tamamlanması, bilgi doğruluğu, aynı sohbette bağlamın korunması, geçmişte görünme, HTML/script'in çalıştırılmaması |
| `authenticated` | `model-gating.spec.ts` | Model listesi; ücretsiz kullanıcının Pro modelle karşılaştığı kısıt |
| `authenticated` | `paywall.spec.ts` | Plan seçimi ve toplam tutar hesabı; paywall'ın 3 farklı yolla kapatılması sonrası sayfanın tıklanabilir kalması |
| `perf` | `web-perf.spec.ts` | Sayfa açılış metrikleri (TTFB, FCP, LCP, TBT, CLS), sohbet yanıt süresi, sohbet geçişleri. Normal koşuya dahil değil |

### Bilinen buglar (`test.fail`)

Raporda yer alan bazı buglar test olarak da yazıldı ve `test.fail()` ile işaretlendi. Bu testler bug var olduğu sürece **"expected to fail"** olarak geçer. Bug düzeltildiğinde test beklenmedik şekilde başarılı olur ve Playwright bunu bildirir; o zaman işaret kaldırılır.

| Test | Bug |
|---|---|
| `BUG-W01` | Pricing sayfası ile paywall'daki aylık fiyat farklı (yalnızca "6 Months" planlı paywall varyantında) |
| `BUG-W02` | Paywall'da karışık para birimi formatı (₺1.768,00 / ₺1,768.00) |
| `BUG-W04` | Footer'da "24/07/365" yazım hatası |
| `BUG-W05` | İkon butonların erişilebilir adı yok |
| `UX-17` | Web dil listesinde Türkçe yok |

`BUG-W03` (paywall kapandıktan sonra sayfanın kilitlenmesi) aralıklı olduğu için **regresyon testi** olarak yazıldı: Escape, X butonu ve art arda aç-kapat ile kapatıldıktan sonra `body`'de `pointer-events: none` kalmadığı ve mesaj alanına tıklayıp yazı yazılabildiği doğrulanır.

### Paywall varyantları

Paywall hesaba göre iki farklı plan setiyle açılabiliyor (muhtemelen A/B testi): **Monthly / Quarterly / 6 Months** veya **Monthly / Quarterly / Yearly**. Testler sabit bir plan listesi beklemez, ekranda hangi planlar varsa onları kontrol eder. `BUG-W01` testi hangi varyantın açıldığını rapora not olarak ekler ve yalnızca fiyat farkının görüldüğü varyantta "beklenen hata" olarak işaretlenir.

### Yapay zekâ yanıtlarını doğrulama yaklaşımı

Model çıktıları deterministik değildir. Bu yüzden testler birebir metin karşılaştırmaz, **davranışı** doğrular:

- Yeni yanıt balonu oluştu mu, URL `/c/<id>` oldu mu?
- Yanıt metni boş değil ve art arda iki okumada değişmiyor mu (akış tamamlandı)?
- "Yeniden üret" aksiyonu göründü mü?
- Cevap beklenen anahtar kelimeyi içeriyor mu (örnek: "Ankara", "Batu")?

## Kurulum

Gereksinimler: Node.js 20+ ve Google Chrome.

```bash
npm install
npx playwright install chromium
cp .env.example .env
```

## Çalıştırma

### 1. Misafir testleri (giriş gerekmez)

```bash
npm run test:guest
```

### 2. Giriş gerektiren testler

Sohbet web'de giriş istiyor. Giriş bir kez, kalıcı bir tarayıcı profiline yapılır; testler bu profili kullanır:

```bash
npm run auth        # Tarayıcı açılır, kendi hesabınla giriş yap (5 dk süre)
npm run test:auth
```

- Profil `.auth/profile` klasörüne yazılır. Bu klasör `.gitignore`'dadır, repoya girmez.
- **Neden `storageState` değil?** Site Firebase Auth kullanıyor ve oturumu IndexedDB'de tutuyor. `storageState` ile kaydedilen oturum testlerde geri yüklenmedi; kalıcı profil (`launchPersistentContext`) tüm tarayıcı depolamasını olduğu gibi korur. Uygulaması: `tests/fixtures.ts`.
- Profil yoksa giriş gerektiren testler hata vermez, açıklamayla **skip** edilir.
- Google, otomasyon tarayıcısında girişi engellerse "Continue with Email" ile giriş yapılabilir.
- **Kota:** Ücretsiz hesapta günlük sorgu hakkı sınırlıdır. `chat.spec.ts` her koşumda 3 sorgu harcar. Kota dolduğunda mesaj gönderilince paywall açılır; sohbet testleri bu durumda hata vermez, açıklamayla **skip** edilir.

### 3. Hepsi, rapor ve demo

```bash
npm test             # tüm testler
npm run report       # HTML raporu aç
npm run test:demo    # demo modu: tarayıcı görünür, adımlar yavaşlatılır, videolar kaydedilir
```

Demo modunda (`VIDEO=on`) sayfanın üstünde o an çalışan testin adı gösterilir. Test bitince etikette sonuç yazar ("Test geçti", "Bilinen bug doğrulandı" veya "Atlandı") ve pencere kapanmadan önce kısa bir süre beklenir. Bu etiket `aria-hidden` ve tıklamaları engellemez, test sonucunu etkilemez.

Videolar ve trace dosyaları `test-results/` klasörüne yazılır. Bir hatayı adım adım incelemek için:

```bash
npx playwright show-trace test-results/<test-klasoru>/trace.zip
```

### 4. Performans ölçümleri

```bash
npm run test:perf
```

- Misafir olarak `/` ve `/pricing` sayfaları 3'er kez boş önbellekle açılır. TTFB, FCP, LCP, TBT, CLS, DOMContentLoaded ve load süreleri ölçülür.
- Giriş yapılmış hesapla sabit bir soruyla 5 kez sohbet başlatılır. İlk kelimenin gelme süresi ve yanıtın tamamlanma süresi ölçülür.
- Yeni sohbet açma ve geçmişten sohbet açma süreleri 5'er kez ölçülür.
- Sonuçlar konsola tablo olarak yazılır ve `perf-results/*.json` dosyalarına kaydedilir.

### 5. Çerez banner'ı kontrolü

```bash
npm run check:cookie
```

Temiz bir tarayıcıda mesaj alanına yazı yazar, çerez banner'ında "Decline all"a basar ve sayfanın yeniden yüklenip yüklenmediğini, yazılan metnin korunup korunmadığını raporlar (UX-30). Ekran görüntüleri ve video `../Kanitlar/Web` klasörüne kaydedilir.

## Proje yapısı

```
pages/                  Page Object'ler
  BasePage.ts           modal sonrası sayfa kilidi kontrolü
  ChatPage.ts           mesaj alanı, model seçici, yanıt bekleme
  LoginModal.ts         giriş penceresi
  Paywall.ts            plan seçimi, fiyat okuma (TR/EN format), kapatma
  PricingPage.ts        /pricing
tests/
  guest/                giriş gerektirmeyen testler
  authenticated/        giriş gerektiren testler
  perf/                 performans ölçümleri (npm run test:perf)
  fixtures.ts           tarayıcı profilleri, çerez banner'ı engeli, demo etiketi
scripts/
  save-auth.mjs         tek seferlik giriş (kalıcı profil)
  cookie-reload-check.mjs  çerez reddedilince sayfa yenileniyor mu kontrolü
browser-options.ts      Chrome başlatma ayarları ve demo yavaşlatması
playwright.config.ts    projeler, timeout'lar, video/trace ayarları
.github/workflows/      CI: her push'ta misafir testleri
```

## Locator stratejisi

Site sabit `id`'ler kullanıyor (`#chat-input-textarea`, `#model-select-trigger`, `#chat-header-toggle-primary-sidebar-button`). Bunlar öncelikli kullanıldı; diğer yerlerde erişilebilirlik rolleri (`getByRole`) tercih edildi. Gözlem: `assistant-message-container` id'si her mesajda tekrar ediyor, bu yüzden yanıtlar benzersiz `data-message-id` ile seçiliyor.

## Notlar

- Çerez banner'ı ("Decline all" seçilince) sayfayı baştan yüklüyor. Bu yenileme test ortasında açık pencereleri ve listeleri kapattığı için banner script'i testlerde yüklenmez. Yedek olarak `page.addLocatorHandler` banner görünürse otomatik kapatır.
- Her test kendi tarayıcı profiliyle açılır: misafir testleri boş, geçici bir profille; giriş gerektiren testler kayıtlı profille. Profil dosyasında Chrome'un çeviri önerisi kapatılır.
- Site yarım kalan mesajı taslak olarak saklıyor. Mesaj alanına yazan testler önce alanı temizler.
- Sayfa ilk açılışta oturum yüklenince bir kez daha render oluyor; bu bitmeden yapılan tıklamalar kayboluyor. `ChatPage.waitForAppReady()` üst bardaki Login/Get Pro butonunu ve geçmiş listesinin yüklenmesini bekler.
- Hiçbir testte "Subscribe Now"a basılmaz, satın alma yapılmaz.
- Testler sıralı (1 worker) koşar: ücretsiz kotayı korumak ve sohbet testlerinin birbirini etkilememesi için.
