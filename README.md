# Genie Web (chatbotai.com) Playwright Testleri

Bu repo AppNation QA Engineer case study'si için hazırlandı. Genie'nin web sürümü olan chatbotai.com'un uçtan uca test otomasyonunu içeriyor.

Testler Playwright Test ve TypeScript ile yazıldı, Page Object Model yapısı kullanıldı. Her koşudan sonra HTML rapor oluşuyor ve hata olursa ekran görüntüsü, video ve trace otomatik ekleniyor. GitHub Actions her push'ta misafir testlerini çalıştırıyor.

## Neler test ediliyor

| Grup | Dosya | Kapsam |
|---|---|---|
| Misafir | `home.spec.ts` | Ana sayfanın bileşenleri ve footer linkleri |
| Misafir | `login-modal.spec.ts` | Misafir mesaj gönderince giriş penceresinin açılması, yazılan metnin korunması, giriş seçenekleri |
| Misafir | `localization.spec.ts` | Footer'daki dil seçici ve Almancaya geçiş |
| Misafir | `pricing.spec.ts` | Pricing sayfasındaki planlar ve fiyatlar |
| Giriş yapılmış | `chat.spec.ts` | Ana akış. Mesaj gönderme, yanıtın tamamlanması, bilginin doğruluğu, aynı sohbette bağlamın korunması, sohbetin geçmişte görünmesi ve HTML/script içeren yanıtın çalıştırılmaması |
| Giriş yapılmış | `model-gating.spec.ts` | Model listesi ve ücretsiz kullanıcının Pro modelle karşılaştığı kısıt |
| Giriş yapılmış | `paywall.spec.ts` | Plan seçimi ve toplam tutar hesabı, paywall üç farklı yolla kapatılınca sayfanın kilitlenmemesi |
| Performans | `web-perf.spec.ts` | Sayfa açılış metrikleri, sohbet yanıt süresi ve sohbet geçişleri. Normal koşuya dahil değil |

### Bilinen buglar

Raporda yer alan bazı buglar test olarak da yazıldı ve `test.fail()` ile işaretlendi. Bug durdukça bu testler "beklenen hata" olarak geçiyor. Bug düzeltildiğinde test beklenmedik şekilde başarılı olur ve Playwright bunu haber verir. O zaman işaret kaldırılır.

| Test | Bug |
|---|---|
| `BUG-W01` | Pricing sayfası ile paywall'da aynı planın fiyatı farklı. Fark paywall'ın iki halinde de var ama farklı planlarda (bir halde Monthly, diğerinde Yearly). Test aylık fiyatı karşılaştırdığı için sadece 6 Months'lu halde hata bekliyor |
| `BUG-W02` | Paywall'da iki farklı para birimi formatı aynı anda görünüyor (₺1.768,00 ve ₺1,768.00) |
| `UX-17` | Web'deki dil listesinde Türkçe yok |

`BUG-W03` (paywall kapandıktan sonra sayfanın kilitlenmesi) her seferinde tekrarlanmadığı için regresyon testi olarak yazıldı. Paywall Escape, X butonu ve art arda aç kapa ile kapatılıyor. Sonra sayfada kilit kalmadığı ve mesaj alanına yazı yazılabildiği kontrol ediliyor.

### Paywall'ın iki farklı hali

Paywall hesaba göre iki farklı plan setiyle açılabiliyor. Birinde Monthly, Quarterly ve 6 Months var, diğerinde Monthly, Quarterly ve Yearly. Bu muhtemelen bir A/B testi. Testler sabit bir plan listesi beklemiyor, ekranda hangi planlar varsa onları kontrol ediyor. `BUG-W01` testi hangi halin açıldığını rapora not ediyor.

### Yapay zekâ yanıtları nasıl doğrulanıyor

Model her seferinde farklı cevap verdiği için testler metni birebir karşılaştırmıyor. Bunun yerine davranışa bakıyor. Yeni yanıt geldi mi, adres `/c/<id>` oldu mu, yanıt boş değil mi ve akış bitti mi diye kontrol ediliyor. Akışın bitip bitmediği yanıtın art arda iki okumada değişmemesinden ve "yeniden üret" butonunun görünmesinden anlaşılıyor. Son olarak cevapta beklenen anahtar kelime var mı diye bakılıyor, örneğin "Ankara" ya da kullanıcının söylediği isim.

## Kurulum

Node.js 20 veya üstü gerekiyor.

```bash
npm install
npx playwright install chromium
cp .env.example .env
```

## Çalıştırma

### Misafir testleri

Giriş gerektirmiyor.

```bash
npm run test:guest
```

### Giriş gerektiren testler

Sohbet için web'de giriş yapmak gerekiyor. Giriş bir kez yapılıyor ve kalıcı bir tarayıcı profiline kaydediliyor. Testler sonra bu profili kullanıyor.

```bash
npm run auth        # tarayıcı açılır, kendi hesabınla giriş yaparsın (5 dakika süre var)
npm run test:auth
```

Profil `.auth/profile` klasörüne yazılıyor. Bu klasör `.gitignore` içinde olduğu için repoya girmiyor.

Neden `storageState` kullanılmadı? Site girişte Firebase kullanıyor ve oturumu IndexedDB'de saklıyor. `storageState` ile kaydedilen oturum testlerde geri gelmedi. Kalıcı profil ise tarayıcının tüm verisini olduğu gibi tuttuğu için sorunsuz çalıştı. İlgili kod `tests/fixtures.ts` içinde.

