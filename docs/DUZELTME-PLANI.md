# DM-AI — Düzeltme Planı

Sürüm 1 · Tarih: 14 Kasım 2026 · Kaynak: uçtan uca test raporu

Bu plan, oyunun API hariç baştan sona test edilmesiyle bulunan sorunları ve çözüm yollarını içerir. Sorunlar üç faza ayrılmıştır. Faz 1 hemen başlayabilir; Faz 2 için iki ürün kararı gerekir (bkz. "Kararlar").

## Test özeti

| Test | Sonuç |
|---|---|
| Tip kontrolü ve 49 otomatik test | Hepsi geçti |
| iOS ve Android paket derlemesi | Hatasız |
| Motor üzerinden 320 otomatik oyun (4 sınıf, 2 macera, 2 zorluk) | 0 iç hata |
| Tarayıcıda 46 kontrol (telefon ve masaüstü, Türkçe ve İngilizce) | 45 geçti |

320 oyunluk simülasyonda macerayı kazanma oranları:

| Sınıf | Kolay | Zor |
|---|---|---|
| Savaşçı | 17/40 | 1/40 |
| Haydut | 25/40 | 0/40 |
| Büyücü | 21/40 | 0/40 |
| Rahip | 14/40 | 0/40 |

Not: Simülasyonda anlatıyı sahte DM üretti ve maceraların önerdiği karşılaşmaları birebir kullandı. Gerçek Claude ile oranlar farklı olabilir; ancak macera metinleri aynı güçlü karşılaşmaları önerdiği için sorun büyük ölçüde geçerlidir.

## Genel bakış

| # | Sorun | Öncelik | Faz | Boyut |
|---|---|---|---|---|
| 1 | Telefonda Gönder düğmesi ekran dışında | Yüksek | 1 | Küçük |
| 2 | Açılışta DM hata verirse kampanya kilitleniyor | Yüksek | 1 | Orta |
| 3 | Oyun ortasında DM düşerse oyuncunun mesajı kayboluyor | Orta | 1 | 2 ile birlikte |
| 4 | Oyun çok zor | Yüksek | 2 | Büyük |
| 5 | Seviye atlama çok yavaş | Orta | 2 | Orta |
| 6 | Zindan ve mahzen haritaları çok karanlık | Orta | 3 | Küçük |
| 7 | Türkçe arayüzde İngilizce kalıntılar | Düşük | 3 | Küçük |
| 8 | Yenilgide yeşil "çatışma sona erdi" satırı | Düşük | 3 | Küçük |
| 9 | Yaşayan karakter silinemiyor | Düşük | 3 | Küçük |
| 10 | Bağlantı hatasında belirsiz mesaj | Düşük | 3 | Küçük |
| 11 | Karakter kağıdında HP çubuğu hep kırmızı | Düşük | 3 | Küçük |

---

## Faz 1: Kritik hatalar

### 1. Telefonda Gönder düğmesi ekran dışında

- **Belirti:** 360–414 piksel genişliğindeki telefonlarda Gönder düğmesi sağdan taşıyor, sayfa yana kayıyor. Ölçümde sayfa genişliği 422 piksele çıkıyor.
- **Kök neden:** Dinlenme düğmesine "Dinlen" yazısı eklendi. Ayrıca web'de yazı kutusunun varsayılan bir en küçük genişliği var ve satırda küçülemiyor.
- **Etkilenen dosya:** `apps/mobile/src/components/play/ActionPanel.tsx`.
- **Çözüm:**
  - Dinlenme düğmesi tekrar sadece ikon olacak; ekran okuyucu için "Dinlen" etiketi kalacak.
  - Yazı kutusu dar ekranda küçülebilecek.
- **Kabul ölçütü:** 320, 360, 375, 390 ve 414 piksel genişliklerde sayfa yana kaymıyor ve Gönder düğmesi tamamen görünüyor.

### 2 ve 3. DM hatalarında kurtarma

