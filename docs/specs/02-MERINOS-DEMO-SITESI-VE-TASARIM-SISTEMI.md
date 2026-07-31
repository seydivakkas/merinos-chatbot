# 02 — Merinos Demo Sitesi ve Tasarım Sistemi

> **Belge türü:** Cursor uygulama görevi  
> **Sıra:** 02/20  
> **Ön koşullar:** `00-PROJE-ANAYASASI.md` ve `01-REPO-VE-GELISTIRME-TEMELI.md` uygulanmış olmalıdır  
> **Ana çıktı:** Tutarlı, responsive, erişilebilir ve sürdürülebilir Merinos localhost demo sitesi  
> **Kapsam dışı:** Chatbot iş mantığının yeniden yazılması, gerçek Merinos API entegrasyonu, gerçek müşteri verisi ve production deployment

---

## 1. Görevin amacı

Bu adımın amacı mevcut Merinos Chatbot demosunu sıfırdan farklı bir uygulamaya
çevirmek değildir. Amaç, çalışan siteyi kurumsal bir e-ticaret vitrini gibi
algılanan; tasarım kuralları açık, bileşenleri yeniden kullanılabilir, mobilde
rahat çalışan ve chatbot deneyimini destekleyen bir demo arayüze dönüştürmektir.

Görev tamamlandığında:

- Ziyaretçi bunun bir **Merinos için hazırlanmış localhost demo** olduğunu ilk
  bakışta anlayabilmelidir.
- Ürünler, koleksiyonlar, satış noktaları ve SSS alanları anlaşılır bir bilgi
  mimarisi içinde yer almalıdır.
- Sağ alt köşedeki dijital asistan, site tasarımının doğal bir parçası gibi
  görünmeli ancak ana içeriği engellememelidir.
- Renk, tipografi, boşluk, yüzey, gölge, radius, hareket ve katman değerleri
  merkezi tasarım tokenlarıyla yönetilmelidir.
- Masaüstü, tablet ve mobil görünüm aynı içerik önceliğini korumalıdır.
- Mevcut dört MVP yeteneğine açılan giriş noktaları görünür olmalıdır.
- Demo içerikleri gerçek ürün, stok, sipariş veya bayi garantisi veriyormuş gibi
  sunulmamalıdır.

Bu adımda backend, LangGraph, Redis, API sözleşmeleri ve chatbotun niyet çözümleme
mantığı değiştirilmez.

---

## 2. Başlamadan önce incelenecek dosyalar

Cursor değişiklik yapmadan önce en az aşağıdaki dosyaları okumalıdır:

```text
cursor-tasks/00-PROJE-ANAYASASI.md
cursor-tasks/01-REPO-VE-GELISTIRME-TEMELI.md
app/layout.tsx
app/page.tsx
app/globals.css
components/Chatbot.tsx
components/ProductVisual.tsx
components/DealerMap.tsx
lib/demo-data.ts
lib/types.ts
tests/project-scope.test.mjs
tests/rendered-html.test.mjs
package.json
README.md
```

Ayrıca değişiklik öncesinde aşağıdaki soruların cevabı çıkarılmalıdır:

1. `app/page.tsx` içindeki hangi state ve handler'lar çalışır davranış üretmektedir?
2. `app/globals.css` içinde hangi sınıflar siteye, hangileri chatbot penceresine aittir?
3. Ürün filtreleme, şehir/bayi seçimi ve chatbot açma davranışları hangi
   bileşenlere bağlıdır?
4. Mevcut testler hangi metin ve işaretleri zorunlu tutmaktadır?
5. Mobil menü, klavye odağı ve reduced-motion davranışı şu anda nasıl çalışmaktadır?

İnceleme yapılmadan toplu dosya taşıma veya yeniden adlandırma yapılmamalıdır.

---

## 3. Mevcut durum ve korunacak davranışlar

Başlangıç projesinde aşağıdaki yapılar zaten bulunmaktadır:

- Demo ortamı uyarı şeridi
- Sticky site header ve mobil menü
- Hero alanı ve dijital asistana geçiş düğmeleri
- Yetenek/avantaj satırı
- Koleksiyon kartları
- Kategori, renk ve ölçü filtreli ürün kataloğu
- Sonuç yok durumu ve filtre temizleme davranışı
- Marka hikâyesi alanı
- Şehir bazlı temsili bayi seçimi ve harita
- Sık sorulan sorular alanı
- Footer
- Sağ altta chatbot launcher ve chat penceresi

Bu görevde aşağıdaki davranışlar korunmalıdır:

```text
Ürün filtreleme
Filtreleri temizleme
Ürün kartından chatbot açma
Hero alanından chatbot açma
Mobil menüyü açma ve kapatma
Menü bağlantısıyla ilgili bölüme kaydırma
Şehir değişince ilk bayi seçimini güncelleme
Harita pininden bayi seçme
Chatbot launcher açma/kapatma
Escape ile desteklenen mevcut kapatma davranışı
```

Görsel yeniden düzenleme bu davranışları bozmamalıdır.

---

## 4. Marka ve telif sınırı

Bu proje bir localhost demosudur. Cursor, resmi Merinos internet sitesini yalnızca
bilgi mimarisi ve marka uyumu açısından referans olarak inceleyebilir; ancak
sayfayı piksel piksel kopyalamamalıdır.

### 4.1. Zorunlu kurallar

- Resmi siteden HTML, CSS, JavaScript veya kapalı kaynak kod kopyalanmamalıdır.
- İzin durumu belirsiz fotoğraf, ürün görseli, ikon, font veya logo dosyası
  indirilip projeye eklenmemelidir.
- Mevcut temsili CSS halı desenleri korunabilir ve geliştirilebilir.
- Resmi logo dosyası mevcut değilse uydurma resmî logo üretilmemelidir.
- Mevcut `M` monogramı açıkça demo işareti olarak kullanılmalıdır.
- Site hiçbir noktada gerçek Merinos e-ticaret sitesi olduğu izlenimini
  vermemelidir.