Profil yoksa giriş gerektiren testler hata vermez, açıklamasıyla birlikte atlanır. Google otomasyon tarayıcısında girişe izin vermezse "Continue with Email" ile giriş yapılabilir.

Ücretsiz hesabın günlük sorgu hakkı sınırlı. `chat.spec.ts` her koşuda 3 sorgu harcıyor. Hak bitince mesaj gönderildiğinde paywall açılıyor. Sohbet testleri bu durumda hata vermiyor, atlanıyor.

### Hepsi birden, rapor ve demo

```bash
npm test             # tüm testler
npm run report       # HTML raporu açar
npm run test:demo    # demo modu
```

Demo modunda tarayıcı görünür açılıyor ve adımlar yavaşlatılıyor. Sayfanın üstünde o an çalışan testin adı yazıyor. Test bitince aynı yerde sonucu görünüyor ve pencere kapanmadan önce kısa bir süre bekleniyor. Bu etiket tıklamaları engellemiyor ve test sonucunu etkilemiyor.

Video ve trace dosyaları `test-results/` klasörüne yazılıyor. Bir hatayı adım adım incelemek için şu komut kullanılabilir.

```bash
npx playwright show-trace test-results/<test-klasoru>/trace.zip
```

### Performans ölçümleri

```bash
npm run test:perf
```

Misafir olarak ana sayfa ve `/pricing` sayfası boş önbellekle üçer kez açılıyor. Her açılışta TTFB, FCP, LCP, TBT, CLS, DOMContentLoaded ve load süreleri ölçülüyor. Giriş yapılmış hesapla aynı soru beş kez soruluyor ve ilk kelimenin gelme süresi ile yanıtın tamamlanma süresi ölçülüyor. Yeni sohbet açma ve geçmişten sohbet açma süreleri de beşer kez ölçülüyor. Sonuçlar konsola tablo olarak yazılıyor ve `perf-results/` klasörüne JSON olarak kaydediliyor.

### Çerez banner'ı kontrolü

```bash
npm run check:cookie
```

Temiz bir tarayıcıda mesaj alanına yazı yazıyor ve çerez banner'ında "Decline all"a basıyor. Sonra sayfanın yeniden yüklenip yüklenmediğini ve yazılan metnin kalıp kalmadığını raporluyor (UX-30). Ekran görüntüleri ve video `../Kanitlar/Web` klasörüne kaydediliyor.

## Proje yapısı

```
pages/                  Page Object'ler
  BasePage.ts           pencere kapandıktan sonra sayfa kilidi kontrolü
  ChatPage.ts           mesaj alanı, model seçici, yanıt bekleme
  LoginModal.ts         giriş penceresi
  Paywall.ts            plan seçimi, fiyat okuma, kapatma
  PricingPage.ts        /pricing sayfası
tests/
  guest/                giriş gerektirmeyen testler
  authenticated/        giriş gerektiren testler
  perf/                 performans ölçümleri
  fixtures.ts           tarayıcı profilleri, çerez banner'ı engeli, demo etiketi
scripts/
  save-auth.mjs         tek seferlik giriş
  cookie-reload-check.mjs  çerez reddedilince sayfa yenileniyor mu kontrolü
browser-options.ts      Chrome başlatma ayarları ve demo yavaşlatması
playwright.config.ts    projeler, süre sınırları, video ve trace ayarları
.github/workflows/      her push'ta misafir testlerini çalıştıran CI
```

## Locator seçimi

Site bazı elemanlarda sabit `id` kullanıyor (`#chat-input-textarea`, `#model-select-trigger` gibi). Bunlar varsa öncelikle onlar kullanıldı. Diğer yerlerde erişilebilirlik rolleri (`getByRole`) tercih edildi. Bir gözlem olarak `assistant-message-container` id'si her mesajda tekrar ediyor. Bu yüzden yanıtlar her mesaja özel olan `data-message-id` ile seçiliyor.

## Notlar

- Çerez banner'ında "Decline all" seçilince site sayfayı baştan yüklüyor. Bu yenileme test sırasında açık pencereleri ve listeleri kapattığı için testlerde banner yüklenmiyor. Yine de görünürse otomatik kapatan bir yedek var.
- Her test kendi tarayıcı profiliyle açılıyor. Misafir testleri boş ve geçici bir profille, giriş gerektiren testler kayıtlı profille başlıyor. Chrome'un çeviri önerisi profilde kapatılıyor.
- Site ilk açılışta oturum yüklenince bir kez daha çiziliyor ve bu bitmeden yapılan tıklamalar kayboluyor. `ChatPage.waitForAppReady()` bunu bekliyor.
- Site yarım kalan mesajı taslak olarak saklıyor. Mesaj alanına yazan testler önce alanı temizliyor.
- Fiyatlar ziyaretçinin ülkesine göre farklı para biriminde geliyor. Türkiye'den bakınca ₺, ABD'deki CI sunucusundan bakınca $ görünüyor. Fiyat okuyan kodlar para biriminden bağımsız.
- Hiçbir testte "Subscribe Now"a basılmıyor ve satın alma yapılmıyor.
- Testler sırayla tek worker ile koşuyor. Böylece ücretsiz kota korunuyor ve sohbet testleri birbirini etkilemiyor.