- **Belirti (2):** DM açılış anlatısında yanıt veremezse "Devam" düğmesi çıkmıyor, açılış tekrar denenemiyor. Oyuncu bir şey yazarsa DM'e macera bilgisi ve dil ayarı hiç gitmiyor. Gerçek API'de tek bir anlık ağ hatası kampanyayı kalıcı olarak bozar.
- **Belirti (3):** Oyun ortasında DM düşerse oyuncunun yazdığı DM'e ulaşmıyor. "Devam" genel bir "oyuncu bekliyor" mesajı gönderiyor. Oyuncu tekrar yazınca mesaj günlükte iki kez görünüyor.
- **Kök neden:** `apps/server/src/game/engine.ts` içinde:
  - Açılış, tur sayacını model çağrısından önce 1 yapıyor. Çağrı başarısız olunca bu durum kaydediliyor ve açılış bir daha kabul edilmiyor.
  - İlk model çağrısı başarısız olursa DM'e gidecek mesaj hiçbir yerde saklanmıyor.
  - "Devam" düğmesi sadece bekleyen araç sonuçları varsa görünüyor.
- **Çözüm:**
  - İlk model çağrısı başarısız olursa sunucu gönderilecek mesajı olduğu gibi kampanya durumuna kaydedecek. Açılışta bu mesaj macera kurulumunu da içeriyor.
  - "Devam" yerine "Tekrar dene" düğmesi çıkacak ve kayıtlı mesajı aynen yeniden gönderecek.
  - Tekrar deneme bekleyen bir mesaj varken yazı kutusu kilitlenecek.
  - Oyuncunun mesajı günlüğe yalnızca bir kez yazılacak.
- **Kabul ölçütü:**
  - Açılış başarısız olursa "Tekrar dene" ile oyun normal başlıyor ve DM'e giden ilk mesajda macera kurulumu var.
  - Oyun ortası hatada oyuncunun yazdığı DM'e ulaşıyor ve günlükte çift görünmüyor.
  - Bu durumlar için kalıcı otomatik testler eklenmiş.

---

## Faz 2: Denge ve ilerleme

### 4. Oyun çok zor

- **Belirti:** Kolay modda oyunların yaklaşık yarısı ölümle bitiyor. Zor modda 160 oyunda yalnızca 1 zafer var. Rahip, kolay modda ilk karşılaşmada iki dev sıçana yenildi.
- **Kök neden:**
  - Macera metinlerindeki karşılaşmalar tek kişilik seviye 1 karakter için çok güçlü. Örneğin finalde Varek'e Eşkıya Reisi değerleri (CR 2, yaklaşık 65 HP) ve yanında 2 zombi veriliyor. Kayıp Kervan'da 59 HP'lik bir ogre var.
  - Savaş başlatma aracı, karşılaşmanın karakter için ne kadar zor olduğunu hiç denetlemiyor.
  - Ölüm kurtarmaları kolay modda da öldürücü.
- **Etkilenen dosyalar:** Macera tanımları (`apps/server/src/adventures/`), savaş başlatma aracı (`apps/server/src/dm/tools.ts`), canavar verisi ve savaş kuralları (`packages/rules`).
- **Çözüm:**
  1. **Maceraları yeniden dengeleme:**
     - Söğütlü Han, mahzen: 1 dev sıçan.
     - Söğütlü Han, tüneller: 1 tarikatçı ve 1 iskelet.
     - Söğütlü Han, final: Varek'e özel, daha zayıf bir canavar profili (yaklaşık CR 1/2, 22 HP) ve yanında tek zombi.
     - Kayıp Kervan, yol: tek kurt; zor modda iki kurt.
     - Kayıp Kervan, goblin mağarası: 2 goblin ve Skrag.
     - Kayıp Kervan, ogre: doğrudan dövüş yerine pazarlık, tuzak ya da goblinlerle ittifakla aşılabilen bir engel olacak.
  2. **Karşılaşma bütçesi:** Sunucu, DM'in başlattığı her savaşın toplam XP'sini 5e karşılaşma eşikleriyle karşılaştıracak. Kullanılacak eşik karakterin seviyesine ve zorluk moduna göre belirlenecek. Bütçe aşılırsa düşman sayısı azaltılacak ve DM'e "karşılaşma hafifletildi" bilgisi dönülecek. Böylece gerçek Claude da fazla güçlü bir karşılaşma kuramaz.
  3. **Kolay modda hayatta kalma:**
     - Başlangıçta 2 iyileşme iksiri verilecek.
     - Kısa dinlenmede tüm can zarları kullanılabilecek.
     - Ölüm kurtarmasında doğal 1 tek başarısızlık sayılacak.
     - Kalıcı ölüm konusu için bkz. Karar A.