- `DEMO ORTAMI`, `HALI · DEMO` ve temsili veri açıklamaları görünür kalmalıdır.
- Marka dili sade, güven veren ve premium olabilir; yanıltıcı kurumsal iddialar
  eklenmemelidir.

### 4.2. Dış kaynak kullanımı

Yeni bir görsel veya font zorunlu görülürse:

1. Lisans ve kullanım hakkı açıkça doğrulanmalıdır.
2. Kaynak ve lisans `docs/08-TASARIM-SISTEMI.md` içinde belirtilmelidir.
3. Asset yerel olarak optimize edilmelidir.
4. Harici çalışma zamanı font veya görsel isteği zorunlu tutulmamalıdır.
5. Lisans doğrulanamıyorsa asset kullanılmamalıdır.

Tercih edilen yaklaşım; sistem fontları, CSS şekilleri, yerel SVG ikonları ve
mevcut temsili desenlerle özgün bir demo oluşturmaktır.

---

## 5. Hedef kullanıcı deneyimi

Sayfa ilk açıldığında kullanıcı aşağıdaki sırayı doğal biçimde algılamalıdır:

```text
1. Bunun bir demo olduğu
2. Merinos tarzı bir halı koleksiyonunu keşfedebileceği
3. Ürünleri kategori, renk ve ölçüyle filtreleyebileceği
4. Dijital asistandan yardım alabileceği
5. Satış noktası ve SSS bilgisine ulaşabileceği
```

### 5.1. Masaüstü önceliği

- Hero içeriği ve temsili ürün kompozisyonu dengeli iki sütunda görünmelidir.
- Header ana bölümlere hızlı geçiş sağlamalıdır.
- Ürünler en az üç kartlık dengeli grid yapısında sunulmalıdır.
- Chatbot launcher, ana CTA veya footer içeriğini kapatmamalıdır.
- İçerik geniş ekranlarda aşırı gerilmemeli; merkezi bir maksimum genişlik
  kullanılmalıdır.

### 5.2. Mobil önceliği

- Demo uyarısı okunabilir kalmalıdır.
- Header yüksekliği ve menü kullanımı küçük ekran için sadeleşmelidir.
- Hero tek sütuna inmeli; birincil CTA ilk ekran içinde mümkün olduğunca
  erişilebilir olmalıdır.
- Filtreler dokunmatik kullanım için tek veya iki sütunlu akışa geçmelidir.
- Ürün, bayi ve SSS kartları yatay taşma üretmemelidir.
- Chat penceresi küçük ekranda ekran sınırlarını aşmamalı ve launcher ile
  çakışmamalıdır.
- Safe-area inset değerleri desteklenmelidir.

---

## 6. Sayfa bilgi mimarisi

Ana sayfa aşağıdaki bölüm sırasını korumalıdır:

```text
Demo Uyarı Şeridi
Site Header
Hero
Dijital Asistan Yetenekleri
Öne Çıkan Koleksiyonlar
Ürün Kataloğu ve Filtreler
Marka/Demo Hikâyesi
Satış Noktaları
Sık Sorulan Sorular
Footer
Chatbot Launcher / Chat Penceresi
```

Bölüm adları değiştirilecekse mevcut testler ve kullanıcı akışları korunmalıdır.

### 6.1. Header

Header şu öğeleri içermelidir:

- Demo marka işareti
- Koleksiyonlar bağlantısı
- Ürünler bağlantısı
- Satış Noktaları bağlantısı
- SSS bağlantısı
- Dijital asistana hızlı erişim
- Geçerli dil göstergesi
- Mobil menü düğmesi

Header için gereksinimler:

- Sticky davranış korunmalıdır.
- Saydam/blur yüzey okunabilirliği azaltmamalıdır.
- Masaüstünde linkler, mobilde kontrollü açılan menü kullanılmalıdır.
- Menü düğmesinde `aria-expanded` ve anlaşılır erişilebilir ad bulunmalıdır.
- Menü açıldığında içerik ekran dışına taşmamalıdır.
- Sadece hover ile anlaşılabilen bir navigasyon tasarlanmamalıdır.

### 6.2. Hero

Hero alanı:

- Güçlü fakat kısa bir ana başlık
- Demo yeteneklerini açıklayan kısa metin
- Ürün kataloğuna giden birincil CTA
- Chatbotu açan ikincil CTA
- Temsili halı kompozisyonu
- Demo veya işlem kapasitesi özeti

içermelidir.

Hero görseli fotoğraf gerektirmeden CSS ve erişilebilir metinle üretilebilir.
Dekoratif öğeler ekran okuyucudan gizlenmeli; anlam taşıyan görsel kapsayıcı
uygun `aria-label` veya alternatif metin almalıdır.

### 6.3. Yetenek satırı

En az aşağıdaki dört temel yetenek açıkça temsil edilmelidir:

- Ürün bulma
- Sipariş durumu
- Satış noktası
- Sık sorulan sorular

Mevcut tasarım üç öğe içeriyorsa dördüncü yetenek de dengeli biçimde eklenmelidir.
Yetenek alanı gerçek özelliklerin varlığını abartmamalı; demo olduğunu korumalıdır.

### 6.4. Koleksiyonlar

- En az üç temsili koleksiyon kartı bulunmalıdır.
- Koleksiyon kartları aynı yükseklik ve görsel hiyerarşiye sahip olmalıdır.
- Kartın amacı yalnızca dekorasyon değil, ürün kataloğuna anlamlı geçiş olmalıdır.
- Etkileşimli alan gerçek link veya button semantiği kullanmalıdır.
- Hover animasyonunun klavye odağı karşılığı bulunmalıdır.

### 6.5. Ürün kataloğu

Ürün bölümü aşağıdaki UI durumlarını göstermelidir:

```text
Normal sonuç listesi
Filtre uygulanmış sonuç listesi
Sonuç bulunamadı durumu
Filtreleri temizleme
Stokta durumu
Sınırlı stok durumu
Chatbot üzerinden yardım alma
```

Kurallar:

- Kategori, renk ve ölçü kontrolleri gerçek `label` ile ilişkilendirilmelidir.
- Sonuç sayısı `aria-live="polite"` ile duyurulmalıdır.
- Sadece renkle stok durumu anlatılmamalıdır.
- Fiyat biçimi `tr-TR` ve `TRY` olarak korunmalıdır.
- Ürün görsellerinin temsili olduğu erişilebilir ad içinde anlaşılmalıdır.
- Kartların görsel yüksekliği ve metin hizaları tutarlı olmalıdır.
- CTA metni açık olmalı; belirsiz yalnız ikonlu işlem kullanılmamalıdır.

### 6.6. Hikâye alanı

Hikâye bölümü gerçek olmayan tarih, üretim kapasitesi, ödül veya pazar liderliği
iddiası eklememelidir.

Bu alanın amacı:

- Demo projenin ürün keşfi yaklaşımını anlatmak
- Dijital asistanın site içindeki rolünü açıklamak
- Görsel ritmi ürün kataloğu ile bayi bölümü arasında dengelemek

olmalıdır.

### 6.7. Satış noktaları

- Şehir seçimi görünür ve label ile bağlı olmalıdır.
- Temsili harita açıkça demo olarak işaretlenmelidir.
- Seçili bayi kartı haritaya bağlı biçimde güncellenmelidir.
- Pinler klavye ile seçilebilir button olmalıdır.
- Adres, saat ve mesafe gibi temsili alanlar tutarlı sunulmalıdır.
- “Yol tarifi” gibi canlı servis gerektiren bir işlem eklenirse demo olduğu
  belirtilmeli veya işlev dışı bırakılmalıdır.
- Konum izni bu görevde istenmemelidir; şehir seçimiyle devam edilmelidir.

### 6.8. SSS

- SSS öğeleri semantik `details/summary` veya erişilebilir accordion olarak
  uygulanmalıdır.
- Accordion kullanılırsa klavye ve `aria-expanded` davranışı eksiksiz olmalıdır.
- Metinler demo veri kaynağından gelmeye devam etmelidir.
- Sabit kopyalanmış ikinci bir SSS veri listesi oluşturulmamalıdır.

### 6.9. Footer

Footer en az şunları içermelidir:

- Demo marka işareti
- Demo ve temsili veri uyarısı
- Sayfa içi temel bağlantılar
- Gizlilik/KVKK için “demo bilgi” niteliğinde bağlantı veya metin
- Gerçek müşteri hizmeti kanalı izlenimi vermeyen açıklama

Gerçek telefon, gerçek e-posta veya doğrulanmamış sosyal medya hesabı eklenmemelidir.

---

## 7. Tasarım ilkeleri

Tasarım aşağıdaki beş ilkeye göre uygulanmalıdır:

### 7.1. Sıcak ve güven veren

Halı ve yaşam alanı temasına uygun krem, kırık beyaz, toprak ve kontrollü kırmızı
vurgular kullanılmalıdır. Arayüz soğuk bir yönetim paneli gibi görünmemelidir.

### 7.2. Ürün odaklı

Dekoratif tasarım, ürün adı, renk, ölçü, stok ve fiyat bilgisinin önüne
geçmemelidir.

### 7.3. Sohbet destekli fakat sohbet bağımlı değil

Kullanıcı ürünleri ve bayi bilgisini chat açmadan da görebilmelidir. Chatbot,
normal site deneyimini tamamlamalıdır.

### 7.4. Demo olduğu açık

Temsili veri uyarısı küçük ve görünmez bir dipnot haline getirilmemelidir.

### 7.5. Durumlar tasarımın parçası

Loading, boş sonuç, hata, seçili, hover, focus, disabled ve success durumları
sonradan eklenen istisnalar değil, tasarım sisteminin bileşeni olmalıdır.

---

## 8. Tasarım tokenları

Tasarım değerleri bileşenlerin içine dağınık hex, px ve z-index değerleri olarak
yazılmamalıdır. En az renk, tipografi, spacing, radius, shadow, motion ve layer
değerleri merkezi tokenlarla yönetilmelidir.

### 8.1. Zorunlu token dosyası

Aşağıdaki dosya oluşturulmalıdır:

```text
styles/tokens.css
```

`app/globals.css`, token dosyasını import etmeli veya tokenlar tek bir merkezi
katmandan yüklenmelidir. Aynı tokenların iki farklı yerde tekrar tanımlanmasına
izin verilmemelidir.

### 8.2. Başlangıç renk ailesi

Mevcut demo paleti başlangıç noktası olarak korunmalıdır:

```css
:root {
  --color-canvas: #f8f4ee;
  --color-surface: #fffdf9;
  --color-text: #211d1b;
  --color-text-muted: #756e68;
  --color-border: #e4ddd4;
  --color-brand: #a9282c;
  --color-brand-strong: #7e171b;
  --color-cream: #efe5d4;
  --color-olive: #5f6552;
}
```

Cursor bu isimleri gerekçeli biçimde geliştirebilir; ancak anlamsal tokenlar
aşağıdaki kullanım alanlarını kapsamalıdır:

```text
canvas
surface
surface-elevated
text
text-muted
border
brand
brand-hover
brand-contrast
success
warning
error
focus-ring
overlay
```

Renk değerleri bileşen dosyalarında yeniden tanımlanmamalıdır.

### 8.3. Tipografi tokenları

En az aşağıdaki roller tanımlanmalıdır:

```text
font-display
font-body
font-mono (yalnız teknik/demo işaretlerinde gerekiyorsa)
text-xs
text-sm
text-base
text-lg
text-xl
text-2xl
text-display-sm
text-display-lg
line-tight
line-normal
line-relaxed
tracking-label
```

Tercih edilen font stratejisi:

- Başlıklar: güvenli serif sistem font zinciri
- Gövde ve kontroller: güvenli sans-serif sistem font zinciri
- Çalışma zamanında üçüncü taraf font servisine zorunlu istek yok

### 8.4. Spacing tokenları

