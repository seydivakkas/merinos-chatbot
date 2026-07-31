# 03 — Chatbot Widget ve Konuşma Deneyimi

> **Belge türü:** Cursor uygulama görevi  
> **Sıra:** 03/20  
> **Ön koşullar:** `00-PROJE-ANAYASASI.md`, `01-REPO-VE-GELISTIRME-TEMELI.md` ve `02-MERINOS-DEMO-SITESI-VE-TASARIM-SISTEMI.md` uygulanmış olmalıdır  
> **Ana çıktı:** Erişilebilir, responsive, hata toleranslı ve sürdürülebilir Merinos Dijital Asistan widget'ı  
> **Kapsam dışı:** Ürün/sipariş/bayi/SSS iş kurallarını yeniden yazmak, gerçek backend bağlantısı kurmak, LangGraph veya Redis geliştirmek, canlı destek entegrasyonu yapmak

---

## 1. Görevin amacı

Bu adımın amacı mevcut chatbotu yeni işlevlerle büyütmek değil; var olan dört MVP
akışını güvenli ve anlaşılır biçimde sunan konuşma arayüzünü ürün kalitesinde bir
widget yapısına dönüştürmektir.

Görev tamamlandığında kullanıcı:

- Sağ alt köşedeki launcher üzerinden asistanı kolayca açabilmelidir.
- Widget'ın demo olduğunu ve gerçek kişisel bilgi girmemesi gerektiğini açıkça
  görebilmelidir.
- Mesajları, hızlı işlemleri, ürün kartlarını, sipariş durumunu, bayi sonuçlarını
  ve SSS yanıtlarını karışmadan takip edebilmelidir.
- Klavye, ekran okuyucu ve dokunmatik ekranla temel işlemleri yapabilmelidir.
- Mesaj gönderme, yanıt bekleme, hata, yeniden deneme ve sıfırlama durumlarında
  ne olduğunu anlayabilmelidir.
- Widget'ı kapatıp açtığında aynı sayfa oturumundaki konuşmayı kaybetmemelidir.
- Sohbeti açık bir onayla sıfırlayabilmelidir.
- Mobil ekranda sanal klavye açıkken giriş alanına ve son mesaja ulaşabilmelidir.

Teknik olarak görev tamamlandığında:

- `components/Chatbot.tsx` dışa açık bileşen sözleşmesini koruyan ince bir giriş
  bileşenine dönüşmelidir.
- Görsel alt parçalar `components/chatbot/` altında ayrıştırılmalıdır.
- Konuşma UI durumu tek bir controller/hook üzerinden yönetilmelidir.
- Yerel demo motoru `lib/chatbot/engine.ts` aynı iş kurallarını korumalıdır.
- Gelecekteki API bağlantısı için küçük ve açık bir transport sınırı
  hazırlanmalı; fakat gerçek HTTP isteği bu adımda yazılmamalıdır.
- Erişilebilirlik duyuruları bütün mesaj listesini sürekli yeniden okutmayacak
  şekilde tasarlanmalıdır.
- Tasarım tokenları ve `02` adımında oluşturulan stil sistemi kullanılmalıdır.

---

## 2. Başlamadan önce incelenecek dosyalar

Cursor herhangi bir değişiklik yapmadan önce en az şu dosyaları okumalıdır:

```text
cursor-tasks/00-PROJE-ANAYASASI.md
cursor-tasks/01-REPO-VE-GELISTIRME-TEMELI.md
cursor-tasks/02-MERINOS-DEMO-SITESI-VE-TASARIM-SISTEMI.md
components/Chatbot.tsx
components/DealerMap.tsx
components/ProductVisual.tsx
lib/chatbot/engine.ts
lib/demo-data.ts
lib/types.ts
app/page.tsx
app/globals.css
styles/tokens.css                 # 02 görevi uygulanmışsa
styles/chatbot.css                # 02 görevi oluşturmuşsa
app/styles/chatbot.css            # alternatif yapı kullanılmışsa
app/layout.tsx
tests/project-scope.test.mjs
tests/rendered-html.test.mjs
package.json
docs/08-TASARIM-SISTEMI.md        # 02 görevi uygulanmışsa
README.md
```

İnceleme sonunda aşağıdaki noktalar kısa notlarla belirlenmelidir:

1. `Chatbot` bileşeninin dışarıdan aldığı prop'lar nelerdir?
2. Widget hangi state'leri kendi içinde tutmaktadır?
3. `resolveChatInput` hangi noktada çağrılmaktadır?
4. Yanıt zamanlayıcısı nasıl başlatılıp temizlenmektedir?
5. Widget kapalıyken ve açıkken DOM yapısı nasıl değişmektedir?
6. Mesaj kartları hangi veri alanlarına bağlıdır?
7. Hangi CSS sınıfları yalnız chatbot tarafından kullanılmaktadır?
8. Mevcut testler hangi metin, class veya davranışları zorunlu kabul etmektedir?
9. `02` adımı uygulanmışsa tasarım tokenlarının doğru import yolu nedir?
10. `app/page.tsx`, `Chatbot` bileşenini hangi import yolu ve prop sözleşmesiyle
    kullanmaktadır?

Bu inceleme tamamlanmadan bileşen taşıma, dosya yeniden adlandırma veya state
modeli değişikliği yapılmamalıdır.

---

## 3. Mevcut davranış ve korunacak sözleşme

Başlangıç projesinde `Chatbot` şu dış sözleşmeyle kullanılmaktadır:

```ts
type ChatbotProps = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
};
```

Bu sözleşme bu görevde korunmalıdır. `app/page.tsx` içinde widget'ı açan mevcut
hero, ürün ve diğer CTA'ların davranışı bozulmamalıdır.

### 3.1. Korunacak işlevler

- Kapalı durumda launcher gösterme
- Launcher ile widget'ı açma
- Header düğmesiyle widget'ı kapatma
- `Escape` ile widget'ı kapatma
- Açılışta mesaj girişine odaklanma
- Hoş geldiniz mesajını gösterme
- Hızlı işlem düğmelerini gösterme
- Metin mesajı gönderme
- Yerel demo motorundan yanıt alma
- Ürün sonuç kartlarını gösterme
- Sipariş durum kartını gösterme
- Bayi haritası ve bayi listesini gösterme
- SSS yanıt kartını gösterme
- Mesaj altı bağlamsal işlem düğmelerini gösterme
- Yanıt beklenirken ikinci gönderimi engelleme
- Sohbeti yeniden başlatma
- Mesaj geldikçe kontrollü biçimde aşağı kaydırma

### 3.2. Korunacak iş mantığı sınırı

Aşağıdaki dosyadaki niyet çözümleme ve demo veri eşleştirme davranışları bu
adımda yeniden tasarlanmamalıdır:

```text
lib/chatbot/engine.ts
```

Şunlar aynı kalmalıdır:

- Dört niyet: `product`, `order`, `dealer`, `faq`
- Türkçe metin normalizasyonu
- Ürün renk/ölçü/kategori eşleştirmesi
- Demo sipariş numarası eşleştirmesi
- Şehir bazlı bayi eşleştirmesi
- Anahtar sözcük bazlı SSS eşleştirmesi
- Mevcut demo mesajlarının anlamı

Metinlerde erişilebilirlik veya tutarlılık için küçük düzenleme yapılabilir;
ancak ürün/sipariş/bayi/SSS sonuçlarını değiştiren yeni kural eklenmemelidir.

---

## 4. Kapsam sınırı

### 4.1. Bu görevde yapılacaklar

- Widget bileşen mimarisini düzenlemek
- Launcher, header, mesaj listesi, composer ve yardımcı kartları ayrıştırmak
- Tek ve açık bir UI durum modeli oluşturmak
- Focus yönetimini düzeltmek
- Ekran okuyucu duyurularını düzeltmek
- Mobil ve desktop yerleşimini iyileştirmek
- Gönderme/bekleme/hata/yeniden deneme/sıfırlama durumlarını tanımlamak
- Yerel motoru transport arayüzü arkasına almak
- Demo gizlilik uyarısını iyileştirmek
- Mesaj girişini çok satırlı ve erişilebilir hale getirmek
- Otomatik kaydırmayı kullanıcı kontrolünü bozmayacak şekilde düzenlemek
- Widget deneyimi dokümanını ve ilgili testleri eklemek

### 4.2. Bu görevde yapılmayacaklar

- FastAPI endpoint'i yazmak
- LangGraph graph'ını değiştirmek
- Redis bağlantısı kurmak
- Gerçek session ID üretim/saklama altyapısı kurmak
- Gerçek Merinos ürün, stok, sipariş veya bayi API'sine bağlanmak
- Kullanıcının tarayıcı konum iznini istemek
- Kimlik doğrulama yapmak
- Gerçek müşteri temsilcisine aktarma yapmak
- Chatwoot veya Frappe Helpdesk bağlantısı kurmak
- Sesli mesaj, dosya yükleme, görsel yükleme veya kamera özelliği eklemek
- Sepete ekleme, ödeme, iade başlatma veya sipariş değiştirme işlemi eklemek
- Markdown/HTML çalıştıran serbest biçimli mesaj render sistemi kurmak
- Mesajları `localStorage`, cookie veya analitik servise kalıcı yazmak

---

## 5. Konuşma deneyimi ilkeleri

Widget aşağıdaki ürün ilkelerine uymalıdır.

### 5.1. Açıklık

- Kullanıcı her zaman bunun bir demo olduğunu anlayabilmelidir.
- Hangi işlemlerin desteklendiği dört kısa başlıkla görünür olmalıdır.
- Sistem işlem yapmadığında “işleminiz tamamlandı” gibi yanıltıcı dil
  kullanmamalıdır.