### 5. Seviye atlama çok yavaş

- **Belirti:** 320 oyunda en fazla seviye 2'ye çıkıldı. Seviye 1–5 için hazırlanan sınıf özelliklerinin çoğu (Aksiyon Atağı, Ek Saldırı, 2. ve 3. seviye büyüler) oyunda hiç görülmüyor.
- **Kök neden:** XP yalnızca savaşlardan ve DM'in takdirine bağlı ödüllerden geliyor.
- **Çözüm:** Her yeni macera bölgesine ilk girişte sunucu otomatik bir kilometre taşı XP'si verecek. Hedef: maceranın ortasında seviye 2, final dövüşünden önce seviye 3.

### Ölçüm ve hedefler

Bu testte kullanılan denge simülatörü projeye kalıcı bir komut olarak eklenecek. Ayarlar aşağıdaki hedefler tutana kadar yapılacak.

| Ölçüt | Kolay | Zor |
|---|---|---|
| Macerayı kazanma oranı | %85 ve üstü | %35–55 |
| İlk savaşta ölüm | %3'ün altı | %15'in altı |
| Final öncesi ortalama seviye | 3 | 3 |

---

## Faz 3: Cilalama ve güvence

### 6. Zindan ve mahzen haritaları çok karanlık

- **Kök neden:** Karanlık haritalarda taban ışık şiddeti düşük, oyuncunun meşale ışığının yarıçapı kısa. Keşfedilmiş ama şu an görünmeyen karolar %30 parlaklıkta çiziliyor.
- **Etkilenen dosya:** `apps/mobile/src/components/map/board.ts`.
- **Çözüm:** Taban ışığı ve meşale ışığı artırılacak. Keşfedilmiş ama görünmeyen alanlar biraz daha parlak çizilecek.
- **Kabul ölçütü:** Telefon ekran görüntüsünde görünen karoların ortalama parlaklığı belirlenen eşiğin üstünde.

### 7. Türkçe arayüzde İngilizce kalıntılar

- **Kalıntılar:**
  - Karakter kağıdında INIT, PROF, ft, "melee" ve zırhlardaki "AC".
  - Ayarlarda "Mock (offline)".
  - Macera NPC adı "Old Tobin".
- **Çözüm:**
  - Hepsi çeviri sözlüğüne taşınacak.
  - Macera NPC adları ve açıklamaları iki dilli olacak, örneğin "Yaşlı Tobin".
  - Türkçe ekranlarda bilinen İngilizce kelimeleri arayan otomatik bir kontrol eklenecek.

### 8. Yenilgide yeşil "çatışma sona erdi" satırı

- **Kök neden:** Savaş bitişi her sonuçta "iyi" tonla yazılıyor.
- **Çözüm:** Zafer dışındaki sonuçlarda satır nötr ya da kırmızı olacak.

### 9. Yaşayan karakter silinemiyor

- **Çözüm:** Karakter sayfasına onaylı bir "Sil" düğmesi eklenecek. Macerada olan karakter için düğme kapalı olacak ve nedenini gösterecek. Sunucu tarafı zaten bu durumu reddediyor.

### 10. Bağlantı hatasında belirsiz mesaj

- **Çözüm:** Ağ hatasında "Sunucuya ulaşılamadı" mesajı ve "Tekrar dene" düğmesi gösterilecek.