En az 4 px tabanlı tutarlı bir ölçek kullanılmalıdır:

```text
--space-1  -> 4px
--space-2  -> 8px
--space-3  -> 12px
--space-4  -> 16px
--space-5  -> 20px
--space-6  -> 24px
--space-8  -> 32px
--space-10 -> 40px
--space-12 -> 48px
--space-16 -> 64px
--space-20 -> 80px
```

Her değer doğrudan kullanılmak zorunda değildir. Ama sayfa bölümleri ve bileşen
boşlukları rastgele değerlerden oluşmamalıdır.

### 8.5. Radius, shadow ve layer

Aşağıdaki semantik roller tanımlanmalıdır:

```text
radius-sm
radius-md
radius-lg
radius-pill
shadow-card
shadow-floating
shadow-dialog
layer-base
layer-sticky
layer-overlay
layer-chat
```

`z-index: 99999` gibi gerekçesiz değerler kullanılmamalıdır. Header, mobil menü,
chat launcher ve chat penceresinin katman sırası açıkça belgelenmelidir.

### 8.6. Motion

En az aşağıdaki motion değerleri tanımlanmalıdır:

```text
motion-fast
motion-normal
motion-slow
ease-standard
ease-emphasized
```

Animasyonlar:

- İşlevi anlatmalı veya geçişi yumuşatmalıdır.
- 150–300 ms aralığında tutulmalıdır.
- Layout shift üretmemelidir.
- `prefers-reduced-motion: reduce` altında kaldırılmalı veya belirgin biçimde
  azaltılmalıdır.

---

## 9. Responsive sistem

Responsive davranış rastgele bileşen bazlı eşiklerden oluşmamalıdır.

Önerilen referans aralıklar:

| Ad | Aralık | Beklenen davranış |
| --- | --- | --- |
| Mobile | `0–479px` | Tek sütun, tam genişlik kontroller |
| Large mobile | `480–759px` | Tek sütun, genişletilmiş kartlar |
| Tablet | `760–999px` | İki sütun uygun alanlarda |
| Desktop | `1000–1439px` | Ana masaüstü gridleri |
| Wide | `1440px+` | İçerik maksimum genişlikte merkezli |

Mevcut `760px` ve `1000px` kırılımları korunabilir. Yeni breakpoint eklenirse
neden tasarım sistemi dokümanında açıklanmalıdır.

### 9.1. Zorunlu responsive kontroller

Aşağıdaki viewport genişlikleri en az elle kontrol edilmelidir:

```text
320px
375px
430px
768px
1024px
1280px
1440px
```

Her genişlikte:

- Yatay sayfa kaydırması olmamalıdır.
- Metinler kesilmemelidir.
- CTA'lar üst üste binmemelidir.
- Chat launcher ana içeriği kalıcı olarak kapatmamalıdır.
- Chat penceresi viewport dışına taşmamalıdır.
- Filtre select alanları okunabilir kalmalıdır.
- Harita pinleri erişilebilir hedef boyutunu korumalıdır.

---

## 10. Bileşen mimarisi

`app/page.tsx` mevcut durumda çok sayıda sayfa bölümünü ve state yönetimini tek
yerde taşımaktadır. Bu görevde bölüm bileşenleri ayrıştırılmalı; ancak state
rastgele alt bileşenlere kopyalanmamalıdır.

### 10.1. Tercih edilen dosya yapısı

Aşağıdaki yapı hedeflenmelidir:

```text
components/
  site/
    DemoStrip.tsx
    SiteHeader.tsx
    HeroSection.tsx
    CapabilityStrip.tsx
    CollectionsSection.tsx
    ProductCatalogSection.tsx
    StorySection.tsx
    DealerSection.tsx
    FaqSection.tsx
    SiteFooter.tsx
  ui/
    SectionHeading.tsx
styles/
  tokens.css
  site.css
  chat.css
```

Bu liste bağlayıcı dosya sayısı değildir; fakat aşağıdaki ayrım bağlayıcıdır:

- Sayfa bölümleri okunabilir React bileşenlerine ayrılmalıdır.
- Site stili ve chat stili mantıksal olarak ayrıştırılmalıdır.
- Tokenlar tek dosyada merkezi olmalıdır.
- `app/page.tsx`, sayfa state'ini ve bölüm bileşim sırasını anlaşılır biçimde
  yönetmelidir.
- Sadece bir kez kullanılan çok küçük markup parçaları gereksiz micro-component
  haline getirilmemelidir.

### 10.2. State sahipliği

Aşağıdaki state'ler tek kaynaktan yönetilmelidir:

```text
category
color
size
chatOpen
menuOpen
dealerCity
selectedDealerId
```

Ürün filtreleme ve bayi seçimi için aynı verinin hem parent hem child içinde
ayrı state kopyaları oluşturulmamalıdır.

### 10.3. Prop sözleşmeleri

- Prop tipleri açık TypeScript tipleriyle tanımlanmalıdır.
- `any` kullanılmamalıdır.
- Event handler isimleri `onOpenChat`, `onSelectCity`, `onResetFilters` gibi
  niyeti anlatmalıdır.
- Demo verisi bileşen içinde ikinci kez hard-code edilmemelidir.
- `lib/demo-data.ts` ve `lib/types.ts` kaynak olarak korunmalıdır.

---

## 11. CSS mimarisi

Mevcut `app/globals.css` çok büyüktür. Bu görevde stiller kontrollü biçimde
ayrıştırılmalıdır.

### 11.1. Hedef ayrım

```text
styles/tokens.css -> yalnız tasarım tokenları
styles/site.css   -> ana site, kartlar, bölümler ve responsive kurallar
styles/chat.css   -> launcher, pencere ve chat içeriği görsel kuralları
app/globals.css   -> Tailwind importu, dosya importları ve minimal global reset
```

Mevcut build sistemi CSS import ayrımını desteklemiyorsa:

- Token dosyası yine oluşturulmalıdır.
- `globals.css` anlamlı bölüm başlıklarıyla düzenlenmelidir.
- Çalışan build'i bozacak zorlayıcı bir ayrıştırma yapılmamalıdır.
- Kullanılan alternatif tamamlanma raporunda belirtilmelidir.

### 11.2. CSS kuralları

- Bileşen içinde inline style yalnız dinamik konum gibi gerçek dinamik değerler
  için kullanılmalıdır.
- Renk, spacing ve z-index değerleri inline verilmemelidir.
- `!important` yeni tasarımın normal aracı olmamalıdır.
- Selector derinliği düşük tutulmalıdır.
- Eski ve yeni sınıflar aynı işi yapıyorsa kullanılmayan stil kaldırılmalıdır.
- Kullanılan sınıf adları işlev veya bileşen adını anlatmalıdır.
- Hover davranışının focus-visible karşılığı bulunmalıdır.
- Disabled durumlar yalnız opacity ile belirsiz bırakılmamalıdır.

---

## 12. Erişilebilirlik gereksinimleri

Hedef en az WCAG 2.2 AA düzeyine yaklaşan bir demo deneyimidir.

### 12.1. Klavye

- Bütün interaktif öğeler `Tab` ile erişilebilir olmalıdır.
- Odak sırası görsel sırayla uyumlu olmalıdır.
- Focus ring görünür ve marka paletiyle kontrastlı olmalıdır.
- Mobil menü ve chat penceresi Escape davranışını korumalıdır.
- Harita pinleri button olarak çalışmalıdır.
- SSS öğeleri klavyeyle açılabilmelidir.

### 12.2. Semantik HTML

- Tek bir ana `h1` kullanılmalıdır.
- Bölüm başlıkları `h2`, kart başlıkları gerektiğinde `h3` olmalıdır.
- Navigasyon `nav`, ana içerik `main`, footer `footer` semantiği taşımalıdır.
- Link ile button işlevleri karıştırılmamalıdır.
- Form kontrolleri gerçek `label` ile bağlı olmalıdır.
- Dekoratif içerikler `aria-hidden="true"` olmalıdır.

### 12.3. Kontrast ve renk

- Normal metin ve arka plan için en az 4.5:1 hedeflenmelidir.
- Büyük metin için en az 3:1 hedeflenmelidir.
- Focus göstergesi çevresine karşı yeterli kontrast sunmalıdır.
- Stok, hata veya başarı durumu yalnız renkle anlatılmamalıdır.

### 12.4. Hedef boyutları

Dokunmatik interaktif öğeler mümkün olduğunca en az `44 × 44px` hedef alanı
sunmalıdır. Küçük ikon düğmeleri erişilebilir ad içermelidir.

### 12.5. Hareket ve duyuru

- `prefers-reduced-motion` desteklenmelidir.
- Filtre sonucu sayısı nazik canlı bölgeyle duyurulmalıdır.
- Görsel değişikliklerde gereksiz canlı bölge kullanılmamalıdır.
- Otomatik hareket eden carousel veya sürekli animasyon eklenmemelidir.

---

## 13. Chatbot ile görsel uyum sınırı

Bu görev chatbotun iş mantığını değiştirmez. Ancak launcher ve chat penceresi ana
site tasarım sistemiyle uyumlu hale getirilebilir.

### 13.1. Yapılabilecekler

- Renk, radius, shadow ve spacing tokenlarını ortaklaştırmak
- Launcher boyutunu ve mobil konumunu iyileştirmek
- Chat header, mesaj balonu, kart ve form stillerini tasarım sistemiyle uyumlu
  hale getirmek
- Focus, hover, disabled ve typing durumlarını görünür kılmak
- Safe-area ve küçük ekran davranışını düzeltmek

### 13.2. Yapılmayacaklar

- `resolveChatInput` veya konuşma motorunu değiştirmek
- Yeni niyet eklemek
- API çağrısı eklemek
- Mesaj state modelini değiştirmek
- Sipariş doğrulama akışını yeniden yazmak
- Gerçek LLM bağlantısı eklemek
- Supervisor–Worker backend'ine bağlamak

Chatbot etkileşim ve konuşma davranışı sonraki görevlerin kapsamıdır.

---

## 14. İçerik ve mikro metin kuralları

Arayüz metinleri:

- Türkçe olmalıdır.
- Kısa ve eylem odaklı olmalıdır.
- Kullanıcıyı suçlayan veya teknik hata kodu gösteren dil kullanmamalıdır.
- Gerçek veri varmış gibi kesin ifade kullanmamalıdır.
- “Demo”, “temsili”, “örnek” ayrımını gerektiği yerde açıkça göstermelidir.

### 14.1. CTA örnekleri

Tercih edilen:

```text
Koleksiyonu keşfet
Asistana sor
Filtreleri temizle
Satış noktasını seç
Ürün bulmama yardım et
```

Kaçınılacak:

```text
Tıkla
Gönder
Buraya bas
Kesin stokta
Siparişiniz güvende
En yakın mağaza budur
```

### 14.2. Boş ve hata durumları

Ürün sonucu yoksa:

- Sonuç bulunamadığını açıkça belirt.
- Uygulanan filtreleri temizleme seçeneği sun.
- Chatbot üzerinden yardım alma seçeneği sunulabilir.
- Olmayan ürün önerisi uydurma.

Harita veya bayi verisi yoksa:

- Temsili veri bulunamadığını belirt.
- Başka şehir seçme seçeneği sun.
- Rastgele bayi üretme.

---

## 15. Görsel varlık ve ikon stratejisi

- Emoji, platforma göre değişen ana ikon seti olarak kullanılmamalıdır.
- Kritik aksiyonlar için küçük yerel SVG ikonları tercih edilmelidir.
- İkonlar dekoratifse `aria-hidden="true"`, tek başına işlemse button üzerinde
  erişilebilir ad bulunmalıdır.
- SVG dosyaları optimize ve anlaşılır isimli olmalıdır.
- Büyük raster görsel eklenirse uygun boyut, format ve alt metin sağlanmalıdır.
- Bir görsel yalnız dekoratifse boş alt metin veya CSS background yaklaşımı
  kullanılmalıdır.