- Gerçek kişisel veri istenmediği açıkça belirtilmelidir.
- Sipariş akışında yalnız temsili numaraların kullanılacağı söylenmelidir.

### 5.2. Kontrol

- Kullanıcı widget'ı her zaman kapatabilmelidir.
- Gönderilmemiş metin, yanlışlıkla widget kapanınca silinmemelidir.
- Sohbeti sıfırlama işlemi yanlışlıkla tetiklenmemelidir.
- Otomatik kaydırma, eski mesajları okuyan kullanıcıyı zorla alta taşımamalıdır.
- Hata durumunda kullanıcı yeniden deneyebilmeli veya yeni mesaj yazabilmelidir.

### 5.3. Tutarlılık

- Aynı işlem aynı button stili ve aynı fiille ifade edilmelidir.
- “Ürün bul”, “Sipariş sorgula”, “Bayi bul” ve “Sık sorulanlar” adları
  launcher, hızlı işlemler ve açıklamalarda tutarlı kullanılmalıdır.
- Bot, sistem, kullanıcı ve hata mesajları görsel olarak ayırt edilmelidir.
- Disabled, loading, hover, focus ve active durumları tasarım sistemiyle uyumlu
  olmalıdır.

### 5.4. Güvenli başarısızlık

- Beklenmeyen hata durumunda teknik stack trace kullanıcıya gösterilmemelidir.
- Gönderilen metin hata sonrası kaybolmamalıdır.
- “Tekrar dene” işlemi aynı kullanıcı mesajını ikinci kez görünür geçmişe
  eklememelidir.
- Bir hata bütün konuşmayı sıfırlamamalıdır.
- UI, başarısız isteği başarılı yanıt gibi göstermemelidir.

### 5.5. Kısa ve yönlendirici dil

Bot mesajları:

- Önce sonucu veya ihtiyaç duyulan bilgiyi söylemelidir.
- Mümkünse tek sonraki adım önermelidir.
- Gereksiz kurumsal jargon kullanmamalıdır.
- Tamamı büyük harf uzun metin içermemelidir.
- Aynı demo uyarısını her mesajda tekrar etmemelidir.

---

## 6. Hedef bileşen mimarisi

`components/Chatbot.tsx` dış import uyumluluğu için korunmalıdır. Tercih edilen
hedef yapı aşağıdaki gibidir:

```text
components/
├── Chatbot.tsx                         # geriye uyumlu public facade
└── chatbot/
    ├── ChatbotWidget.tsx               # widget kompozisyonu
    ├── ChatLauncher.tsx
    ├── ChatHeader.tsx
    ├── ChatPrivacyNotice.tsx
    ├── ChatMessageList.tsx
    ├── ChatMessageItem.tsx
    ├── ChatComposer.tsx
    ├── ChatQuickActions.tsx
    ├── ChatStatusAnnouncer.tsx
    ├── ResetChatDialog.tsx             # gerekiyorsa küçük onay dialog'u
    ├── cards/
    │   ├── ChatProductCard.tsx
    │   ├── OrderStatusCard.tsx
    │   ├── DealerResults.tsx
    │   └── FaqAnswerCard.tsx
    ├── hooks/
    │   ├── useChatController.ts
    │   ├── useChatFocus.ts
    │   └── useChatAutoScroll.ts
    └── index.ts
```

Bu tam dosya sayısı bağlayıcı değildir. Cursor, gereksiz mikro bileşen üretmeden
benzer bir sorumluluk ayrımı yapabilir. Aşağıdaki sınırlar bağlayıcıdır:

- Dışarıdan import edilen `@/components/Chatbot` yolu çalışmaya devam etmelidir.
- `Chatbot` public prop sözleşmesi korunmalıdır.
- Konuşma state'i kart bileşenlerinin içine dağılmamalıdır.
- Kart bileşenleri yalnız aldığı veriyi göstermeli ve açık callback'ler
  çağırmalıdır.
- `resolveChatInput` doğrudan birden fazla görsel bileşende çağrılmamalıdır.
- Timer, retry, pending ve reset yönetimi tek controller içinde olmalıdır.
- Genel site state'i chatbot alt bileşenlerine kopyalanmamalıdır.
- `any`, kontrolsüz type assertion veya global mutable değişken
  kullanılmamalıdır.

### 6.1. Public facade örneği

Aşağıdaki yaklaşım kullanılabilir:

```tsx
export { ChatbotWidget as Chatbot } from "@/components/chatbot/ChatbotWidget";
```

veya `components/Chatbot.tsx` içinde küçük bir wrapper korunabilir. Amaç mevcut
importları kırmamaktır.

---

## 7. UI durum modeli

Widget durumu tek bir controller tarafından yönetilmelidir. En az aşağıdaki
kavramlar açık biçimde temsil edilmelidir:

```ts
type ChatRequestStatus =
  | "idle"
  | "waiting"
  | "error";

type ChatUiState = {
  messages: ChatMessage[];
  draft: string;
  activeIntent: ChatIntent;
  requestStatus: ChatRequestStatus;
  failedRequest: FailedChatRequest | null;
  unreadCount: number;
  resetDialogOpen: boolean;
};
```

İsimler farklı olabilir; ancak aynı kavramların birbirine karışmaması gerekir.

### 7.1. Durum anlamları

| Durum | Anlam | UI davranışı |
| --- | --- | --- |
| `idle` | Mesaj gönderilebilir | Composer ve işlemler etkin |
| `waiting` | Yanıt bekleniyor | Yeni gönderim engelli, durum açıklanır |
| `error` | Son istek başarısız | Mesaj korunur, yeniden deneme görünür |

### 7.2. Türetilmiş durumlar

Ayrı state olarak gereksiz tekrar tutulmamalıdır:

```text
isBusy          = requestStatus === "waiting"
canSend         = draft.trim().length > 0 && !isBusy
hasConversation = messages.length > 1
hasUnread       = unreadCount > 0
```

### 7.3. State güncelleme kuralları

- Kullanıcı mesajı gönderildiğinde geçmişe yalnız bir kez eklenmelidir.
- Yanıt başarıyla alındığında bot mesajı yalnız bir kez eklenmelidir.
- Hata durumunda kullanıcı mesajı geçmişte kalmalıdır.
- Retry aynı mesajı tekrar görünür kullanıcı balonu olarak eklememelidir.
- Reset bütün timer/istek referanslarını temizlemelidir.
- Close işlemi konuşmayı sıfırlamamalıdır.
- Open işlemi hoş geldiniz mesajını tekrar tekrar eklememelidir.
- Bileşen unmount olduğunda bekleyen timer temizlenmelidir.

---

## 8. Transport sınırı

Bu görevde gerçek backend bağlantısı kurulmayacaktır. Ancak UI bileşeninin yerel
motor detayına sıkı bağlı kalmaması için küçük bir transport arayüzü
oluşturulmalıdır.

Örnek sözleşme:

```ts
export type ChatRequest = {
  text: string;
  activeIntent: ChatIntent;
};

export type ChatTransportResult = ChatReply;

export interface ChatTransport {
  send(request: ChatRequest, options?: { signal?: AbortSignal }):
    Promise<ChatTransportResult>;
}
```

Yerel demo implementasyonu:

```ts
export function createLocalChatTransport(): ChatTransport {
  return {
    async send({ text, activeIntent }) {
      return resolveChatInput(text, activeIntent);
    },
  };
}
```

### 8.1. Bağlayıcı kurallar

- Transport yalnız UI ile yanıt kaynağı arasındaki sınırı oluşturmalıdır.
- Gerçek endpoint URL'si veya `fetch` çağrısı eklenmemelidir.
- Yapay olarak uzun bekleme eklenmemelidir.
- Mevcut yaklaşık demo gecikmesi korunacaksa tek yerde, iptal edilebilir biçimde
  uygulanmalıdır.
- `AbortController` desteği varsa reset/unmount sırasında iptal edilmelidir.
- Transport hatası controller tarafından güvenli kullanıcı mesajına
  çevrilmelidir.
- `resolveChatInput` işlevi değiştirilmeden adapter içinde kullanılabilir.
- Gelecek backend sözleşmesi bu görevde tahmin edilip aşırı modellenmemelidir.

### 8.2. Demo gecikmesi

Yerel motor çok hızlı yanıt verdiği için kısa bir “yanıt hazırlanıyor” durumu
korunabilir. Bu süre:

```text
minimum: 150 ms
önerilen: 250–450 ms
maximum: 700 ms
```

olmalıdır. Süre tek bir sabitte tutulmalı ve testlerde uzun beklemeye neden
olmamalıdır. `prefers-reduced-motion` bu gecikmeyi zorunlu olarak kaldırmaz;
ancak yükleme animasyonu sadeleşmelidir.

---

## 9. Launcher deneyimi

Launcher, widget kapalıyken görünen ana giriş noktasıdır.

### 9.1. İçerik

Launcher en az şunları göstermelidir:

- Demo marka/avatar işareti
- “Merinos Dijital Asistan” adı veya kısa yardım çağrısı
- Açık ve anlaşılır erişilebilir ad
- Okunmamış yanıt varsa sayısal veya metinsel gösterge

### 9.2. Davranış

- Tıklama widget'ı açmalıdır.
- Klavyede `Enter` ve `Space` ile çalışmalıdır.
- İlk açılışta unread durumu temizlenmelidir.
- Widget açıkken launcher DOM'da çift etkileşimli olarak kalmamalıdır.
- Widget kapandığında odak launcher'a dönmelidir.
- Launcher ana sayfanın CTA, cookie alanı veya footer bağlantılarını
  kapatmamalıdır.