### 11. Karakter kağıdında HP çubuğu hep kırmızı

- **Çözüm:** Oyun ekranındaki gibi doluluk oranına göre yeşil, sarı ya da kırmızı olacak.

### Kalıcı güvence

- Bu testte kullanılan tarayıcı senaryoları ve denge simülatörü projeye eklenecek.
- Her PR'da tip kontrolünü, testleri ve telefon genişliği kontrolünü çalıştıran bir GitHub Actions iş akışı kurulacak. Gönder düğmesindeki gerileme böyle bir kontrolle yakalanırdı.

---

## Kararlar

| Karar | Seçenekler | Öneri |
|---|---|---|
| A. Kolay modda kalıcı ölüm | (1) Kolay modda ölüm yok: 0 HP'de bayılma, düşmanlar kazanırsa esir düşme. (2) Ölüm kalıcı ama ölüm kurtarmaları daha affedici. | (1). Yeni başlayanlar için daha uygun. Zor mod kalıcı ölümü korur. PRD'deki "karakter ölünce biter" kararı yalnızca zor mod için geçerli olur. |
| B. Macera karşılaşmalarının değiştirilmesi | Faz 2'deki listeye göre değiştir ya da yalnızca karşılaşma bütçesine güven. | İkisini birlikte yapmak. Bütçe tek başına hikâye metniyle çelişen karşılaşmalar üretebilir. |

## Kullanıcıda kalan doğrulamalar

- **Gerçek Claude testi:** API anahtarıyla 20–30 turluk bir test oyunu oynanmalı. Tur başına süre ve token maliyeti kaydedilecek; bunun için sunucuya kayıt eklenecek.
- **Cihaz testi:** Uygulama bir iPhone'da Expo Go ile açılmalı. Harita Expo Go'da görünmezse development build hazırlanacak.

## Sıralama ve durum

- [x] Faz 1: Gönder düğmesi taşması
- [x] Faz 1: DM hatalarında kurtarma
- [x] Karar A ve B (A: kolay modda ölüm yok, bayılma/esir; B: ikisi birlikte)
- [x] Faz 2: Maceraları yeniden dengeleme
- [x] Faz 2: Karşılaşma bütçesi
- [x] Faz 2: Kolay modda hayatta kalma
- [x] Faz 2: Kilometre taşı XP'si
- [ ] Faz 2: Simülatör hedeflerinin tutması (kısmen, bkz. aşağıda)
- [x] Faz 3: Karanlık haritalar
- [x] Faz 3: Türkçe kalıntılar
- [x] Faz 3: Yenilgi satırı, karakter silme, bağlantı mesajı, HP çubuğu rengi
- [x] Faz 3: Test senaryoları ve CI
- [ ] Gerçek Claude ve iPhone testi (kullanıcıda; tur başına süre ve token kaydı sunucuya eklendi)

### Simülatör sonucu (`pnpm sim`, 320 oyun)

| Sınıf | Kolay: kazanma / ilk savaşta ölüm / finalde seviye | Zor: kazanma / ilk savaşta ölüm / finalde seviye |
|---|---|---|
| Savaşçı | %100 / %0 / 3 | %78 / %8 / 3 |
| Haydut | %100 / %0 / 3 | %57 / %0 / 3 |
| Büyücü | %100 / %0 / 3 | %43 / %5 / 3 |
| Rahip | %100 / %0 / 3 | %43 / %10 / 3 |

Tutmayan hedef: zor modda Savaşçı ve Haydut kazanma oranı %35–55 aralığının üstünde. Fark sınıflar arası güçten geliyor; karşılaşmaları zorlaştırmak önce büyücüleri etkiliyor. Kapatmak için sınıfa özel bir ürün kararı gerekiyor.

Plandan sapma: kolay moddaki tasarlanmış karşılaşmalar 5e "orta" bütçesine sığacak şekilde biraz hafifletildi (tüneller: tek iskelet, final: yalnız Varek). Zor mod plandaki listeyi kullanıyor.
