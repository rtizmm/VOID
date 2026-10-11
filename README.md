# VOID — Evrenin Ötesinde 🌌

Türkçe Three.js Güneş Sistemi keşif sitesi ve etkileşimli, bilimsel ilkelere dayalı **Olasılık Laboratuvarı**.

## Özellikler

- Güneş ve 8 gezegen, Satürn halkaları, gezegen seçimi, kamera yaklaşması
- Serbest kamera ve WASD / Q-E uçuş kontrollü kokpit
- Gezegen bilgi panelleri ve animasyon hız kontrolleri
- **Simülasyon sekmesi**: Güneş'in yok oluşu (8 dakika 20 saniyelik sinyal gecikmesi), %0–%700 yüzey yerçekimi, asteroit çapı/hızı, ışık hızının %10–%99'u ile varsayımsal iğne veya dağ
- Sayısal enerji / ivme hesapları, NASA ve CERN kaynak bağlantıları
- Olaylar için **temsili** 3D animasyonlar ve ayrı belirsizlik uyarıları
- Mobil uyum ve erişilebilir kontroller

## Bilimsel sınırlamalar

**Bu ürün bilimsel araştırma simülatörü değil, etkileşimli eğitim demosudur.**

- Uzaydaki gök cisimlerinin boyut, mesafe ve yörüngeleri ölçekli değil.
- Güneş'in yokluğu senaryosunda 8 dk 20 sn gecikme fiziksel referanstır; 3D hareket tam N-cisim simülasyonu değildir.
- Yerçekimi hesapları yalnızca sabit dikey ivme kullanır. Ekosistem, vücut, atmosfer ve binaları modellemez.
- Asteroit enerjisi yaklaşık küresel kayaç yoğunluğu 3000 kg/m³ ve ½mv² ile hesaplanır; yerel koşullar, parçalanma ve krater etkileri yoktur.
- Işığa yakın hız için özel göreliliğin E=(γ−1)mc² hesabı kullanılır; kütleli nesneler c hızına erişemez.
- **Hayatta kalan / yaşamını yitiren insan sayısı tahmin edilmez.** Bu tür sonuçlar için konumsal, iklimsel ve afet-özel veriler gerekir.

Kaynaklar:
- [NASA — Gravity](https://gracefo.jpl.nasa.gov/news/5/what-is-gravity/)
- [NASA — Asteroid Facts](https://science.nasa.gov/solar-system/asteroids/facts/)
- [CERN — Special relativity](https://cds.cern.ch/record/2928188)

## Lokal çalıştırma

Node.js 22+ önerilir.

```bash
npm install
npm test
npm run dev
```

## GitHub Pages

GitHub Actions `main` dalındaki her değişiklikte testleri çalıştırır, Vite derler ve `dist` klasörünü yayınlar. Settings → Pages → Source: **GitHub Actions** olmalıdır.

**Canlı site:** https://rtizmm.github.io/VOID/

## Yapı

- `src/main.js`: 3D sahne, gezegenler, kamera
- `src/sim.js`: senaryo kontrolleri, olay animasyonları ve sonuçlar
- `src/physics.js`: testlenebilir basitleştirilmiş fizik hesapları
- `src/sim.css`: simülasyon paneli tasarımı
- `src/data.js`: Türkçe gezegen verileri