- Mobil safe-area değerlerine uymalıdır.
- 200% zoom altında ekran dışına taşmamalıdır.

### 9.3. Okunmamış yanıt

Kullanıcı yanıt beklerken widget'ı kapatırsa yerel yanıt tamamlanabilir. Yanıt
kapalı durumda geldiyse:

- Launcher okunmamış yanıt olduğunu göstermelidir.
- Gösterge yalnız renge dayanmamalıdır.
- Widget yeniden açıldığında unread sayısı sıfırlanmalıdır.
- Konuşma geçmişi korunmalıdır.

Başlangıçta sahte okunmamış mesaj gösterilmemelidir. Hoş geldiniz mesajı unread
sayılmamalıdır.

---

## 10. Widget kabuğu ve header

### 10.1. Semantik

Widget aşağıdaki semantiğe uygun olmalıdır:

```tsx
<aside
  role="dialog"
  aria-modal="false"
  aria-labelledby="chat-title"
  aria-describedby="chat-demo-notice"
>
```

Bu widget sayfayı tamamen kilitleyen bir modal değildir. Bu nedenle:

- `aria-modal="true"` kullanılmamalıdır.
- Focus trap uygulanmamalıdır.
- Arka sayfa yanlışlıkla `aria-hidden` yapılmamalıdır.
- Body scroll tüm ekranlarda zorunlu olarak kilitlenmemelidir.

Mobilde tam genişliğe yakın bir sheet görünümü kullanılabilir; semantik yine
non-modal kalmalıdır. Gerçek modal davranışı seçilirse backdrop, focus trap,
body scroll lock ve `aria-modal` birlikte ve eksiksiz uygulanmalıdır. Yarım
modal yaklaşım kabul edilmez.

### 10.2. Header içeriği

Header şunları içermelidir:

- Avatar/monogram
- `h2` veya uygun başlık seviyesinde “Merinos Dijital Asistan”
- “Demo” durum etiketi
- Yeniden başlat düğmesi
- Kapat düğmesi

“Çevrimiçi” ifadesi gerçek canlı hizmet izlenimi vermemelidir. Tercih edilen
metinlerden biri:

```text
Demo asistan
Yerel demo
Temsili yanıtlar
```

Gerçek operasyonel presence bilgisi yoksa yeşil nokta + “Çevrimiçi” dili
kullanılmamalıdır.

### 10.3. Header düğmeleri

- İkon düğmelerinin erişilebilir adları bulunmalıdır.
- `title` tek erişilebilir açıklama olarak kullanılmamalıdır.
- Focus görünür olmalıdır.
- Dokunmatik hedef en az yaklaşık 44×44 px olmalıdır.
- Reset düğmesi konuşma varsa etkin olmalıdır.
- Kapat düğmesi her durumda etkin olmalıdır.

---

## 11. Demo ve gizlilik bildirimi

Widget içinde kısa fakat görünür bir demo bildirimi bulunmalıdır.

Önerilen içerik:

```text
Demo ortamı: Gerçek ad, telefon, adres veya sipariş bilgisi girmeyin.
Gösterilen ürün, sipariş ve bayi kayıtları temsilidir.
```

### 11.1. Kurallar

- Bildirim header'ın hemen altında veya ilk mesaj öncesinde yer almalıdır.
- `id="chat-demo-notice"` gibi sabit bir kimlikle dialog açıklamasına
  bağlanmalıdır.
- Küçük font nedeniyle okunamaz hale gelmemelidir.
- Sadece uyarı ikonu ile verilmemelidir.
- Kapatılabilir yapılırsa aynı sayfa oturumu içinde tekrar çıkmaması yeterlidir;
  kalıcı cookie yazılmamalıdır.
- Gerçek KVKK aydınlatma metniymiş gibi sunulmamalıdır.
- Gizlilik bildirimi konuşma geçmişine bot mesajı olarak tekrar tekrar
  eklenmemelidir.

---

## 12. Hoş geldiniz ve ilk kullanım

İlk açılış görünümü kullanıcının desteklenen dört alanı anlamasını sağlamalıdır.

### 12.1. Hoş geldiniz mesajı

Mevcut anlam korunarak metin şu niteliklerde olmalıdır:

- Asistanın demo olduğunu söyler.
- Dört temel yeteneği kısa biçimde belirtir.
- Gerçek işlem tamamlamadığını ima etmez.
- En fazla iki kısa cümleden oluşur.

### 12.2. Başlangıç işlemleri

İlk kullanımda en az dört ana işlem erişilebilir olmalıdır:

```text
Ürün bul
Sipariş sorgula
Bayi bul
Sık sorulanlar
```

Bunlar:

- Mesaj içi action olarak veya sabit quick action alanında gösterilebilir.
- Aynı ekranda gereksiz şekilde iki kez büyük buton grubu olarak
  tekrarlanmamalıdır.
- Mobilde yatay kaydırma kullanılıyorsa görünür kaydırma ipucu olmalıdır;
  tercih edilen yaklaşım sarılan iki sütun/tek sütun yapıdır.
- Klavye sırası doğal olmalıdır.

### 12.3. Örnek sorgu

Composer placeholder'ı tek örnek verebilir:

```text
Örn. Krem 160x230 salon halısı
```

Placeholder label yerine kullanılmamalıdır. Görünür veya ekran okuyucuya açık
bir label bulunmalıdır.

---

## 13. Mesaj listesi

### 13.1. Semantik yapı

Mesaj geçmişi tercihen liste semantiği kullanmalıdır:

```tsx
<ol aria-label="Sohbet mesajları">
  <li>...</li>
</ol>
```

Alternatif yapı kullanılabilir; fakat mesajların sırası ve göndereni ekran
okuyucuda anlaşılır olmalıdır.

### 13.2. Gönderen ayrımı

- Kullanıcı ve bot balonları yalnız renkle ayrılmamalıdır.
- Bot avatarı dekoratifse `aria-hidden="true"` olmalıdır.
- Ekran okuyucu metninde “Siz” ve “Merinos Dijital Asistan” ayrımı
  sağlanmalıdır.
- Aynı gönderenin ardışık mesajlarında görsel sadeleştirme yapılabilir; semantik
  kaybolmamalıdır.

### 13.3. Mesaj metni

- Kullanıcı metni yalnız plain text olarak render edilmelidir.
- `dangerouslySetInnerHTML` kullanılmamalıdır.
- Bot yanıtlarında serbest HTML/Markdown çalıştırılmamalıdır.
- URL otomatik linkleme bu görevde zorunlu değildir.
- Çok uzun kelimeler container dışına taşmamalıdır.
- Satır sonları güvenli biçimde gösterilmelidir.
- Metin seçimi engellenmemelidir.

### 13.4. Tarih/saat

Demo için her mesaja saat eklemek zorunlu değildir. Saat eklenirse:

- Aynı sayfa oturumundaki yerel saat kullanılabilir.
- Ekran okuyucu için anlaşılır format sağlanmalıdır.
- Hassas veya gereksiz metadata tutulmamalıdır.
- Testler değişken saat metnine kırılgan biçimde bağlanmamalıdır.

---

## 14. Canlı bölge ve durum duyuruları

Mevcut bütün `chat-body` alanını `aria-live="polite"` yapmak, her state
güncellemesinde eski içeriğin tekrar okunmasına neden olabilir. Bunun yerine ayrı
bir status announcer kullanılmalıdır.

Önerilen yapı:

```tsx
<div className="sr-only" aria-live="polite" aria-atomic="true">
  {announcement}
</div>
```

### 14.1. Duyurulacak olaylar

- “Mesaj gönderildi.”
- “Asistan yanıt hazırlıyor.”
- “Yeni asistan yanıtı geldi.”
- “Mesaj gönderilemedi.”
- “Sohbet yeniden başlatıldı.”
- “2 ürün sonucu gösteriliyor.” gibi bağlamsal kısa bilgi

### 14.2. Duyurulmaması gerekenler

- Bütün konuşma geçmişi
- Animasyon noktalarının her değişimi
- Dekoratif avatar harfi
- Her scroll hareketi
- Hover değişimleri
- Aynı mesajın hem canlı bölge hem focus ile iki kez tam okunması

### 14.3. Busy durumu

Mesaj alanı veya composer uygun yerde `aria-busy` kullanabilir. `aria-busy`
sürekli tüm dialog üzerinde tutulmamalıdır; aksi halde kontrollerin duyurulması
gecikebilir.

---

## 15. Mesaj gönderme ve composer

### 15.1. Kontrol türü

Tek satır `input` yerine otomatik büyüyen `textarea` tercih edilmelidir.

Gereksinimler:

- Başlangıçta tek satır yüksekliği
- En fazla yaklaşık dört satıra kadar otomatik büyüme
- Sonrasında iç scroll
- Görünür veya screen-reader label
- Açık placeholder
- Gönder düğmesi
- Karakter sınırı

Önerilen sınır:

```text
minimum: boş olmayan metin
maximum: 500 karakter
```

500 karakter zorunlu üst sınır olarak uygulanabilir. Farklı bir sınır seçilirse
`docs/09-CHATBOT-DENEYIMI.md` içinde gerekçelendirilmelidir ve 1000 karakteri
geçmemelidir.

### 15.2. Klavye davranışı