- Halı ürün görselleri bu demoda temsili CSS desenleri olarak kalabilir.

Gerçek Merinos ürün fotoğrafı veya logosu lisans/izin doğrulanmadan eklenmemelidir.

---

## 16. Performans gereksinimleri

Bu adım yeni ağır UI kütüphaneleri getirmemelidir.

### 16.1. Zorunlu performans kuralları

- Basit tasarım için component library eklenmemelidir.
- Yeni carousel, animation veya icon paketi eklenmemelidir.
- Kullanılmayan JavaScript artırılmamalıdır.
- Görsel boyutları layout shift üretmeyecek biçimde tanımlanmalıdır.
- CSS tekrarları azaltılmalıdır.
- Büyük box-shadow ve blur kullanımı mobilde kontrollü olmalıdır.
- Sayfanın ilk render'ı chat penceresinin kapalı haliyle gereksiz ağırlaşmamalıdır.
- `use client` sınırı gereksiz yere daha fazla dosyaya yayılmamalıdır.

### 16.2. Bağımlılık politikası

Bu görev normal şartlarda yeni npm bağımlılığı gerektirmemelidir.

Yeni paket eklenmesi ancak:

1. Mevcut React/CSS ile çözülemeyen açık ihtiyaç varsa,
2. Paket aktif ve güvenilir durumdaysa,
3. Bundle etkisi incelendiyse,
4. Gerekçe tamamlanma raporuna yazıldıysa

kabul edilebilir.

---

## 17. Tasarım sistemi dokümanı

Aşağıdaki dosya oluşturulmalıdır:

```text
docs/08-TASARIM-SISTEMI.md
```

Belge en az şu bölümleri içermelidir:

```text
Amaç ve kapsam
Demo/marka sınırı
Renk tokenları
Tipografi
Spacing
Radius ve gölgeler
Katman sırası
Breakpoint'ler
Bileşen envanteri
Etkileşim durumları
Erişilebilirlik kuralları
Asset ve lisans politikası
Yeni bileşen ekleme kontrol listesi
```

Belge, CSS değerlerini tekrar eden uzun bir dump olmamalıdır. Tasarım kararlarının
nedenini ve yeni bileşenin sisteme nasıl ekleneceğini anlatmalıdır.

Root `README.md` veya `docs/README.md` içine bu belgeye göreli bağlantı
eklenmelidir.

---

## 18. Uygulama adımları

Cursor aşağıdaki sırayı izlemelidir.

### Adım 1 — Değişiklik öncesi durum tespiti

- İlgili dosyaları oku.
- Mevcut state ve handler haritasını çıkar.
- Mevcut testleri çalıştırabiliyorsan çalıştır.
- `globals.css` içindeki site/chat/responsive bölümlerini belirle.
- Çalışma ağacındaki kullanıcı değişikliklerini koru.

### Adım 2 — Tasarım tokenlarını oluştur

- `styles/tokens.css` dosyasını ekle.
- Mevcut renkleri semantik isimlere taşı.
- Tipografi, spacing, radius, shadow, layer ve motion tokenlarını tanımla.
- Dağınık tekrarları tokenlara bağla.
- Koyu tema ekleme; bu görev açık sıcak tema içindir.

### Adım 3 — CSS yapısını düzenle

- Site ve chat stillerini mantıksal olarak ayır.
- Kullanılmayan ve tekrar eden kuralları kaldır.
- Mevcut responsive davranışı koruyarak ortak breakpoint sistemine bağla.
- Focus-visible ve reduced-motion kurallarını bütün bileşenlere uygula.

### Adım 4 — Sayfa bileşenlerini ayrıştır

- `app/page.tsx` içindeki büyük bölümleri `components/site/` altına taşı.
- State sahipliğini parent seviyesinde koru.
- Prop tiplerini açık tanımla.
- Veriyi `lib/demo-data.ts` üzerinden geçir.
- Gereksiz context veya global state ekleme.

### Adım 5 — Ana sayfa görsel hiyerarşisini iyileştir

- Header, hero ve bölüm spacinglerini tutarlı hale getir.
- Yetenek satırını dört MVP alanını içerecek biçimde düzenle.
- Koleksiyon, ürün, hikâye, bayi ve SSS bölümlerinin ritmini dengele.
- CTA hiyerarşisini birincil/ikincil olarak netleştir.
- Demo uyarılarını görünür tut.

### Adım 6 — Responsive ve erişilebilirlik iyileştirmeleri

- Belirlenen viewport genişliklerini kontrol et.
- Yatay taşmaları düzelt.
- Mobil menü ve chat konumunu düzelt.
- Form label, heading sırası, focus ring ve target size kontrollerini yap.
- Klavye ile tam sayfa dolaşımını test et.

### Adım 7 — Tasarım sistemi dokümanını yaz

- `docs/08-TASARIM-SISTEMI.md` dosyasını oluştur.
- Token ve bileşen kullanımını açıkla.
- Asset/telif sınırını yaz.
- README indeksine bağlantı ekle.

### Adım 8 — Testleri güncelle ve çalıştır

- Tasarım sistemi dosyalarının varlığını kontrol eden hafif test ekle.
- Dört MVP yeteneğinin görünür olduğunu kontrol et.
- Mevcut davranış testlerini bozma.
- Lint, build, test ve artifact kontrollerini çalıştır.
- Çalıştırılamayan komutları başarılı göstermeden raporla.

### Adım 9 — Tamamlanma raporu ver ve dur

- Değişen dosyaları listele.
- Görsel ve teknik kararları özetle.
- Responsive/erişilebilirlik kontrollerini bildir.
- Sonraki görev dosyasını uygulama.

---

## 19. Zorunlu davranış testleri

Aşağıdaki senaryolar en az elle veya otomatik test edilmelidir:

| Senaryo | Beklenen sonuç |
| --- | --- |
| Sayfa ilk açılış | Demo uyarısı, header, hero ve chat launcher görünür |
| Ana menü linki | İlgili bölüme gider |
| Mobil menü aç/kapat | Durum ve `aria-expanded` doğru güncellenir |
| Hero “Asistana sor” | Chat penceresi açılır |
| Ürün kategorisi seçimi | Liste ve sonuç sayısı güncellenir |
| Renk + ölçü filtresi | Birleşik filtre doğru uygulanır |
| Sonuç yok | Boş durum ve filtre temizleme görünür |
| Filtreleri temizle | Bütün filtreler `Tümü` değerine döner |
| Ürün kartı CTA | Chat penceresi açılır |
| Şehir değişimi | İlk uygun bayi seçilir |
| Harita pini seçimi | Seçili bayi kartı güncellenir |
| SSS klavye kullanımı | Öğeler klavyeyle açılıp kapanır |
| 320 px viewport | Yatay taşma oluşmaz |
| 768 px viewport | Tablet yerleşimi okunabilir |
| 1440 px viewport | İçerik aşırı genişlemez |
| Reduced motion | Gereksiz animasyonlar kapanır |
| Sadece klavye | Bütün işlemler görünür odakla erişilebilir |
| Chat kapalı | Ana içerik erişilebilir ve launcher görünür |
| Chat açık mobil | Pencere viewport dışına taşmaz |

---

## 20. Otomatik test beklentileri

Mevcut testlere ek olarak uygun bir test dosyasında en az aşağıdaki kontroller
yapılmalıdır:

```text
styles/tokens.css mevcut
styles/tokens.css marka ve odak tokenlarını içeriyor
docs/08-TASARIM-SISTEMI.md mevcut
tasarım sistemi belgesi breakpoint ve erişilebilirlik bölümlerini içeriyor
ana sayfada dört MVP yeteneği görünür
ürün sonuç sayısı aria-live kullanıyor
mobil menü aria-expanded kullanıyor
Demo ortamı açıklaması korunuyor
```

Testler uygulamanın iç CSS satır sayısı veya kırılgan tam class sıralamasına bağlı
olmamalıdır. Davranış ve zorunlu sözleşme test edilmelidir.

Ağır bir browser test framework'ü yalnız bu görev için eklenmemelidir. Mevcut
Node test altyapısı yeterliyse kullanılmalıdır.

---

## 21. Kabul ölçütleri

Bu görev ancak aşağıdaki maddelerin tamamı karşılandığında tamamlanmış sayılır.

### 21.1. Tasarım sistemi

- [ ] `styles/tokens.css` oluşturuldu.
- [ ] Renk, tipografi, spacing, radius, shadow, layer ve motion tokenları mevcut.
- [ ] Component CSS içinde gereksiz tekrar eden hex değerleri azaltıldı.
- [ ] Header, kart, dialog ve launcher katman sırası tanımlı.
- [ ] `docs/08-TASARIM-SISTEMI.md` oluşturuldu.
- [ ] Doküman README veya docs indeksinden erişilebilir.

### 21.2. Bileşen yapısı

- [ ] `app/page.tsx` okunabilir bölüm bileşenlerine ayrıldı.
- [ ] State tek kaynaktan yönetiliyor.
- [ ] Demo verisi ikinci kez hard-code edilmedi.
- [ ] Prop tiplerinde `any` kullanılmadı.
- [ ] Site ve chat stilleri mantıksal olarak ayrıldı veya gerekçeli alternatif uygulandı.
- [ ] Kullanılmayan stiller ve eski sınıflar temizlendi.

### 21.3. Ana sayfa

- [ ] Demo uyarı şeridi görünür.
- [ ] Header masaüstü ve mobilde çalışıyor.
- [ ] Hero birincil ve ikincil CTA içeriyor.
- [ ] Dört MVP yeteneği görünür.
- [ ] Koleksiyon kartları ürün bölümüne anlamlı geçiş sağlıyor.
- [ ] Ürün filtreleri ve sonuç sayısı çalışıyor.
- [ ] Boş sonuç durumu mevcut.
- [ ] Bayi şehir ve pin seçimi çalışıyor.
- [ ] SSS erişilebilir biçimde açılıyor.
- [ ] Footer demo sınırını koruyor.

### 21.4. Responsive

- [ ] 320 px genişlikte yatay taşma yok.
- [ ] 375 px ve 430 px mobil yerleşimleri kullanılabilir.
- [ ] 768 px tablet yerleşimi dengeli.
- [ ] 1024 px masaüstü geçişi bozulmuyor.
- [ ] 1280 px ve 1440 px içerik maksimum genişlikte merkezli.
- [ ] Chat launcher ve pencere küçük ekranda viewport dışına taşmıyor.
- [ ] Safe-area desteği bulunuyor.

### 21.5. Erişilebilirlik

- [ ] Tek bir `h1` ve doğru heading sırası var.
- [ ] Bütün form kontrolleri label ile bağlı.
- [ ] Bütün buton ve linklerin anlaşılır erişilebilir adı var.
- [ ] Focus-visible belirgin.
- [ ] Hover durumlarının klavye karşılığı var.
- [ ] Sadece renkle verilen kritik durum yok.
- [ ] `prefers-reduced-motion` destekleniyor.
- [ ] Dokunmatik hedefler mümkün olduğunca 44 px.
- [ ] Ürün sonuç sayısı canlı bölgede duyuruluyor.

### 21.6. Geriye uyumluluk

- [ ] Ürün filtreleme davranışı korundu.
- [ ] Chatbot açma/kapatma davranışı korundu.
- [ ] Bayi seçimi davranışı korundu.
- [ ] SSS verisi `lib/demo-data.ts` kaynağından geliyor.
- [ ] Chatbot konuşma motoru değiştirilmedi.
- [ ] Backend, LangGraph ve Redis dosyaları değiştirilmedi.
- [ ] Gerçek müşteri verisi veya secret eklenmedi.
- [ ] Lisansı belirsiz görsel/font eklenmedi.

### 21.7. Kalite kapısı

