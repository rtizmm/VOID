# VOID — Kozmik Oyun Alanı

Türkçe, sahne odaklı Three.js uzay sandbox'ı. [Canlı site](https://rtizmm.github.io/VOID/).

## Deneyler
- Asteroit: 20 m–20 km çap, 11–70 km/sn hız.
- Göreli çarpışma: 1 g iğne, 1,5 ton otomobil veya 10¹² kg dağ; %10–%99,99 c.
- Ay çarpması: 1–100 km/sn.
- Güneş yokluğu: yaklaşık 500 saniye gecikme ve 30 güne kadar oyun zamanı.
- Yüzey yerçekimi: %0–%700, kurgusal 24 saat etkisi.
- Dev Güneş: 1–25 kat görsel boyut deneyi.

## Kontroller
Sürükle / tekerlek: yörünge kamerası. Sol alttaki mod düğmesi: serbest uçuş.
WASD hareket, Q/E yükselme-alçalma, Shift hızlanma, F odaklanma. Mobilde yön düğmeleri.
Panel düğmesi menüyü kapatır. Dünya düğmesi Dünya'ya döner; gezegen menüsü diğer rotaları açar.
Deneylerden kalan izler keşif sırasında korunur. Dünyayı sıfırla; hasarı, nüfusu ve çevresel değişimleri temizler.

## Model sınırları
Bu bir oyun modelidir; gerçek can kaybı tahmini veya tam fizik çözücüsü değildir.
Enerjiler ½mv² ve (γ−1)mc² ile hesaplanır; asteroid yoğunluğu 3000 kg/m³ alınır.
Boyutlar, mesafeler, efektlerin süreleri, krater ve enkaz ölçekleri temsilidir. Harita dokusu şematiktir.
İklim, atmosferde parçalanma, coğrafi nüfus dağılımı ve N-cisim mekaniği çözülmez.

Nüfus: varsayılan 8,5 milyar, kullanıcı girdisi; güncel nüfus iddiası değildir.
Çarpışma kaybı, yerel `min(.12, .025*(Mt/1e5)^.72)` ve küresel `clamp((log10(E)-21)/9,0,1)` oyun katsayılarının toplamıdır.
Maruziyet ve `1-.8*korunak_oranı` ile çarpılır; 0–1 aralığında tutulur.
2,24×10³² J ve üzerinde idealize parçalanma gösterilir; bu eşik tek başına gerçek parçalanma garantisi değildir.
Güneş yokluğu: ilk gün kayıp yok; sonraki günler +%3, üst sınır %95; korunak azaltır.
Yerçekimi: `min(.95, abs(g/100-1)*.12)` kurgusal 24 saat kaybı.
Dev Güneş: `min(1, (boyut-1)*.045)` kurgusal kayıp. Bu katsayılar bilimsel olarak kalibre edilmemiştir.

- [OpenStax: Göreli enerji](https://openstax.org/books/university-physics-volume-3/pages/5-9-relativistic-energy)
- [NASA: Gerçek asteroid tehlike modelleri](https://nas.nasa.gov/areas/atap.html)

## Geliştirme
Node.js 22+: `npm ci`, `npm test`, `npm run dev`, `npm run build`.
GitHub Pages kaynağı **GitHub Actions** olmalı; `main` değişiklikleri test ve build sonrası yayınlanır.

- `src/main.js`: gezegenler, kamera, ses ve uçuş
- `src/sim.js`: deney akışı, sabitlenmiş atış parametreleri, nüfus durumu
- `src/impact.js`: kalıcı krater, yüzey ısısı, enkaz ve parçalanma
- `src/physics.js`: enerji ve açıkça kurgusal nüfus hesabı
- `src/style.css`, `src/sim.css`: duyarlı, tek panelli arayüz