- `Enter`: mesaj gönderir.
- `Shift+Enter`: yeni satır ekler.
- IME composition sırasında `Enter` mesaj göndermemelidir.
- Boş veya yalnız whitespace içeren mesaj gönderilmemelidir.
- Bekleme sırasında tekrar gönderim engellenmelidir.
- `Escape`: widget'ı kapatır; reset dialog'u açıksa önce dialog'u kapatmalıdır.

### 15.3. Gönder düğmesi

- Anlaşılır `aria-label` bulunmalıdır.
- Boş draft veya waiting durumunda disabled olmalıdır.
- Yalnız “↑” gibi karaktere güvenilmemelidir; ikon varsa erişilebilir ad
  zorunludur.
- Loading sırasında düğme şekli zıplamamalıdır.
- Spinner kullanılıyorsa reduced-motion altında sadeleşmelidir.

### 15.4. Draft korunması

- Widget kapatılıp açıldığında gönderilmemiş draft aynı sayfa oturumunda
  korunmalıdır.
- Sohbet resetlenince draft temizlenmelidir.
- Sayfa yenilenince draft'ın sıfırlanması kabul edilir.
- Draft `localStorage` veya cookie'ye yazılmamalıdır.

### 15.5. Karakter geri bildirimi

Sınır yaklaşınca kullanıcıya sayaç gösterilebilir:

```text
450/500 sonrasında görünür sayaç
500 üzerinde gönderim yok
```

Sayaç her tuşta canlı bölgeden okunmamalıdır. Limit aşıldığında kısa hata
metniyle ilişkilendirilmelidir.

---

## 16. Hızlı işlemler ve bağlamsal işlemler

### 16.1. Sabit hızlı işlemler

Dört ana işlem composer üstünde veya hoş geldiniz alanında sunulabilir.

Kurallar:

- Waiting durumunda disabled olmalıdır.
- Butonlar gerçek `<button type="button">` olmalıdır.
- Icon dekoratifse `aria-hidden` kullanılmalıdır.
- Buton label'ı tek başına ne yaptığını anlatmalıdır.
- Küçük ekranda metin kesilmemelidir.
- Hızlı işlem tıklaması kullanıcı mesajı gibi geçmişe eklenebilir; mevcut
  davranış korunmalıdır.

### 16.2. Mesaj içi işlemler

Örnekler:

```text
Yeni arama
Başka sipariş
Başka şehir
Diğer sorular
Tekrar dene
```

Kurallar:

- İşlem yalnız bağlı olduğu bot/hata mesajının altında görünmelidir.
- Aynı değerle birden fazla aktif düğme gereksiz tekrar oluşturmamalıdır.
- Waiting durumunda iş akışı başlatan butonlar disabled olmalıdır.
- Seçilen action yeni kullanıcı mesajı üretiyorsa görünen label ile gönderilen
  değer arasında yanıltıcı fark olmamalıdır.
- Kritik olmayan action için onay dialog'u açılmamalıdır.

---

## 17. Yanıt bekleme deneyimi

### 17.1. Görsel durum

Yanıt beklenirken:

- Bot tarafında sade bir “Yanıt hazırlanıyor” satırı veya üç nokta animasyonu
  gösterilebilir.
- Ekran okuyucuya bir kez “Asistan yanıt hazırlıyor” duyurulmalıdır.
- Composer ve iş akışı başlatan düğmeler disabled olmalıdır.
- Kapat düğmesi etkin kalmalıdır.
- Reset düğmesi etkin kalabilir; reset işlemi bekleyen isteği iptal etmelidir.

### 17.2. Animasyon

- Nokta animasyonu dekoratif olmalıdır.
- `prefers-reduced-motion: reduce` altında hareket durmalı veya basit statik
  metne dönmelidir.
- Animasyon layout shift üretmemelidir.
- Sonsuz spinner tek bilgi kaynağı olmamalıdır; metinsel durum bulunmalıdır.

### 17.3. Widget kapanırsa

- Bekleyen yerel yanıt zorunlu olarak iptal edilmemelidir.
- Yanıt tamamlandığında konuşmaya eklenebilir.
- Widget kapalıysa unread sayısı artırılmalıdır.
- Bileşen tamamen unmount olursa timer/istek temizlenmelidir.
- Reset yapılırsa eski yanıt daha sonra konuşmaya eklenmemelidir.

Bu davranış race condition testleriyle doğrulanmalıdır.

---

## 18. Hata ve yeniden deneme deneyimi

Transport katmanı hata fırlattığında kullanıcıya teknik olmayan bir inline hata
gösterilmelidir.

Önerilen metin:

```text
Yanıt hazırlanamadı. Mesajınızı tekrar deneyebilir veya başka bir soru yazabilirsiniz.
```

### 18.1. Hata kartı

Hata kartı:

- `role="status"` veya uygun canlı duyuru ile bildirilmelidir.
- “Tekrar dene” düğmesi içermelidir.
- “Kapat” veya “Yeni mesaj yaz” için zorunlu ekstra düğme gerektirmez.
- Teknik hata objesini kullanıcıya yazmamalıdır.
- Bot mesajı gibi yanıltıcı avatar kullanmamalıdır.
- Yalnız kırmızı renkle anlatılmamalıdır.

### 18.2. Retry davranışı

Retry:

- Son başarısız request'in text ve active intent bilgisini kullanmalıdır.
- Aynı kullanıcı mesajını ikinci kez geçmişe eklememelidir.
- Hata kartını waiting durumuna çevirmeli veya geçici olarak kaldırmalıdır.
- Başarılı olursa tek bot yanıtı eklemelidir.
- Tekrar hata olursa retry yeniden kullanılabilmelidir.
- Çift tıklamada paralel istek başlatmamalıdır.

### 18.3. Yerel demo hata testi

Production davranışına gizli hata tetikleyicisi eklenmemelidir. Testte transport
mock'u hata fırlatacak biçimde inject edilebilir. Kullanıcıların yazacağı özel bir
kelimeyle uygulamayı hata durumuna sokan arka kapı eklenmemelidir.

---

## 19. Sohbeti sıfırlama

Sohbet sıfırlama veri kaybettiren bir UI işlemidir; yanlışlıkla tetiklenmemelidir.

### 19.1. Onay davranışı

Konuşmada yalnız hoş geldiniz mesajı varsa reset doğrudan yapılabilir veya düğme
disabled olabilir. Kullanıcı mesajı varsa küçük bir onay dialog'u açılmalıdır.

Önerilen içerik:

```text
Sohbet yeniden başlatılsın mı?
Bu sayfadaki mesajlar temizlenecek. Demo verileri etkilenmez.

Vazgeç
Yeniden başlat
```

### 19.2. Onay dialog'u erişilebilirliği

- `role="alertdialog"` veya uygun `dialog` semantiği kullanılmalıdır.
- Başlık ve açıklama `aria-labelledby`/`aria-describedby` ile bağlanmalıdır.
- Açıldığında güvenli varsayılan olarak “Vazgeç” düğmesine veya dialog başına
  odak verilebilir.
- `Escape` yalnız dialog'u kapatmalıdır.
- Kapatınca odak reset düğmesine dönmelidir.
- Onaylandığında dialog kapanmalı, state temizlenmeli ve composer'a odak
  verilmelidir.

Tarayıcı `window.confirm` kullanılmamalıdır; görsel ve erişilebilir deneyim proje
kontrolünde olmalıdır.

### 19.3. Reset sırasında temizlenecekler

```text
messages
activeIntent
draft
failedRequest
requestStatus
unreadCount
bekleyen timer
bekleyen AbortController
```

Reset sonrası tek yeni hoş geldiniz mesajı gösterilmelidir.

---

## 20. Focus yönetimi

Focus davranışı açık ve test edilebilir olmalıdır.

### 20.1. Açılış

- Launcher'a tıklanınca widget açılır.
- Kısa render sonrasında composer'a odak verilir.
- Kullanıcı klavyeyle açtıysa focus görünür kalır.
- Scroll sayfanın rastgele başka yerine sıçramamalıdır.

### 20.2. Kapanış

- Header kapatma düğmesi veya `Escape` ile kapanınca focus launcher'a dönmelidir.
- Widget sayfa CTA'sı üzerinden programatik açıldıysa kapanışta mümkünse açan
  öğeye dönmelidir; bu bilgi mevcut mimaride güvenilir değilse launcher'a dönmek
  kabul edilir.
- Gizli veya unmount edilmiş öğeye focus çağrısı yapılmamalıdır.

### 20.3. Mesaj gönderimi

- Mesaj gönderildikten sonra composer focus'u korunmalıdır.
- Waiting sırasında disabled textarea focus'u kaybederse yanıt sonrası tekrar
  composer'a zorla odak verilmemelidir; kullanıcı başka yere geçtiyse seçimi
  korunmalıdır.
- Retry sonrası focus beklenmedik biçimde sayfa başına gitmemelidir.

### 20.4. Focus trap yasağı

Widget `aria-modal="false"` olduğu sürece focus trap uygulanmamalıdır. Kullanıcı
`Tab` ile sayfanın diğer kontrollerine geçebilmelidir. Widget içindeki tab sırası
DOM sırasıyla uyumlu olmalıdır.

---

## 21. Otomatik kaydırma

Mevcut her mesaj değişiminde koşulsuz `scrollTo(..., behavior: "smooth")`
yaklaşımı, eski mesajları okuyan kullanıcıyı rahatsız edebilir.

### 21.1. Yakınlık kuralı

Kullanıcı mesaj listesinin altına yakınsa yeni mesaj geldiğinde alta
kaydırılmalıdır. Alt sınır örneği:

```text
scrollHeight - scrollTop - clientHeight <= 80 px
```

Kullanıcı daha yukarıdaysa otomatik kaydırma yapılmamalı; bunun yerine “Yeni
mesaj” düğmesi gösterilebilir.

### 21.2. Kullanıcı mesajı

Kullanıcı kendi mesajını gönderdiğinde yeni mesajı görebilmesi için alta
kaydırma yapılabilir. Bu hareket reduced-motion altında `auto`, diğer durumda
`smooth` olabilir.

### 21.3. Kart yüksekliği

Ürün kartı, harita veya sipariş timeline'ı render sonrası yüksekliği değiştirse
bile son mesaj görünür kalmalıdır. Sonsuz ResizeObserver döngüsü
oluşturulmamalıdır.

### 21.4. Scroll button

“Son mesaja git” düğmesi eklenirse:

- Mesaj listesi üzerinde anlaşılır konumda olmalıdır.
- `aria-label="Son mesaja git"` bulunmalıdır.
- Yeni mesaj sayısı gösterilebilir.
- Alta gelindiğinde gizlenmelidir.
- Composer'ı kapatmamalıdır.

---

## 22. Zengin mesaj kartları

Mevcut kartlar korunacak, ancak ortak görsel ve erişilebilirlik sözleşmesine
uyarlanacaktır.

### 22.1. Ortak kurallar

- Her kart bot mesaj balonunun semantik devamı olmalıdır.
- Kart container dışına taşmamalıdır.
- Kart içindeki button ve linkler klavyeyle erişilebilir olmalıdır.
- Başlık, açıklama ve durum bilgisi açık hiyerarşiye sahip olmalıdır.
- Demo/temsili bilgi kart içinde gerektiği yerde belirtilmelidir.
- Kart listeleri çok uzamamalı; mevcut `slice` sınırları korunmalıdır.
- Kart içinde gerçek ödeme veya kişisel veri girişi bulunmamalıdır.

### 22.2. Ürün kartı

Ürün kartı şunları göstermelidir:

```text
Ürün adı
Renk
Ölçü
Fiyat
Temsili görsel
```

Mevcut veri izin veriyorsa stok durumu da gösterilebilir; ancak ürün arama iş
mantığı değiştirilmemelidir.

Kurallar:

- Bütün kart button ise iç içe button/link bulunmamalıdır.
- Erişilebilir adı yalnız ürün adından ibaret kalmamalı; eylemi anlatmalıdır.
- Örnek: “Valeria krem 160x230 ürününü göster”.
- Fiyat `Intl.NumberFormat("tr-TR")` ile biçimlenmeye devam etmelidir.
- Temsili görsel dekoratifse alternatif metin tekrarı oluşturmamalıdır.

### 22.3. Sipariş durum kartı

- “Demo sipariş” etiketi görünür kalmalıdır.
- Sipariş numarası, durum ve tahmini teslimat ayrılmalıdır.
- Timeline yalnız renk ile durum anlatmamalıdır.
- Her adım metinsel `Tamamlandı`, `Güncel`, `Sıradaki` karşılığına sahip olmalıdır.
- Cargo kodu “Demo takip kodu” olarak kalmalıdır.
- Gerçek kargo takip linki eklenmemelidir.

### 22.4. Bayi sonuçları

- Harita ve liste aynı seçili bayi state'ini paylaşmalıdır.
- Harita klavye erişimi `DealerMap` sözleşmesine göre korunmalıdır.
- Seçili bayi yalnız arka plan rengiyle belirtilmemelidir.
- Adres, çalışma saati ve telefon temsili olduğu açıkça yazılmalıdır.
- Telefon numarası gerçek arama linkine çevrilmemelidir.
- Otomatik konum izni istenmemelidir.

### 22.5. SSS kartı

- Soru, yanıt metninin üstünde görünür olmalıdır.
- “Demo bilgi bankası yanıtı” açıklaması korunabilir.
- Soru heading semantiğiyle veya güçlü metinle ayrılmalıdır.
- Yanıt yalnız kartın küçük etiketi içinde kaybolmamalıdır.
- Harici kaynak iddiası eklenmemelidir.

---

## 23. Responsive ve mobil davranış

Widget en az aşağıdaki genişliklerde kontrol edilmelidir:

```text
320, 375, 430, 768, 1024, 1280, 1440
```

### 23.1. Desktop

- Widget yaklaşık 380–430 px aralığında okunabilir bir genişliğe sahip olabilir.
- Yükseklik viewport'u aşmamalıdır.
- Launcher ile widget aynı anda üst üste görünmemelidir.
- Sayfa sağ kenarı ve alt kenarla güvenli boşluk bırakılmalıdır.
- Ürün/bayi kartı içeriği yatay taşmamalıdır.

### 23.2. Mobil

- Widget ekranın büyük bölümünü kullanan bottom sheet veya tam yükseklikli panel
  olabilir.
- `100vh` yerine desteklenen yerlerde `100dvh` kullanılmalıdır.
- `env(safe-area-inset-bottom)` hesaba katılmalıdır.
- Header ve composer görünür kalmalıdır.
- Mesaj listesi bağımsız scroll alanı olmalıdır.
- Sanal klavye açılınca composer ekran dışında kalmamalıdır.
- iOS zoom davranışını önlemek için form fontu 16 px altına düşmemelidir.
- Close ve reset düğmeleri notch/safe-area ile çakışmamalıdır.
- Yatay taşma oluşmamalıdır.

### 23.3. Yükseklik dar ekranlar

`height <= 600px` gibi kısa viewport'larda:

- Header ve composer sıkıştırılabilir ama gizlenmemelidir.
- Privacy note daha kısa satır düzenine geçebilir.
- Quick action alanı mesaj listesini kullanılmaz hale getirmemelidir.
- Kartlar kendi içinde gereksiz sabit yüksekliğe sahip olmamalıdır.

### 23.4. Zoom

200% browser zoom ve yaklaşık 320 CSS px genişlikte:

- Mesaj metni kesilmemelidir.
- Header action'ları üst üste binmemelidir.
- Composer gönder düğmesi görünür olmalıdır.
- Dialog başlığı erişilebilir kalmalıdır.

---

## 24. Stil ve tasarım sistemi kullanımı

`02` adımında oluşturulan tokenlar kullanılmalıdır. Widget içinde yeni renk ve
spacing sistemi bağımsız olarak kurulmayacaktır.

### 24.1. Kullanılacak semantik token grupları

İsimler mevcut sisteme göre uyarlanabilir:

```css
--color-surface
--color-surface-elevated
--color-text
--color-text-muted
--color-brand
--color-brand-strong
--color-border
--color-focus
--color-success
--color-warning
--color-danger
--space-*
--radius-*
--shadow-*
--layer-chat-launcher
--layer-chat-window
--motion-fast
--motion-normal
```

### 24.2. Stil dosyası

Tercih edilen yapılardan biri:

```text
styles/chatbot.css
```

veya mevcut stil mimarisinin gerektirdiği eşdeğer dosyadır.

Kurallar:

- Chatbot stilleri global sayfa stilleri içinde dağınık bloklar olarak
  kalmamalıdır.
- `globals.css` yalnız import ve gerçekten global kuralları içermelidir.
- Class adları component sorumluluğunu anlaşılır kılmalıdır.
- Inline style yalnız dinamik ve güvenli değerler için kullanılmalıdır.
- Z-index değerleri keyfi büyük sayılarla değil layer tokenlarıyla
  yönetilmelidir.
- Focus ring bütün interaktif öğelerde görünür olmalıdır.
- Disabled durumda kontrast okunamaz seviyeye düşmemelidir.

### 24.3. Hareket

- Widget açılış/kapanış animasyonu 150–250 ms aralığında olmalıdır.
- Hareket opacity + küçük translate ile sınırlı tutulmalıdır.
- Büyük scale veya bounce kullanılmamalıdır.
- Reduced-motion altında animasyonlar kaldırılmalıdır.
- Mesaj geldiğinde bütün panel yeniden animasyon almamalıdır.

---

## 25. Erişilebilirlik gereksinimleri

### 25.1. Klavye

Klavye ile aşağıdakilerin tamamı yapılabilmelidir:

```text
Launcher'ı açma
Widget içinde dolaşma
Reset dialog'unu açma/kapatma
Widget'ı kapatma
Hızlı işlem seçme
Mesaj yazma ve gönderme
Shift+Enter ile satır ekleme
Mesaj içi action seçme
Ürün kartı seçme
Bayi seçme
Retry yapma
Son mesaja gitme düğmesi varsa kullanma
```

### 25.2. Focus görünürlüğü

- Mouse click sonrası gereksiz focus ring gösterilmemesi için `:focus-visible`
  kullanılabilir.
- Focus ring arka plan üzerinde en az 3:1 algılanabilir kontrasta sahip olmalıdır.
- `outline: none` tek başına kullanılmamalıdır.
- Sticky composer ve header focus öğesini kesmemelidir.

### 25.3. Ekran okuyucu

- Dialog adı ve açıklaması bağlı olmalıdır.
- Launcher erişilebilir adı bulunmalıdır.
- Mesaj göndereni anlaşılmalıdır.
- Waiting ve error durumları duyurulmalıdır.
- Icon karakterleri ekran okuyucudan gizlenmelidir.
- Buton adları görsel ikona bağlı kalmamalıdır.
- Privacy note dialog açıklamasına bağlanmalıdır.
- Bütün geçmiş canlı bölge yapılmamalıdır.

### 25.4. Kontrast ve renk

