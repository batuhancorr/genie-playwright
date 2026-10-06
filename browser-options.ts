// Demo videosunda iki sorun vardi:
// 1) Chrome'un "bu sayfayi cevir" balonu sayfanin sag ustunu kapatiyordu. macOS dili Turkce oldugu icin Chrome
//    Ingilizce sayfayi cevirmeyi oneriyor. Ceviri, profil ayarlariyla kapatilir (tests/fixtures.ts > disableTranslate).
// 2) Pencere her testte farkli yerde acilinca ekran kaydi takip edemiyordu. Pencere hep ayni yerde acilir.
export const BROWSER_ARGS = [
  '--disable-features=Translate,TranslateUI',
  '--lang=en-US',
  '--window-position=0,0',
];

// Demo kaydinda (npm run test:demo) adimlar izlenebilsin diye her islem biraz yavaslatilir.
export const DEMO_SLOWMO = process.env.VIDEO === 'on' ? 600 : 0;