- [ ] `npm run check:toolchain` geçti.
- [ ] `npm run lint` geçti.
- [ ] `npm run build` geçti.
- [ ] `npm run test` geçti.
- [ ] `npm run validate:artifact` geçti.
- [ ] `npm run verify:web` geçti.
- [ ] Varsa ilgili yeni kapsam testleri geçti.

Bir kontrol ortam nedeniyle çalıştırılamadıysa “geçti” olarak raporlanmamalıdır.

---

## 22. Doğrulama komutları

Önce `01` görevinin komutları gerçekten uygulanmışsa:

```bash
npm ci
npm run check:toolchain
npm run lint
npm run build
npm run test
npm run validate:artifact
npm run verify:web
```

`01` görevi henüz kod tabanına uygulanmadıysa mevcut komutlarla:

```bash
npm ci
npm run lint
npm run build
npm test
npm run validate:artifact
```

### 22.1. Zorunlu dosyalar

macOS/Linux/WSL:

```bash
test -f styles/tokens.css
test -f docs/08-TASARIM-SISTEMI.md
grep -qi "erişilebilir" docs/08-TASARIM-SISTEMI.md
grep -qi "breakpoint" docs/08-TASARIM-SISTEMI.md
```

PowerShell:

```powershell
@(
  "styles/tokens.css",
  "docs/08-TASARIM-SISTEMI.md"
) | ForEach-Object {
  if (-not (Test-Path $_)) { throw "Eksik dosya: $_" }
}

$designDoc = Get-Content "docs/08-TASARIM-SISTEMI.md" -Raw
if ($designDoc -notmatch "erişilebilir") {
  throw "Tasarım sistemi belgesinde erişilebilirlik bölümü eksik"
}
if ($designDoc -notmatch "breakpoint") {
  throw "Tasarım sistemi belgesinde breakpoint bölümü eksik"
}
```

### 22.2. Yatay taşma manuel kontrolü

Browser DevTools ile en az şu genişlikler kontrol edilmelidir:

```text
320, 375, 430, 768, 1024, 1280, 1440
```

Console üzerinde geçici kontrol:

```js
const overflow = document.documentElement.scrollWidth > window.innerWidth;
console.log({ overflow, scrollWidth: document.documentElement.scrollWidth, width: window.innerWidth });
```

Bu kontrol tek başına görsel kabul testi değildir; sayfa bölümleri insan gözüyle
de incelenmelidir.

### 22.3. Klavye kontrolü

1. Sayfayı yenile.
2. Fare kullanmadan `Tab` ile header bağlantılarını gez.
3. Mobil görünümde menüyü aç ve kapat.
4. Ürün filtrelerini değiştir.
5. Harita pinlerinden birini seç.
6. SSS öğesini aç.
7. Chatbotu aç ve kapat.
8. Odak göstergesinin hiçbir adımda kaybolmadığını doğrula.

---

## 23. Bu adımda yasak olan değişiklikler

Cursor aşağıdakileri yapmamalıdır:

- Uygulamayı başka frontend framework'üne taşımak
- UI kit veya ağır component library eklemek
- Tailwind sürümünü yükseltmek veya kaldırmak
- Paketleri topluca güncellemek
- Chatbot konuşma mantığını değiştirmek
- Yeni chatbot niyeti veya Worker eklemek
- Backend API geliştirmek
- Redis state şemasını değiştirmek
- Gerçek Merinos ürün/bayi/sipariş verisi eklemek
- Resmi site kodunu veya lisanssız assetleri kopyalamak
- Gerçek konum izni istemek
- Gerçek ödeme, sepet veya sipariş işlemi eklemek
- Siteyi gerçek üretim sitesi gibi göstermek
- Kullanıcının mevcut değişikliklerini silmek
- Otomatik commit, push veya pull request açmak
- `03` numaralı görevi uygulamak

---

## 24. Tamamlanma raporu formatı

Cursor görev sonunda şu formatı kullanmalıdır:

```markdown
## Tamamlananlar

- Tasarım tokenları:
- Ana sayfa bileşenleri:
- Responsive düzenlemeler:
- Erişilebilirlik iyileştirmeleri:
- Tasarım sistemi dokümanı:

## Değişen dosyalar

- `dosya/yolu`: değişiklik özeti

## Korunan davranışlar

- Ürün filtreleme:
- Chatbot açma/kapatma:
- Bayi seçimi:
- SSS:

## Görsel doğrulamalar

- 320 px:
- 375 px:
- 430 px:
- 768 px:
- 1024 px:
- 1280 px:
- 1440 px:
- Klavye dolaşımı:
- Reduced motion:

## Komut sonuçları

- `npm run check:toolchain`: geçti / başarısız / çalıştırılamadı
- `npm run lint`: geçti / başarısız / çalıştırılamadı
- `npm run build`: geçti / başarısız / çalıştırılamadı
- `npm run test`: geçti / başarısız / çalıştırılamadı
- `npm run validate:artifact`: geçti / başarısız / çalıştırılamadı
- `npm run verify:web`: geçti / başarısız / çalıştırılamadı

## Bağımlılık değişiklikleri

- Yeni paket: yok / paket adı
- Gerekçe:
- Bundle etkisi:
- Lockfile durumu:

## Varsayımlar veya açık noktalar

- ...

## Sonraki adım

- `03-CHATBOT-WIDGET-VE-KONUSMA-DENEYIMI.md` henüz uygulanmadı.
```

“Geçti” yalnız komut gerçekten başarılı çalıştırıldıysa yazılmalıdır.

---

## 25. Durma kuralı

Bu görevde yalnızca Merinos localhost demo sitesinin görsel sistemi, sayfa
bileşenleri, responsive davranışı, erişilebilirliği ve tasarım sistemi belgesi
hazırlanır.

Kabul ölçütleri kontrol edilip tamamlanma raporu verildikten sonra Cursor
**durmalıdır**. Kullanıcı açıkça istemeden chatbot konuşma deneyimini, backend
entegrasyonunu veya `03` numaralı görevi uygulamamalıdır.