- Metin ve yüzey kontrastı WCAG AA hedeflemelidir.
- Seçili, hata, başarı ve disabled durumları yalnız renkle anlatılmamalıdır.
- Küçük muted metin okunabilir kalmalıdır.
- Demo etiketi dekoratif değil bilgi taşıyorsa metinsel olarak görünmelidir.

### 25.5. Dokunmatik

- Temel düğme hedefleri yaklaşık 44×44 px olmalıdır.
- Yan yana icon düğmeleri arasında yeterli boşluk olmalıdır.
- Küçük action chip'leri en az 40 px yüksekliğe yaklaşmalıdır.
- Hover zorunlu bilgi taşımamalıdır.

---

## 26. Güvenlik ve gizlilik sınırları

### 26.1. Kullanıcı girdisi

- Kullanıcı girdisi plain text olarak işlenmelidir.
- HTML parse edilmemelidir.
- Kullanıcı metni log'a yazılmamalıdır.
- Console üzerinde tam mesaj içeriği bırakılmamalıdır.
- Hata raporuna kişisel veri olabilecek draft eklenmemelidir.
- Gerçek sipariş numarası isteyen metin eklenmemelidir.

### 26.2. Kalıcılık

Bu görevde konuşma state'i yalnız React belleğinde tutulmalıdır.

Yasak depolama:

```text
localStorage
IndexedDB
cookie
URL query param
analytics payload
third-party telemetry
```

`sessionStorage` da bu adımda gerekli değildir ve kullanılmamalıdır. Redis session
state daha sonraki backend görevinde ele alınacaktır.

### 26.3. Dış bağlantı

- Kartlardan gerçek sipariş/kargo/telefon linki oluşturulmamalıdır.
- `target="_blank"` ile kontrolsüz dış link eklenmemelidir.
- Gerçek harita servisine kullanıcı girdisi gönderilmemelidir.
- Yeni üçüncü taraf chat SDK'sı eklenmemelidir.

---

## 27. Performans ve dayanıklılık

- Widget ilk render için ağır bağımlılık eklememelidir.
- Icon library yalnız bu görev için kurulması önerilmez; erişilebilir yerel SVG
  veya mevcut karakterler kullanılabilir.
- Mesaj listesi demo ölçekte olduğu için virtualization eklenmemelidir.
- Her tuşta bütün ürün/bayi kartları yeniden hesaplanmamalıdır.
- Stable callback ve component sınırları gereksiz renderları azaltmalıdır;
  ancak her bileşene ölçümsüz `memo` eklenmemelidir.
- Timer ve observer'lar cleanup yapmalıdır.
- `ResizeObserver`, `MutationObserver` veya global event listener eklenirse
  unmount sırasında kaldırılmalıdır.
- Scroll listener passive kullanılabiliyorsa kullanılmalıdır.
- Widget kapalıyken ağır harita/kart DOM'u render edilmemelidir.

### 27.1. Mesaj sayısı

Demo oturumunda mesajları keyfi olarak silmek gerekmez. Çok uzun konuşma için
UI performans sınırı konulursa:

- Kullanıcıya görünmeden eski mesajlar silinmemelidir.
- Bu görevde context compression yapılmamalıdır.
- Mesaj cap'i zorunlu değildir.
- Backend context yönetimi sonraki görevlerde ele alınacaktır.

---

## 28. Dokümantasyon çıktısı

Aşağıdaki dosya oluşturulmalıdır:

```text
docs/09-CHATBOT-DENEYIMI.md
```

Belge en az şu bölümleri içermelidir:

```text
Amaç ve kapsam
Widget bileşen mimarisi
Public prop sözleşmesi
UI durum modeli
Transport sınırı
Konuşma yaşam döngüsü
Launcher ve unread davranışı
Composer klavye kuralları
Loading, error ve retry davranışı
Reset davranışı
Focus yönetimi
Otomatik kaydırma
Zengin mesaj kartları
Responsive davranış
Erişilebilirlik kontrol listesi
Demo ve gizlilik sınırı
Yeni mesaj tipi ekleme rehberi
Test senaryoları
```

`README.md` veya `docs/README.md` içine bu belgeye göreli bağlantı eklenmelidir.

Belge yalnız component ağacı dump'ı olmamalı; kararları ve yeni geliştiricinin
uygulamayı nasıl güvenle genişleteceğini açıklamalıdır.

---

## 29. Uygulama adımları

Cursor aşağıdaki sırayı izlemelidir.

### Adım 1 — Başlangıç durumunu kaydet

- Ön koşul belgelerini oku.
- `Chatbot.tsx` state ve event haritasını çıkar.
- `engine.ts` iş mantığı sınırını belirle.
- Chat CSS selector listesini çıkar.
- Mevcut testleri çalıştırabiliyorsan çalıştır.
- Kullanıcının mevcut değişikliklerini koru.

### Adım 2 — Public sözleşmeyi sabitle

- `ChatbotProps` sözleşmesini test veya açık type ile koru.
- `@/components/Chatbot` import yolunu koru.
- `app/page.tsx` içindeki mevcut açma callback'lerini değiştirme.
- Geriye uyum testi ekle.

### Adım 3 — Transport sınırını oluştur

- `ChatTransport` benzeri küçük bir interface ekle.
- Yerel `resolveChatInput` adapter'ını yaz.
- Kısa demo gecikmesini tek noktaya taşı.
- Hata ve abort davranışını controller'ın yönetebileceği hale getir.
- Gerçek `fetch` veya endpoint ekleme.

### Adım 4 — Controller/hook oluştur

- Mesaj, draft, intent, waiting, error, retry, unread ve reset state'ini tek
  controller'da yönet.
- Race condition koruması ekle.
- Reset/unmount cleanup yap.
- Close sırasında konuşmayı koru.
- Retry'da duplicate kullanıcı mesajını önle.

### Adım 5 — Bileşenleri ayrıştır

- Launcher'ı ayır.
- Header ve privacy note'u ayır.
- Mesaj listesi ve mesaj öğesini ayır.
- Composer ve quick action alanını ayır.
- Ürün, sipariş, bayi ve SSS kartlarını `cards/` altında topla.
- Gereksiz prop drilling oluşursa controller çıktısını küçük, açık prop'lara
  böl; global context ekleme.

### Adım 6 — Focus ve klavye davranışını uygula

- Açılışta composer focus'unu yönet.
- Kapanışta launcher'a focus döndür.
- Enter/Shift+Enter/IME davranışını uygula.
- Escape önceliğini reset dialog'u ve widget için tanımla.
- Focus trap ekleme.

### Adım 7 — Mesaj duyurusu ve scroll davranışını düzelt

- Bütün chat body'deki geniş `aria-live` kullanımını kaldır.
- Ayrı status announcer ekle.
- Alta yakınlık kontrolü ekle.
- Kullanıcı eski mesajı okuyorsa zorla alta kaydırma.
- Gerekirse “Son mesaja git” düğmesi ekle.

### Adım 8 — Error, retry ve reset deneyimini tamamla

- Transport hatası için inline error state ekle.
- Duplicate üretmeyen retry akışını yaz.
- Reset onay dialog'unu ekle.
- Timer/abort cleanup'ını test et.

### Adım 9 — Responsive ve görsel sistemi tamamla

- `02` tokenlarını kullan.
- Chat stillerini ayrı dosyada düzenle.
- 320–1440 px genişliklerini kontrol et.
- Kısa viewport ve mobil klavye davranışını kontrol et.
- Reduced-motion ve safe-area kurallarını ekle.

### Adım 10 — Dokümantasyon ve test

- `docs/09-CHATBOT-DENEYIMI.md` dosyasını oluştur.
- Docs indeksine bağlantı ekle.
- UI contract ve controller davranış testlerini ekle.
- Lint, build, test, artifact ve web doğrulamalarını çalıştır.
- Çalıştırılmayan komutu başarılı göstermeden raporla.

### Adım 11 — Raporla ve dur

- Değişen dosyaları listele.
- Korunan iş akışlarını yaz.
- Klavye, screen reader ve responsive kontrollerini raporla.
- Sonraki görev dosyasını uygulama.

---

## 30. Zorunlu davranış senaryoları

| Senaryo | Beklenen sonuç |
| --- | --- |
| İlk sayfa açılışı | Launcher görünür, sahte unread gösterilmez |
| Launcher tıklama | Widget açılır ve composer focus alır |
| Klavyeyle launcher | Enter/Space ile açılır |
| Widget kapatma düğmesi | Widget kapanır, focus launcher'a döner |
| Escape | Widget kapanır; reset dialog açıksa yalnız dialog kapanır |
| Hero üzerinden açma | Widget açılır, mevcut public prop sözleşmesi çalışır |
| İlk açılış | Demo bildirimi ve dört ana işlem anlaşılır |
| Boş gönderim | Mesaj gönderilmez |
| Whitespace gönderim | Mesaj gönderilmez |
| Normal metin | Bir kullanıcı mesajı ve bir bot yanıtı oluşur |
| Enter | Mesaj gönderilir |
| Shift+Enter | Textarea'ya yeni satır eklenir |
| IME composition | Enter yanlışlıkla mesaj göndermez |
| 500 karakter sınırı | Fazlası engellenir veya açık hata gösterilir |
| Waiting | İkinci gönderim engelli, kapatma etkin |
| Waiting sırasında kapatma | Yanıt tamamlanabilir, widget kapalıysa unread artar |
| Yeniden açma | Konuşma ve draft korunur, unread temizlenir |
| Transport hatası | Inline hata ve retry görünür |
| Retry | Kullanıcı mesajı kopyalanmadan tek yeni deneme yapılır |
| Çift retry tıklama | Paralel iki istek oluşmaz |
| Reset düğmesi | Konuşma varsa onay dialog'u açılır |
| Reset vazgeç | Mesajlar korunur, focus reset düğmesine döner |
| Reset onay | Mesajlar temizlenir, tek welcome mesajı gelir |
| Reset pending sırasında | Eski timer/yanıt sonradan eklenmez |
| Eski mesajları okuma | Yeni yanıt kullanıcıyı zorla alta çekmez |
| Alta yakın olma | Yeni mesaj otomatik görünür |
| Product result | Ürün kartları klavyeyle seçilebilir |
| Order result | Timeline durumları metinsel olarak anlaşılır |
| Dealer result | Harita ve liste seçimi senkron |
| FAQ result | Soru ve yanıt ilişkisi anlaşılır |
| 320 px | Yatay taşma yok, composer görünür |
| 375/430 px | Mobil panel kullanılabilir |
| 768 px | Tablet panel dengeli |
| 1440 px | Widget aşırı büyümez |
| 200% zoom | Header ve composer kesilmez |
| Reduced motion | Açılış/typing hareketleri sadeleşir |
| Screen reader | Yeni yanıt yalnız bir kez uygun biçimde duyurulur |
| Tab dolaşımı | Focus trap yok, görünür focus var |

