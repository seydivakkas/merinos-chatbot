# Alınan Dersler (Lessons Learned)

Merinos Halı müşteri destek chatbotu geliştirme sürecinde elde edilen teknik ve mimari çıkarımlar:

- **Türkçe Morfoloji Dersi:** Sondan eklemeli dil yapısı nedeniyle arama işlemlerinde tam kelime eşleşmesi yetersiz kalmaktadır. Kök-önek (prefix/edge-ngram) yaklaşımının daha başarılı olduğu görülmüştür; ortadan alınan n-gram'lar ise çok fazla gürültülü ve yanlış eşleşmelere yol açmıştır.
- **Mock-First Mimari:** Dış servislere bağımlı olmadan iş mantığını baştan uca çalıştırmak, test etmek ve darboğazları görmek için mock adaptörler paha biçilmez bir esneklik sağlamıştır.
- **Varsayılan Ret İlkesi:** Sistemde güvenliği artırmak için `visibility` (görünürlük) veya `targetGroups` (hedef gruplar) özellikleri belirsiz olan belgelerin otomatik olarak reddedilmesi gerekliliği anlaşılmıştır.
- **Belge Kabul Hattı (Ingestion Pipeline):** Her belgenin kalite standartlarını karşıladığından emin olmak için 8 adımlı pipeline'dan geçmesi zorunlu kılınmıştır. Herhangi bir adımda yaşanan başarısızlık, belgenin yayımlanmasını engellemelidir.
- **Dört Göz İlkesi (Four-Eyes Principle):** Yüksek risk barındıran operasyonlarda hataları ve suiistimalleri önlemek için en az iki farklı yetkilinin onayının gerekliliği kanıtlanmıştır.
- **Event-Driven Mimari:** `eventBus` üzerinden kurulan asenkron mesajlaşma sözleşmesi kesin bir şekilde korunduğunda, mock altyapısından gerçek bir mesaj kuyruğuna (RabbitMQ/Kafka) geçişin oldukça sorunsuz olacağı görülmüştür.
- **SLA ve İş Takvimi Farkındalığı:** Destek taleplerindeki çözüm sürelerinin (SLA) ham dakika üzerinden hesaplanmasının yanıltıcı olduğu; tatiller, hafta sonları ve mesai saatlerini hesaba katan iş günü/saati bazlı hesaplamanın kritik olduğu anlaşılmıştır.
- **TOTP/MFA Bağımlılıksız Uygulama:** Sandbox ortamlarında veya dış paket kullanılamayan durumlarda, Node.js'in yerleşik `node:crypto` modülü kullanılarak standart uyumlu (RFC 6238) güvenli bir TOTP uygulamasının geliştirilebileceği doğrulanmıştır.
- **Sandbox Kısıtları:** Sistemin internet erişimi olmadan veya kısıtlı ortamlarda çalışabilmesi hedeflendiğinden, tüm bağımlılıkların sıfır-bağımlılık (zero-dependency) prensibi ile yazılması sistem stabilitesini artırmıştır.
- **PII Maskeleme:** KVKK ve genel veri güvenliği kapsamında, sistemin ürettiği denetim kayıtlarında (audit logs) kişisel verilerin (PII) her zaman maskelenerek saklanması zorunluluğu standart haline getirilmiştir.
- **Idempotency Key:** Özellikle webhook entegrasyonlarında aynı mesajın veya işlemin birden fazla kez işlenmesini engellemek için "idempotency key" deseninin uygulanması sistem bütünlüğü için kritik bir rol oynamıştır.
