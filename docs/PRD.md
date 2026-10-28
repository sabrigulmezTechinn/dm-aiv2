# DM-AI — Ürün Gereksinimleri Dokümanı (PRD)

Sürüm 0.1 · Durum: MVP geliştirmede

## 1. Ürün özeti

DM-AI, mobil (iOS, Android) ve web üzerinde çalışan, yapay zekâ ile yönetilen bir Dungeons & Dragons 5e oyunudur. Oyuncu bir karakter yaratır, bir macera seçer ve masada insan bir Dungeon Master (DM) olmadan oynar. DM'in anlatıcı tarafını Claude üstlenir. Zar, can puanı, savaş ve seviye gibi tüm sayısal kurallar ise deterministik bir kural motorunda hesaplanır.

Oyunun görsel kimliği "dijital masa"dır. Kapalı mekânlar (taverna, zindan, mahzen, mağara) ve savaş alanları, üstten bakılan, hafif kabartmalı bir masa üstü harita olarak kodla çizilir. Oyuncu bu görünümü anlık olarak 2D ile 3D arasında değiştirebilir. Karakterin görmediği alanlar karanlıkta kalır.

## 2. Problem

- D&D oynamak isteyen pek çok kişi düzenli bir masa ve DM bulamıyor.
- Genel amaçlı sohbet botları DM olarak zayıf. Zarları uyduruyor, HP'yi unutuyor, kuralları esnetiyor, uzun kampanyalarda hafızayı kaybediyor.
- Mevcut AI DM ürünlerinin çoğu metin ağırlıklı, harita ya yok ya da düz 2D, mobil deneyim zayıf ve Türkçe desteği yok.

## 3. Hedef kitle

1. **Meraklı yeni başlayanlar**: D&D'yi hiç oynamamış, kuralları bilmeyen, şıklarla yönlendirilmek isteyen oyuncular. Kolay mod bunlar için.
2. **Masa bulamayan deneyimliler**: Kuralları bilen, serbest metinle oynamak ve tam 5e zorluğu isteyen oyuncular. Zor mod bunlar için.

## 4. Temel tasarım ilkeleri

1. **Anlatıcı sayılara sahip olmaz.** Yapay zekâ zar atmaz, HP değiştirmez, hasar hesaplamaz. Bunları yalnızca araçlar (tools) üzerinden ister; kural motoru doğrular, hesaplar, kayda geçirir.
2. **Oyuncu zarını kendisi atar.** Bir kontrol gerektiğinde akış durur, oyuncu zar düğmesine basar. Sonuç sunucuda üretilir, istemci o sonuca düşen animasyonu oynatır.
3. **Şıklar yol gösterir, sonucu garanti etmez.** Her şık hikâyeyi ilerletir ama bedelleri farklıdır. Bazısı kestirme, bazısı tuzak, bazısı ucuz ama riskli. Her şıkkın oyuncunun görmediği bir "sonuç notu" vardır.
4. **Eylemlerin kalıcı sonuçları vardır.** Kapanan kapılar, bozulan ilişkiler, kaybedilen fırsatlar kampanya durumuna yazılır ve unutulmaz.
5. **Ana yol asla kilitlenmez.** Yanlış seçimler işi zorlaştırır ama göreve giden en az bir yol her zaman açık kalır.
6. **Serbest metin her zaman açıktır.** Oyuncu şıkların dışında istediğini yazabilir, DM niyeti yorumlar.
7. **Harita ve anlatı tutarlıdır.** DM, haritanın yapısal özetini görür. Ekranda şömine kuzeydeyse anlatıda da kuzeydedir.

## 5. Kapsam

### 5.1 MVP (Faz 1, solo)

- Anonim hesap, cihazda saklanan oturum.
- Karakter oluşturma: ırk, sınıf, yetenek puanları (standart dizi, puan satın alma, zar), beceri seçimi, başlangıç ekipmanı, renk.
- Karakterler hesaba bağlıdır, kampanyadan bağımsızdır, farklı kampanyalarda tekrar kullanılabilir.
- Karakter ölümü kalıcıdır. Ölen karakter "düştü" olarak arşivlenir, kampanya biter.
- Hazır maceralar (modüller) ile kampanya başlatma, zorluk seçimi (kolay, zor).
- AI DM: anlatı, NPC diyaloğu, niyet yorumlama, kontrol isteme, şık üretme, sahne değiştirme, savaş başlatma, ödül ve XP verme, görev ve NPC hafızası.
- Kural motoru: SRD 5.1 alt kümesi, seviye 1–5.
- Harita: kapalı mekân ve savaş için prosedürel ızgara harita, görüş alanı, sis (fog of war), 2D/3D anlık geçiş, dokunarak hareket.
- Açık alanlarda harita gizlenir, yerini sahne kartı alır.
- Sıra tabanlı savaş: inisiyatif, aksiyonlar, büyüler, düşman yapay zekâsı, ölüm kurtarma zarları.
- Günlük: görevler, tanışılan NPC'ler ve tutumları, önemli olaylar.
- Türkçe ve İngilizce arayüz. DM oyuncunun seçtiği dilde anlatır.