---

## 31. Otomatik test beklentileri

Mevcut test altyapısı korunmalıdır. Yalnız bu görev için ağır bir browser veya UI
framework'ü eklenmemelidir. `01` adımı Playwright benzeri bir altyapı oluşturduysa
mevcut altyapı kullanılabilir; aksi halde Node tabanlı sözleşme testleri ve
controller/transport için küçük unit testler eklenmelidir.

### 31.1. Zorunlu sözleşme kontrolleri

En az aşağıdakiler otomatik doğrulanmalıdır:

```text
components/Chatbot.tsx public export'u korunuyor
ChatbotProps open/onOpen/onClose sözleşmesi korunuyor
docs/09-CHATBOT-DENEYIMI.md mevcut
chat transport gerçek HTTP endpoint'i içermiyor
privacy/demo notice mevcut
widget dialog adı ve açıklaması bağlı
composer label içeriyor
composer Enter ve Shift+Enter ayrımına sahip
message list bütünü aria-live yapılmamış
ayrı polite announcer mevcut
retry state'i duplicate mesaj üretmiyor
reset pending cevabı iptal ediyor
close konuşmayı sıfırlamıyor
reduced-motion chat stillerinde destekleniyor
safe-area veya dvh mobil stilde destekleniyor
```

### 31.2. Controller unit testleri

Controller ayrıştırılmış saf reducer veya test edilebilir helper kullanıyorsa en
az şu durumlar test edilmelidir:

```text
initial state
send success
send error
retry success
retry double-click guard
reset while waiting
close/open preserves conversation
unread reply while closed
open clears unread
```

React DOM testi için yeni ağır paket eklemek zorunlu değildir. Mevcut test
altyapısına uygun en küçük güvenilir yaklaşım kullanılmalıdır.

### 31.3. Kırılgan test yasağı

Testler:

- Tam CSS satır sayısına
- Component dosya sayısına
- Rastgele generated message ID'ye
- Tam class sırasına
- Sabit zamanlayıcı süresine
- Görsel ikon karakterine

bağlanmamalıdır. Davranış ve sözleşme test edilmelidir.

---

## 32. Kabul ölçütleri

Bu görev yalnız aşağıdaki maddelerin tamamı karşılandığında tamamlanmış sayılır.

### 32.1. Public sözleşme ve mimari

- [ ] `@/components/Chatbot` import yolu çalışıyor.
- [ ] `open`, `onOpen`, `onClose` prop sözleşmesi korunuyor.
- [ ] `components/Chatbot.tsx` ince facade veya okunabilir wrapper haline geldi.
- [ ] Görsel alt parçalar `components/chatbot/` altında anlamlı biçimde ayrıldı.
- [ ] Konuşma state'i tek controller/hook tarafından yönetiliyor.
- [ ] Timer, abort, retry ve reset cleanup tek yerde yönetiliyor.
- [ ] Kart bileşenleri iş mantığı çözümlemiyor.
- [ ] `any` veya kontrolsüz global state eklenmedi.

### 32.2. Transport

- [ ] Küçük ve typed bir chat transport sınırı mevcut.
- [ ] Yerel transport `resolveChatInput` kullanıyor.
- [ ] Gerçek `fetch` veya endpoint eklenmedi.
- [ ] Demo gecikmesi tek yerde ve iptal edilebilir.
- [ ] Transport hatası güvenli UI durumuna dönüşüyor.
- [ ] Reset/unmount eski yanıtın sonradan eklenmesini engelliyor.

### 32.3. Launcher ve widget kabuğu

- [ ] İlk açılışta sahte unread yok.
- [ ] Kapalı durumda launcher görünür.
- [ ] Açık durumda widget görünür ve launcher çift etkileşim üretmiyor.
- [ ] Launcher erişilebilir ada sahip.
- [ ] Widget `role="dialog"` ve doğru başlık ilişkisine sahip.
- [ ] Non-modal semantik ile focus davranışı tutarlı.
- [ ] Header demo durumunu doğru ifade ediyor.
- [ ] Reset ve close düğmeleri erişilebilir adlara sahip.

### 32.4. Konuşma akışı

- [ ] Hoş geldiniz mesajı demo ve dört yeteneği açıklıyor.
- [ ] Ürün, sipariş, bayi ve SSS hızlı işlemleri erişilebilir.
- [ ] Kullanıcı mesajı yalnız bir kez geçmişe ekleniyor.
- [ ] Bot yanıtı yalnız bir kez ekleniyor.
- [ ] Waiting sırasında ikinci gönderim engelleniyor.
- [ ] Widget kapanınca konuşma korunuyor.
- [ ] Kapalıyken gelen yanıt unread oluşturuyor.
- [ ] Açılınca unread temizleniyor.

### 32.5. Composer

- [ ] Label ile bağlı çok satırlı giriş alanı mevcut.
- [ ] `Enter` gönderiyor.
- [ ] `Shift+Enter` yeni satır ekliyor.
- [ ] IME composition güvenli.
- [ ] Boş mesaj gönderilemiyor.
- [ ] Karakter sınırı uygulanıyor ve açıklanıyor.
- [ ] Gönder düğmesinin erişilebilir adı var.
- [ ] Draft close/open sırasında korunuyor.
- [ ] Draft kalıcı tarayıcı depolamasına yazılmıyor.

### 32.6. Error, retry ve reset

- [ ] Hata kullanıcıya teknik olmayan metinle gösteriliyor.
- [ ] Retry düğmesi mevcut.
- [ ] Retry duplicate kullanıcı mesajı üretmiyor.
- [ ] Paralel retry engelleniyor.
- [ ] Konuşma varsa reset onay istiyor.
- [ ] Reset dialog'u erişilebilir.
- [ ] Reset timer/abort/unread/draft/intent state'ini temizliyor.
- [ ] Reset sonrası tek hoş geldiniz mesajı var.

### 32.7. Scroll ve focus

- [ ] Açılışta composer uygun biçimde focus alıyor.
- [ ] Kapanışta focus launcher'a dönüyor.
- [ ] Focus trap uygulanmıyor.
- [ ] Kullanıcı eski mesajı okuyorsa zorla alta kaydırılmıyor.
- [ ] Kullanıcı alta yakınsa yeni mesaj görünür hale geliyor.
- [ ] Gerekirse “Son mesaja git” kontrolü erişilebilir.
- [ ] Bütün focus-visible durumları belirgin.

### 32.8. Erişilebilirlik

- [ ] Bütün mesaj listesi geniş `aria-live` bölgesi değil.
- [ ] Ayrı polite status announcer mevcut.
- [ ] Waiting ve error bir kez duyuruluyor.
- [ ] Gönderen bilgisi ekran okuyucuda anlaşılır.
- [ ] Icon-only button'ların erişilebilir adları var.
- [ ] Seçili/hata/durum yalnız renkle anlatılmıyor.
- [ ] Klavye ile bütün temel işlemler yapılabiliyor.
- [ ] Reduced-motion destekleniyor.

### 32.9. Zengin kartlar

- [ ] Ürün kartı adı, renk, ölçü ve fiyatı okunabilir gösteriyor.
- [ ] Ürün kartı erişilebilir eylem adına sahip.
- [ ] Sipariş kartında demo etiketi görünür.
- [ ] Sipariş timeline durumları metinsel.
- [ ] Bayi haritası ve liste seçimi senkron.
- [ ] Bayi bilgilerinin temsili olduğu açık.
- [ ] SSS sorusu ve yanıtı anlaşılır ilişkide.
- [ ] Kartlar yatay taşma üretmiyor.

### 32.10. Responsive ve stil

- [ ] Chat stilleri tasarım tokenlarını kullanıyor.
- [ ] Chat stilleri mantıksal olarak ayrı dosyada.
- [ ] 320 px genişlikte yatay taşma yok.
- [ ] 375 ve 430 px mobil panel kullanılabilir.
- [ ] 768 px tablet görünümü dengeli.
- [ ] 1024–1440 px desktop panel aşırı büyümüyor.
- [ ] `100dvh`/safe-area desteği uygun yerde var.
- [ ] Mobil form fontu zoom sorunu oluşturmuyor.
- [ ] Kısa viewport'ta header ve composer erişilebilir.

