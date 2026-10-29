# DM-AI

Yapay zekâ Zindan Efendisi (Dungeon Master) ile oynanan, mobil ve web tabanlı bir D&D 5e oyunu. Anlatıcıyı Claude üstlenir; zar, can puanı, savaş ve seviye gibi tüm sayılar deterministik bir kural motorunda hesaplanır. Kapalı mekânlar ve savaşlar, kodla çizilen, 2D ile 3D arasında anlık geçiş yapılabilen bir "dijital masa" haritasında oynanır.

- Ürün gereksinimleri: [docs/PRD.md](docs/PRD.md)
- Özellik seti ve fazlar: [docs/FEATURES.md](docs/FEATURES.md)
- SRD 5.1 atfı: [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md)

## Proje yapısı

| Yol | İçerik |
|---|---|
| `packages/shared` | Ortak tipler (karakter, harita, savaş, tur olayları) |
| `packages/rules` | Kural motoru: zar, ırklar, sınıflar, eşyalar, büyüler, canavarlar, kontroller, savaş ve düşman yapay zekâsı |
| `packages/mapgen` | Prosedürel harita (taverna, zindan, mahzen, mağara, savaş alanı), görüş alanı, sis, DM için harita özeti |
| `apps/server` | Hono API, SQLite kayıt, anonim oturum, maceralar, Claude araç döngüsüyle çalışan DM |
| `apps/mobile` | Expo uygulaması (iOS, Android, web), Three.js harita |

## Gereksinimler

- Node.js 22.13 veya üstü (sunucu yerleşik `node:sqlite` kullanır)
- pnpm 10

## Kurulum

```bash
git clone https://github.com/sabrigulmezTechinn/dm-aiv2
cd dm-aiv2
corepack enable
pnpm install
```

`corepack enable` hata verirse `npm install -g pnpm` kullanın.

İsteğe bağlı olarak kök klasörde bir `.env` dosyası oluşturun (`.env.example` dosyasını kopyalayın; Windows'ta `copy .env.example .env`). `ANTHROPIC_API_KEY` boş kalırsa ya da `.env` hiç yoksa sunucu, internetsiz çalışan kurallı bir sahte DM (mock) ile açılır. Gerçek Claude anlatımı için anahtarı girin.

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `ANTHROPIC_API_KEY` | boş | Claude API anahtarı |
| `DM_PROVIDER` | anahtar varsa `anthropic`, yoksa `mock` | DM sağlayıcısını zorla |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | Kullanılacak model |
| `DM_EFFORT` | `medium` | Düşünme eforu: `low`, `medium`, `high`, `xhigh`, `max` |
| `PORT` | `8787` | API portu |
| `DATABASE_PATH` | `./data/dmai.db` | SQLite dosyası (`apps/server` klasörüne göre) |
| `WEB_DIST` | boş | Dışa aktarılmış web uygulamasını API ile aynı porttan sun |

Uygulamanın bağlanacağı adres (`EXPO_PUBLIC_API_URL`) kök `.env` dosyasında değil, `apps/mobile/.env` dosyasında verilir; bkz. `apps/mobile/.env.example`.

## Çalıştırma

**Bilgisayarın tarayıcısında (en kolay):**

```bash
pnpm build:web
pnpm start
```

Tarayıcıda http://localhost:8787 adresini açın.

**Geliştirme modu (kod değiştikçe yenilenir), iki terminal:**

```bash
pnpm dev:server
pnpm dev:web
```

### Telefonda deneme

Telefon ve bilgisayar aynı Wi-Fi ağında olmalı. Bilgisayarın yerel IP adresini öğrenin (Windows'ta `ipconfig`, Mac'te `ipconfig getifaddr en0`; ör. `192.168.1.20`). Windows güvenlik duvarı sorarsa Node.js'e özel ağ izni verin.

**Telefon tarayıcısıyla:** `pnpm build:web` ve `pnpm start` çalıştırın, telefonda `http://192.168.1.20:8787` adresini açın.

**Expo Go ile (gerçek mobil uygulama):**

1. Telefona Expo Go uygulamasını kurun.
2. `apps/mobile/.env` dosyası oluşturup içine `EXPO_PUBLIC_API_URL=http://192.168.1.20:8787` yazın.
3. Bir terminalde `pnpm dev:server`, diğerinde `pnpm dev:app` çalıştırın.
4. Çıkan QR kodu Expo Go ile (iPhone'da kamera uygulamasıyla) okutun.

Android emülatörü varsayılan olarak `10.0.2.2` adresini kullanır. Harita Expo Go'da görünmezse bir development build gerekir (`npx expo run:android` / `run:ios`).

## Test

```bash
pnpm typecheck
pnpm test
```

Testler kural motorunu, harita üretimini, sunucu uçlarını, DM araç döngüsünü (sahte bir modelle; ağ hatası, reddetme ve geçersiz araç girdisi dahil) ve sahte DM ile baştan sona oynanan maceraları kapsar. Her oyunda Claude mesaj protokolü (her `tool_use` için bir sonraki kullanıcı mesajında `tool_result`) doğrulanır.

## AI DM nasıl çalışır

- Her DM yanıtı bir "tur bitiren" araçla biter: `present_choices` (anlatı + 0–4 şık) veya `request_check` (anlatı + zar isteği). Anlatı metni bu araçların içinde taşınır ve istemciye NDJSON olarak parça parça akar.
- Mekanik değişiklikler doğrulanmış araçlarla yapılır: `start_combat`, `apply_damage`, `give_item`, `award_xp`, `update_npc`, `update_quest`, `record_fact`, `change_scene`, `rest`, `end_adventure` ve diğerleri. Sayıları her zaman kural motoru üretir.
- Şıkların her birinin oyuncuya gösterilmeyen bir "sonuç notu" vardır; oyuncu seçtiğinde bu not DM'e geri verilir.
- Konuşma geçmişi yalnızca sona eklenir, hiç düzenlenmez. Sistem istemi ve araçlar sabit olduğu için istem önbelleği çalışır. Uzun kampanyalarda sunucu tarafı sıkıştırma (compaction), reddetmelerde sunucu tarafı yedek model (`fallbacks: "default"`) kullanılır.
- Savaşı motor yönetir; DM her tur sonunda olayları kısaca anlatır. Oyuncu kendi zarlarını atar, sonuç sunucuda üretilir ve istemcide canlandırılır.

## Bilinen sınırlamalar

- Gerçek Claude API çağrısı bu geliştirme ortamında denenmedi (API anahtarı yok). Kod, SDK tipleriyle derleniyor ve aynı döngü sahte modellerle test edildi.
- Uygulama web'de Playwright ile uçtan uca denendi; iOS ve Android cihazlarda henüz denenmedi. Harita, Expo DOM bileşeni olarak mobilde WebView içinde çalışır; Expo Go'da sorun çıkarsa bir development build (`npx expo run:android` / `run:ios`) kullanın.
- Co-op, sesli anlatım ve gelir modeli sonraki fazlardadır (bkz. PRD).