### 5.2 Kapsam dışı (sonraki fazlar)

- **Faz 2, Co-op**: Aynı kampanyada birden çok oyuncu. Önce asenkron (sırayla), sonra gerçek zamanlı.
- **Faz 3, Ses**: DM anlatısının sesli okunması, sesle komut.
- **Faz 4, Gelir modeli**: Henüz karar verilmedi. Pazar araştırması, tur kotalı aboneliğin kullanıcıyı yorduğunu gösteriyor.
- Serbest sandbox kampanyası (AI'ın sıfırdan dünya üretmesi).
- Seviye 6 ve üstü, tüm SRD sınıf ve büyüleri.
- Kullanıcı tarafından macera yazma aracı.

## 6. Kullanıcı akışları

### 6.1 İlk açılış
1. Uygulama açılır, cihaz için anonim hesap oluşturulur.
2. Dil cihazdan alınır, ayarlardan değiştirilebilir.
3. Ana ekran: "Devam et" (aktif kampanyalar), "Yeni macera", "Karakterlerim".

### 6.2 Karakter oluşturma
1. İsim ve renk.
2. Irk seçimi (kısa açıklama ve bonuslar).
3. Sınıf seçimi (rol, zorluk etiketi, başlangıç HP).
4. Yetenek puanları: standart dizi (varsayılan), puan satın alma (27 puan) veya 4d6 en düşük atılır.
5. Beceri seçimi (sınıfın izin verdiği sayıda).
6. Özet ve kaydet. Ekipman sınıfa göre otomatik gelir.

### 6.3 Yeni kampanya
1. Karakter seç (yaşayan ve başka aktif kampanyada olmayan).
2. Macera seç.
3. Zorluk seç: Kolay veya Zor.
4. DM açılış sahnesini anlatır.

### 6.4 Oyun döngüsü
1. DM anlatır. Kapalı alandaysa üstte harita, altta anlatı akışı görünür.
2. DM 0–4 şık sunabilir. Oyuncu şık seçer, serbest metin yazar veya haritada hareket eder.
3. DM bir kontrol isterse anlatı durur, "Zar at" düğmesi çıkar. Kolay modda DC görünür, zor modda görünmez.
4. Sonuç anlatıya döner, durum (HP, envanter, görevler) güncellenir.

### 6.5 Savaş
1. DM savaşı başlatır. Düşmanlar haritaya yerleşir, inisiyatif atılır.
2. Harita savaş moduna geçer: sıra şeridi, düşman kartları, HP barları.
3. Oyuncunun sırası: hareket (karoya dokun), aksiyon (Saldır, Büyü, Koş, Kaçın, Geri Çekil, Eşya), sıra bitir.
4. Düşman sıraları kural motoru tarafından oynanır.
5. Her tur sonunda DM mekanik olayları kısa ve canlı biçimde anlatır.
6. Tüm düşmanlar düştüğünde veya kaçtığında savaş biter, XP verilir.
7. Oyuncu 0 HP'ye düşerse sırası geldiğinde ölüm kurtarma zarı atar. Kolay modda 2 başarı, zor modda 3 başarı ile stabilize olur. 3 başarısızlık ölümdür.

## 7. Zorluk modları

| Konu | Kolay | Zor |
|---|---|---|
| Kontrol DC'si | DM'in verdiği DC − 2 | DM'in verdiği DC |
| DC oyuncuya gösterilir mi | Evet | Hayır |
| Düşman HP'si | %75 | %100 |
| Stabilize olmak için başarı | 2 | 3 |
| Şıklarda kontrol ipucu | Beceri ve DC gösterilir | Sadece beceri |
| DM tonu | Affedici, ipucu verir | Kurallara sıkı bağlı, ipucu az |

## 8. AI DM mimarisi

- **Model**: Claude (varsayılan `claude-opus-5-5`, ortam değişkeniyle değiştirilebilir). Uyarlanabilir düşünme, efor ayarı ortam değişkeninden.
- **Araç tabanlı döngü**: DM her kararı yapısal araçlarla verir. Araçlar: kontrol iste, şık sun, savaşı başlat, hasar/iyileştirme uygula, eşya ver/al, altın ver, XP ver, NPC kaydet, görev güncelle, olay kaydet, sahne değiştir, dinlenme izni ver, kampanyayı bitir.
- **Duraklatan araçlar**: Kontrol isteme ve şık sunma, oyuncu cevap verene kadar turu bitirir. Oyuncunun cevabı bir sonraki mesajda aracın sonucu olarak döner. Böylece konuşma geçmişi yalnızca sona eklenir, hiç düzenlenmez.
- **Durum bağlamı**: Her oyuncu mesajına güncel durum (HP, konum, görünen harita özeti, savaş durumu, aktif görevler) eklenir.
- **Önbellek**: Sistem istemi ve araç tanımları sabittir, önbelleğe alınır.
- **Uzun kampanyalar**: Sunucu tarafı bağlam sıkıştırma (compaction) ile.
- **Güvenlik ağı**: Reddedilen istekler için sunucu tarafı yedek model (fallbacks), reddetme durumunda oyuncuya nazik bir mesaj.
- **Akış**: Anlatı metni istemciye parça parça akar (NDJSON).
- **Mock DM**: API anahtarı olmadan geliştirme ve test için kurallı, betikli bir sahte DM.

## 9. Harita sistemi

- Izgara tabanlı, 1 karo = 5 ft.
- Mekân tipleri: taverna, zindan, mahzen, mağara, savaş alanı (açık alan çatışması).
- Prosedürel üretim tohum (seed) ile deterministiktir. Zindan ve mağara için rot.js algoritmaları, taverna için şablon.
- Dekor: bar tezgâhı, masa, sandalye, şömine, fıçı, sandık, yatak, merdiven, sunak, heykel, sütun, moloz, meşale, ağaç, kaya.
- Görüş: hassas gölge düşürme (shadowcasting), ışık yarıçapı. Karo durumları: keşfedilmemiş (siyah), keşfedilmiş (loş), görünür.
- Render: Three.js, tek sahne iki kamera pozu. 3D modda eğik kamera, ışık ve gölge, duvarlar yüksek. 2D modda tepeden kamera, duvarlar basık, gölge yok. Geçiş animasyonludur.
- Mobilde harita bir Expo DOM bileşeni olarak çalışır. Web ve mobilde aynı kod kullanılır.
- DM'e haritanın metin özeti verilir: odalar, yönler, dekor, çıkışlar, görünen varlıklar.

## 10. Kural motoru (SRD 5.1 alt kümesi)

- Irklar: İnsan, Elf (Yüksek), Cüce (Tepe), Buçukluk (Hafifayak), Yarı-Ork.
- Sınıflar: Savaşçı, Haydut, Büyücü, Rahip. Seviye 1–5.
- 18 beceri, 6 yetenek, kurtarma zarları, yeterlilik bonusu.
- Silahlar, zırhlar, kalkan, iyileşme iksiri ve temel malzemeler.
- Büyüler: Fire Bolt, Magic Missile, Sleep, Shield, Burning Hands, Sacred Flame, Cure Wounds, Healing Word, Guiding Bolt, Bless.
- Canavarlar: Goblin, Kobold, Dev Sıçan, Kurt, İskelet, Zombi, Haydut, Haydut Lideri, Ork, Tarikatçı, Dev Örümcek, Ogre.
- Koşullar: Yere düşmüş, zehirlenmiş, bilinçsiz, kaçınıyor, uyuyor, kutsanmış.
- Dinlenme: kısa (vuruş zarı) ve uzun.
- XP ve seviye atlama otomatik.

## 11. Teknik mimari

- **Monorepo** (pnpm): `packages/shared`, `packages/rules`, `packages/mapgen`, `apps/server`, `apps/mobile`.
- **Sunucu**: Node.js, Hono, SQLite (`node:sqlite`), Anthropic TypeScript SDK. Sunucu otoriterdir; co-op için hazırdır.
- **İstemci**: Expo (React Native + web), expo-router, Three.js (DOM bileşeni).
- **Test**: Vitest. Kural motoru, harita, sunucu tur akışı (mock DM ile).

## 12. Başarı ölçütleri (MVP)

- Bir oyuncu kayıt olmadan 3 dakika içinde karakter yaratıp ilk sahneye ulaşabilir.
- Bir macera baştan sona (yaklaşık 1–2 saat) hatasız oynanabilir.
- DM, oturumlar arasında NPC'leri ve kararları hatırlar.
- Kural motoru testleri yeşil; DM hiçbir zaman HP veya zarı kendi belirlemez.
- Harita web ve mobilde 2D/3D geçişi ile akıcı çalışır.

## 13. Riskler

| Risk | Etki | Önlem |
|---|---|---|
| Expo'da Three.js performansı | Yüksek | DOM bileşeni (WebView) yaklaşımı, düşük poligon, gerekirse 2D'ye otomatik düşme |
| AI maliyeti | Yüksek | Önbellek, efor ayarı, sıkıştırma, savaş turlarını toplu anlatma |
| AI tutarsızlığı | Orta | Yapısal durum, araç doğrulama, harita özeti |
| Reddetme (refusal) | Düşük | Sunucu tarafı fallback, oyuncuya kibar mesaj |
| İçerik lisansı | Orta | Yalnızca SRD 5.1 (CC-BY-4.0), atıf dosyası |

## 14. Lisans ve atıf

Bu çalışma, Wizards of the Coast LLC tarafından yayımlanan System Reference Document 5.1 içeriğini içerir ve Creative Commons Attribution 4.0 International lisansı altındadır. Ayrıntılar `docs/ATTRIBUTION.md` dosyasındadır.