### 32.11. Güvenlik ve kapsam

- [ ] Kullanıcı girdisi plain text render ediliyor.
- [ ] `dangerouslySetInnerHTML` kullanılmıyor.
- [ ] Mesajlar console veya telemetry'ye yazılmıyor.
- [ ] Mesajlar localStorage/cookie/IndexedDB'ye yazılmıyor.
- [ ] Gerçek kişisel bilgi istenmiyor.
- [ ] Gerçek sipariş veya telefon linki eklenmedi.
- [ ] LangGraph, Redis ve backend iş mantığı değiştirilmedi.
- [ ] Yeni intent eklenmedi.
- [ ] Ağır üçüncü taraf chat/UI paketi eklenmedi.

### 32.12. Dokümantasyon ve kalite kapısı

- [ ] `docs/09-CHATBOT-DENEYIMI.md` oluşturuldu.
- [ ] Docs indeksine bağlantı eklendi.
- [ ] Gerekli UI sözleşme testleri eklendi.
- [ ] Controller/transport davranış testleri eklendi veya uygulanamama gerekçesi
  açıklandı.
- [ ] `npm run check:toolchain` geçti.
- [ ] `npm run lint` geçti.
- [ ] `npm run build` geçti.
- [ ] `npm run test` geçti.
- [ ] `npm run validate:artifact` geçti.
- [ ] `npm run verify:web` geçti.

Bir komut gerçekten başarılı çalışmadıysa “geçti” olarak raporlanmamalıdır.

---

## 33. Doğrulama komutları

`01` görevinin komutları uygulanmışsa:

```bash
npm ci
npm run check:toolchain
npm run lint
npm run build
npm run test
npm run validate:artifact
npm run verify:web
```

`01` henüz kod tabanına uygulanmadıysa mevcut komutlar:

```bash
npm ci
npm run lint
npm run build
npm test
npm run validate:artifact
```

### 33.1. Zorunlu dosya kontrolleri

macOS/Linux/WSL:

```bash
test -f components/Chatbot.tsx
test -d components/chatbot
test -f docs/09-CHATBOT-DENEYIMI.md
grep -qi "erişilebilir" docs/09-CHATBOT-DENEYIMI.md
grep -qi "retry\|yeniden dene" docs/09-CHATBOT-DENEYIMI.md
grep -qi "focus" docs/09-CHATBOT-DENEYIMI.md
grep -qi "transport" docs/09-CHATBOT-DENEYIMI.md
```

PowerShell:

```powershell
@(
  "components/Chatbot.tsx",
  "components/chatbot",
  "docs/09-CHATBOT-DENEYIMI.md"
) | ForEach-Object {
  if (-not (Test-Path $_)) { throw "Eksik yol: $_" }
}

$chatDoc = Get-Content "docs/09-CHATBOT-DENEYIMI.md" -Raw
@("erişilebilir", "focus", "transport") | ForEach-Object {
  if ($chatDoc -notmatch $_) { throw "Chatbot deneyimi belgesinde eksik terim: $_" }
}
if ($chatDoc -notmatch "retry|yeniden dene") {
  throw "Chatbot deneyimi belgesinde retry davranışı eksik"
}
```

### 33.2. Yasak kullanım kontrolleri

Aşağıdaki kontroller false positive üretebilir; sonuçlar insan tarafından
incelenmelidir:

```bash
! grep -R "dangerouslySetInnerHTML" components/chatbot components/Chatbot.tsx
! grep -R "localStorage\|sessionStorage\|indexedDB" components/chatbot components/Chatbot.tsx lib/chatbot
! grep -R "fetch(" components/chatbot lib/chatbot/transport* 2>/dev/null
```

PowerShell:

```powershell
$paths = @("components/chatbot", "components/Chatbot.tsx", "lib/chatbot")
$forbidden = Get-ChildItem $paths -Recurse -File -ErrorAction SilentlyContinue |
  Select-String -Pattern "dangerouslySetInnerHTML|localStorage|sessionStorage|indexedDB"
if ($forbidden) {
  $forbidden | Format-Table
  throw "Chatbot katmanında yasak kullanım bulundu"
}
```

### 33.3. Manuel klavye doğrulaması

1. Sayfayı yenile.
2. `Tab` ile launcher'a gel ve `Enter` ile aç.
3. Composer'a focus verildiğini doğrula.
4. Metin yaz ve `Shift+Enter` ile ikinci satıra geç.
5. `Enter` ile gönder.
6. Waiting sırasında ikinci gönderimin engellendiğini doğrula.
7. Hızlı işlem ve mesaj action'larını klavyeyle kullan.
8. Reset dialog'unu aç; `Escape` ile kapat.
9. Reset dialog'unu tekrar açıp onayla.
10. Widget'ı kapat ve focus'un launcher'a döndüğünü doğrula.
11. Widget açıkken `Tab` ile sayfanın diğer öğelerine geçilebildiğini doğrula.

### 33.4. Manuel scroll doğrulaması

1. Yeterli mesaj üreterek listeyi scroll edilebilir hale getir.
2. Listenin ortasına çık.
3. Yeni mesaj oluştur.
4. Scroll'un zorla alta inmediğini doğrula.
5. Varsa “Son mesaja git” düğmesini kullan.
6. Alta yakınken yeni mesaj oluştur ve otomatik görünür olduğunu doğrula.

### 33.5. Responsive doğrulama

DevTools'ta şu genişlikleri sırayla kontrol et:

```text
320, 375, 430, 768, 1024, 1280, 1440
```

Her genişlikte:

```text
launcher
widget header
privacy note
message list
quick actions
product card
order card
dealer map/list
faq card
composer
safe-area
horizontal overflow
```

kontrol edilmelidir.

---

## 34. Bu adımda yasak olan değişiklikler

Cursor aşağıdakileri yapmamalıdır:

- `ChatbotProps` public sözleşmesini kırmak
- `app/page.tsx` içindeki chatbot açma girişlerini kaldırmak
- Ürün/sipariş/bayi/SSS niyet kurallarını değiştirmek
- Yeni niyet veya Worker eklemek
- Gerçek backend endpoint'i çağırmak
- FastAPI, LangGraph veya Redis kodunu değiştirmek
- Mesajları kalıcı tarayıcı depolamasına yazmak
- Mesajları analytics veya console'a göndermek
- Gerçek müşteri verisi istemek
- Gerçek sipariş/kargo/telefon linki oluşturmak
- Kullanıcı konumu istemek
- Dosya, görsel, mikrofon veya kamera girişi eklemek
- Chatwoot/Frappe canlı destek entegrasyonu eklemek
- Ağır UI/chat SDK'sı veya icon paketi kurmak
- `dangerouslySetInnerHTML` kullanmak
- Focus trap ile non-modal semantiği karıştırmak
- Tarayıcı `window.confirm` kullanmak
- Bütün chat geçmişini `aria-live` yapmak
- Sabit yüksekliği nedeniyle mobil klavyede composer'ı gizlemek
- Paketleri topluca güncellemek
- Kullanıcının mevcut değişikliklerini silmek
- Otomatik commit, push veya pull request açmak
- `04` numaralı görevi uygulamak

---

## 35. Tamamlanma raporu formatı

Cursor görev sonunda şu formatı kullanmalıdır:

```markdown
## Tamamlananlar

- Widget bileşen mimarisi:
- UI controller/state modeli:
- Local transport sınırı:
- Composer ve klavye davranışı:
- Loading/error/retry:
- Reset onayı:
- Focus ve scroll yönetimi:
- Responsive ve erişilebilirlik:
- Dokümantasyon:

## Değişen dosyalar

- `dosya/yolu`: değişiklik özeti

## Korunan sözleşmeler

- `@/components/Chatbot` import'u:
- `open/onOpen/onClose` prop'ları:
- Yerel `resolveChatInput` motoru:
- Ürün akışı:
- Sipariş akışı:
- Bayi akışı:
- SSS akışı:

## Davranış doğrulamaları

- Launcher/open/close:
- Focus dönüşü:
- Enter/Shift+Enter/IME:
- Waiting ve duplicate guard:
- Error/retry:
- Reset while pending:
- Unread while closed:
- Auto-scroll:
- Screen reader announcement:

## Responsive kontroller

- 320 px:
- 375 px:
- 430 px:
- 768 px:
- 1024 px:
- 1280 px:
- 1440 px:
- 200% zoom:
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

## Güvenlik ve gizlilik kontrolü

- Kalıcı mesaj depolama:
- Console/telemetry mesaj içeriği:
- `dangerouslySetInnerHTML`:
- Gerçek kişisel veri isteği:

## Varsayımlar veya açık noktalar

- ...

## Sonraki adım

- `04-URUN-ARAMA-VE-FILTRELEME-AKISI.md` henüz uygulanmadı.
```

“Geçti” yalnız komut gerçekten başarılı çalıştırıldıysa yazılmalıdır.

---

## 36. Durma kuralı

Bu görevde yalnız chatbot launcher'ı, widget kabuğu, konuşma mesajları, composer,
hızlı işlemler, zengin sonuç kartlarının sunumu, UI durum yönetimi, local
transport sınırı, loading/error/retry/reset deneyimi, focus/scroll davranışı,
responsive düzen ve erişilebilirlik geliştirilir.

Kabul ölçütleri kontrol edilip tamamlanma raporu verildikten sonra Cursor
**durmalıdır**. Kullanıcı açıkça istemeden ürün arama iş kurallarını, backend API
entegrasyonunu, LangGraph/Redis katmanını veya `04` numaralı görevi
uygulamamalıdır.
