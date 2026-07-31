# 20 — Son Kabul ve Teslim Paketi

## 0. Görev kimliği

| Alan | Değer |
|---|---|
| Görev numarası | `20` |
| Dosya | `20-SON-KABUL-VE-TESLIM-PAKETI.md` |
| Ön koşullar | `00–19` numaralı görevlerin uygulanmış olması |
| Ana kapsam | Projenin uçtan uca son kabulü, kanıt matrisi, teslim envanteri, güvenli paketleme, checksum, devralma ve kapanış raporu |
| İlk teslim modu | Localhost demo ve production-ready mimari çıktılarının doğrulanmış kaynak kodu, belgeleri, test kanıtları ve final ZIP paketi |
| Kapsam dışı | Onaysız production yayını, gerçek müşteri trafiği, gerçek kurumsal credential kullanımı, kurum adına hukuki veya ticari taahhüt, başarısız kontrolleri geçmiş gibi gösterme |
| Temel ilke | Proje yalnız dosyalar mevcut olduğu için tamamlanmış sayılmaz; işlev, sözleşme, güvenlik, gizlilik, operasyon, ölçüm ve teslim bütünlüğü kanıtla doğrulanmalıdır |
| Durma kuralı | Kritik kabul kapılarından biri başarısız, çalıştırılmamış, kanıtsız veya yetkisizse final paket `RELEASE_READY` olarak işaretlenmez |

---

## 1. Amaç

Bu görevin amacı Merinos Chatbot projesinde `00–19` arasında tanımlanan bütün geliştirme kararlarını tek bir son kabul sürecinde birleştirmek ve proje teslimini tekrar üretilebilir, denetlenebilir ve güvenli bir paket hâline getirmektir.

Görev tamamlandığında aşağıdaki soruların açık ve kanıtlanabilir cevapları bulunmalıdır:

1. `00–19` görevlerinin her biri gerçekten uygulandı mı?
2. Hangi dosya veya bileşen hangi görevin çıktısıdır?
3. Dört temel MVP akışı uçtan uca çalışıyor mu?
4. Local demo ve API modları birbirinden açıkça ayrılıyor mu?
5. Frontend ile backend sözleşmeleri uyumlu mu?
6. Redis session, concurrency ve idempotency davranışları test edildi mi?
7. LangGraph Supervisor–Worker geçişleri ve Worker izolasyonu doğrulandı mı?
8. Token bütçesi ve context compression hard limitleri korunuyor mu?
9. KVKK, güvenlik ve telemetry sızıntı kontrolleri geçti mi?
10. Docker ve Docker’sız yerel çalıştırma yolları doğrulandı mı?
11. Kurumsal entegrasyonlar fail-closed ve kontrollü mü?
12. Canlıya geçiş, rollback ve operasyon belgeleri mevcut mu?
13. Pilot KPI, UAT ve go/no-go sistemi tamamlandı mı?
14. Testler hangi ortamda, hangi komutla ve hangi exit code ile çalıştı?
15. Hangi kontroller çalıştırılamadı ve neden?
16. Açık riskler, `PENDING` alanlar ve sahipleri kimlerdir?
17. Final ZIP hangi dosyaları içerir ve hangilerini kesinlikle içermez?
18. Paketin bütünlüğü checksum ile doğrulanabiliyor mu?
19. Yeni bir ekip üyesi projeyi belgelerden çalıştırıp doğrulayabilir mi?
20. Proje hangi koşulda `ACCEPTED`, `CONDITIONAL_ACCEPTANCE`, `BLOCKED` veya `REJECTED` sayılır?

Bu görev yeni ürün özelliği eklemek için kullanılmamalıdır. Amaç, önceki görevleri uygulamak sırasında oluşmuş eksikliği güvenli biçimde tamamlamak, kanıtlamak ve teslim etmektir.

---

## 2. Bağlayıcı son kabul ilkeleri

Aşağıdaki kurallar istisnasız uygulanmalıdır:

1. **Dosyanın varlığı uygulama kanıtı değildir.**
2. **Çalıştırılmayan test `PASS` olarak raporlanamaz.**
3. **Exit code bilinmeyen komut başarılı sayılmaz.**
4. **Bir test yalnız logda “başarılı” yazdığı için geçerli değildir; gerçek process exit code kontrol edilir.**
5. **Kritik güvenlik, KVKK veya yetkilendirme hatası ortalama test başarısıyla telafi edilemez.**
6. **Gerçek müşteri verisi son kabul için kullanılmaz.**
7. **Production secret, token, private key veya gerçek endpoint final pakete girmez.**
8. **`.env` dosyaları final pakete girmez; yalnız güvenli `.env.example` dosyaları teslim edilir.**
9. **Local demo verisi görünür biçimde sentetik kalmalıdır.**
10. **Production modunda sessiz local/demo fallback bulunmamalıdır.**
11. **Redis modunda sessiz memory fallback bulunmamalıdır.**
12. **Gerçek sipariş bilgisi kimlik ve sipariş sahipliği doğrulanmadan gösterilemez.**
13. **Ham kullanıcı mesajı, bot yanıtı, sipariş numarası ve koordinat telemetry’ye yazılamaz.**
14. **Session ID, Redis key/value veya checkpoint payload teslim kanıtına kopyalanamaz.**
15. **Kanıt dosyaları da gizlilik taramasından geçmelidir.**
16. **Test ekran görüntülerinde veya loglarında hassas veri bulunmamalıdır.**
17. **Kullanıcı kabul testi ve teknik test birbirinin yerine geçemez.**
18. **Contract test ve runtime doğrulaması yalnız TypeScript/Python tip kontrolüyle ikame edilemez.**
19. **OpenAPI snapshot değişikliği incelenmeden kabul edilemez.**
20. **Kırık veya bozuk ZIP başarıyla teslim edilmiş sayılmaz.**
21. **Final ZIP yeniden açılarak içindeki doğrulama scriptleri çalıştırılmalıdır.**
22. **Final paket kaynak çalışma dizininden bağımsız olarak doğrulanmalıdır.**
23. **`node_modules`, `.venv`, cache ve editor dosyaları final pakete girmez.**
24. **Build çıktısı gerekiyorsa kaynağı ve üretim komutu manifestte belirtilmelidir.**
25. **Üretilmiş artifact kaynak dosya yerine geçemez.**
26. **Checksum final ZIP dışında ayrı dosya olarak teslim edilir.**
27. **Paket içi manifest dış ZIP checksum’unu kendisinin içeriği olarak taşımaya çalışmamalıdır.**
28. **Dosya listesi ve checksum listesi deterministik sırada üretilmelidir.**
29. **Paketleme sırasında kaynak dosyalar değiştirilmemelidir.**
30. **Paketlemeden sonra Git çalışma ağacı veya source checksum farkı raporlanmalıdır.**
31. **Kritik `PENDING` veya `BLOCKED` alan gizlenemez.**
32. **Sahibi olmayan kritik risk kabul edilemez.**
33. **Geçici waiver süresiz olamaz; owner, neden, sona erme tarihi ve telafi kontrolü taşımalıdır.**
34. **Waiver sıfır tolerans KVKK veya yetkisiz veri gösterimi için kullanılamaz.**
35. **Final kabul kararı teknik ekip tarafından tek başına production iznine dönüştürülemez.**
36. **Kurumsal, güvenlik/KVKK, operasyon ve iş sahibi onayları rol bazında kaydedilir.**
37. **Kurum adına kişi adı veya imza uydurulmaz.**
38. **Bilinmeyen owner alanı `PENDING_OWNER` olarak bırakılır.**
39. **Kullanılabilirlik veya performans hedefi ölçülmeden kesin başarı iddiası yazılmaz.**
40. **Final raporda başarılar kadar eksikler de görünür olmalıdır.**
41. **Son kabul sırasında yeni framework veya vendor bağımlılığı eklenmez.**
42. **Sırf test geçsin diye iş kuralı, validation veya güvenlik kontrolü gevşetilmez.**
43. **Sırf coverage yükselsin diye anlamsız test yazılmaz.**
44. **Flaky test sessizce retry edilerek yeşile çevrilmez.**
45. **Final paket üretimi tek komutla ve tekrar çalıştırılabilir olmalıdır.**
46. **Aynı kaynak revision’dan iki paket üretildiğinde içerik manifesti açıklanabilir olmalıdır.**
47. **Teslim tarihi ve revision UTC tabanlı makine okunabilir metadata’da tutulmalıdır.**
48. **Final rapor Türkçe, teknik manifestler makine okunabilir biçimde teslim edilir.**
49. **Teslim alan ekip internet erişimi olmadan proje yapısını ve çalıştırma gereksinimlerini anlayabilmelidir.**
50. **Bu görevden sonra otomatik yeni özellik geliştirmeye başlanmaz.**

---

## 3. Başlamadan önce okunacak dosyalar

### 3.1. Bütün görev belgeleri

Cursor aşağıdaki belgeleri sıra ve kapsam ilişkileriyle birlikte okumalıdır:

```text
cursor-tasks/00-PROJE-ANAYASASI.md
cursor-tasks/01-REPO-VE-GELISTIRME-TEMELI.md
cursor-tasks/02-MERINOS-DEMO-SITESI-VE-TASARIM-SISTEMI.md
cursor-tasks/03-CHATBOT-WIDGET-VE-KONUSMA-DENEYIMI.md
cursor-tasks/04-URUN-ARAMA-VE-FILTRELEME-AKISI.md
cursor-tasks/05-SIPARIS-DURUMU-SORGULAMA-AKISI.md
cursor-tasks/06-BAYI-BULMA-VE-HARITA-AKISI.md
cursor-tasks/07-SSS-VE-BILGI-BANKASI-AKISI.md
cursor-tasks/08-FRONTEND-ORTAK-STATE-VE-VERI-KATMANI.md
cursor-tasks/09-PYTHON-API-VE-SOZLESME-KATMANI.md
cursor-tasks/10-REDIS-OTURUM-VE-SESSION-STATE-YONETIMI.md
cursor-tasks/11-TOKEN-BUTCESI-VE-CONTEXT-COMPRESSION.md
cursor-tasks/12-LANGGRAPH-SUPERVISOR-WORKER-AKISI.md
cursor-tasks/13-FRONTEND-BACKEND-ENTEGRASYONU.md
cursor-tasks/14-KVKK-GUVENLIK-VE-GOZLEMLENEBILIRLIK.md
cursor-tasks/15-TEST-OTOMASYONU-VE-KALITE-GUVENCE.md
cursor-tasks/16-DOCKER-VE-LOCAL-CALISTIRMA-ORTAMI.md
cursor-tasks/17-KURUMSAL-SISTEM-ENTEGRASYONLARI.md
cursor-tasks/18-CANLIYA-GECIS-OPERASYON-VE-BAKIM-PLANI.md
cursor-tasks/19-PILOT-KULLANICI-KABUL-VE-BASARI-METRIKLERI.md
cursor-tasks/20-SON-KABUL-VE-TESLIM-PAKETI.md
```

### 3.2. Proje kaynakları

En az aşağıdaki alanlar incelenmelidir:

```text
README.md
package.json
package-lock.json
app/
components/
lib/
tests/
scripts/
docs/
backend/README.md
backend/pyproject.toml
backend/src/
backend/tests/
compose.yaml
compose.dev.yaml
compose.test.yaml
Dockerfile*
.env.example
backend/.env.example
```

Dosya mevcut değilse varmış gibi raporlanmamalıdır. Önceki görev onu zorunlu kılıyorsa durum `MISSING_REQUIRED_OUTPUT` olarak kabul matrisine yazılmalıdır.

### 3.3. Üretilmiş belgeler ve kanıtlar

Varsa aşağıdaki alanlar da incelenmelidir:

```text
docs/design/
docs/api/
docs/security/
docs/privacy/
docs/integrations/
docs/operations/
docs/pilot/
docs/runbooks/
docs/adr/
artifacts/
reports/
coverage/
playwright-report/
test-results/
```

Eski veya hangi revision’a ait olduğu belli olmayan kanıtlar final kabulte kullanılamaz.

---

## 4. Son kabul durum modeli

Her görev, kalite kapısı ve teslim öğesi yalnız aşağıdaki durumlardan birini almalıdır:

| Durum | Anlamı |
|---|---|
| `PASS` | Kontrol çalıştırılmış, kanıtı mevcut ve beklenen sonucu sağlamıştır |
| `FAIL` | Kontrol çalıştırılmış ve beklenen sonucu sağlamamıştır |
| `BLOCKED` | Kontrol dış bağımlılık, izin veya eksik kurumsal bilgi nedeniyle çalıştırılamamıştır |
| `NOT_RUN` | Kontrol çalıştırılmamıştır |
| `NOT_APPLICABLE` | Gerekçesi yazılı ve onaylı olarak bu teslim için uygulanabilir değildir |
| `PENDING_REVIEW` | Teknik çıktı hazırdır ancak yetkili incelemesi beklenmektedir |
| `WAIVED` | Süreli, sahipli ve telafi kontrollü istisna verilmiştir |

### 4.1. Yasak durum dönüşümleri

Aşağıdakiler yasaktır:

- `NOT_RUN` → `PASS`
- `BLOCKED` → `PASS`
- `FAIL` → `WAIVED` ve gerekçesiz kapatma
- Kritik KVKK/güvenlik hatası → `WAIVED`
- Owner bilinmiyor → `PASS`
- Eski revision kanıtı → güncel `PASS`
- Yalnız manuel gözlem → otomatik test `PASS`
- Yalnız unit test → full-stack `PASS`

### 4.2. Nihai proje durumu

| Nihai durum | Koşul |
|---|---|
| `ACCEPTED` | Bütün P0 kapıları `PASS`, gerekli rol onayları kayıtlı, kritik açık risk yok |
| `CONDITIONAL_ACCEPTANCE` | P0 kapıları `PASS`; yalnız düşük riskli, süreli ve sahipli P1/P2 açıkları var |
| `BLOCKED` | Kritik kontrol `BLOCKED/NOT_RUN/PENDING_REVIEW` veya gerekli owner/onay eksik |
| `REJECTED` | Kritik kontrol `FAIL`, veri sızıntısı, yetkisiz veri gösterimi veya teslim bütünlüğü bozuk |
| `DEMO_ONLY_ACCEPTED` | Local sentetik demo kabul edildi; production/kurumsal canlı kullanım kapıları tamamlanmadı |

`DEMO_ONLY_ACCEPTED`, production-ready anlamına gelmez.

---

## 5. Son kabul stratejisi

Son kabul beş katmanda yürütülmelidir:

```text
1. Statik envanter ve izlenebilirlik
2. Otomatik teknik doğrulama
3. Uçtan uca kullanıcı senaryoları
4. Güvenlik, KVKK ve operasyon incelemesi
5. Paketleme, yeniden açma ve devralma provası
```

Her katman bir sonrakine geçmeden önce kendi kritik kapılarını tamamlamalıdır.

### 5.1. Kabul çalışma kimliği

Her final kabul çalıştırması benzersiz bir `acceptanceRunId` üretmelidir.

Örnek biçim:

```text
final-20260727T120000Z-<shortCommit>
```

Kimlik:

- kullanıcı/session kimliği içermemelidir,
- random secret içermemelidir,
- rapor, JSON sonuçları ve manifestlerde aynı olmalıdır,
- Git commit yoksa güvenli source digest kısaltması kullanmalıdır.

---

## 6. Zorunlu final teslimleri

Cursor görevi uyguladığında aşağıdaki teslimleri üretmelidir.

### 6.1. Kaynak içindeki kalıcı dosyalar

```text
cursor-tasks/README.md
scripts/final-acceptance.mjs
scripts/create-delivery-package.mjs
scripts/verify-delivery-package.mjs
docs/FINAL-ACCEPTANCE-CHECKLIST.md
docs/FINAL-HANDOFF-GUIDE.md
docs/FINAL-DELIVERY-INVENTORY.md
docs/OPEN-RISKS-AND-PENDING.md
docs/RELEASE-NOTES.md
delivery/manifest.schema.json
```

Dosya adları mevcut proje standardıyla çelişiyorsa eşdeğer ad kullanılabilir; final raporda eşleme açıkça belirtilmelidir.

### 6.2. Çalıştırma sırasında üretilen kanıtlar

```text
artifacts/final-acceptance/<acceptanceRunId>/
├── acceptance-report.md
├── acceptance-results.json
├── command-results.json
├── traceability-matrix.csv
├── changed-files.txt
├── source-file-manifest.json
├── dependency-summary.json
├── security-privacy-scan.json
├── open-risks.json
├── environment-summary.json
├── test-summary.json
├── package-manifest.json
└── logs/
```

Loglar sanitize edilmiş ve boyut sınırlandırılmış olmalıdır.

### 6.3. Final dış teslim dosyaları

```text
Merinos_Chatbot_Demo_Localhost_Final.zip
Merinos_Chatbot_Demo_Localhost_Final.zip.sha256
FINAL-ACCEPTANCE-REPORT.md
FINAL-DELIVERY-MANIFEST.json
```

Bu dosyaların konumu final raporda belirtilmelidir.

---

## 7. `cursor-tasks/README.md` indeks gereksinimi

Final görev sırasında `cursor-tasks/README.md` oluşturulmalı veya güncellenmelidir.

İndeks aşağıdakileri içermelidir:

- `00–20` bütün görevlerin sıralı bağlantısı
- Her görevin tek cümlelik amacı
- Ön koşul zinciri
- Hangi görevlerin uygulandığı
- Her görevin son doğrulama durumu
- Görevler arası kritik bağımlılıklar
- Cursor’ın dosyaları hangi sırada uygulayacağı
- Görev setinin artık tamamlandığı bilgisi
- Final görevden sonra otomatik yeni adıma geçilmeyeceği

İndeks, dosya adı değişikliklerini veya eksik numaraları algılayan otomatik testle korunmalıdır.

---

## 8. `00–19` izlenebilirlik matrisi

Her görev için en az aşağıdaki alanlar doldurulmalıdır:

| Alan | Açıklama |
|---|---|
| `taskId` | `00`–`19` |
| `taskFile` | Görev dosyası |
| `requiredOutputs` | Beklenen dosya/bileşenler |
| `implementedOutputs` | Gerçekte bulunan dosya/bileşenler |
| `acceptanceChecks` | Çalıştırılan kontroller |
| `evidencePaths` | Kanıt dosyaları |
| `status` | Kabul durum modeli |
| `openIssues` | Açık eksikler |
| `ownerRole` | Sorumlu rol |
| `sourceRevision` | Kanıtın ait olduğu revision |

### 8.1. Görev bazında zorunlu kontrol özeti

| Görev | Son kabulte doğrulanacak ana çıktı |
|---:|---|
| `00` | Dört MVP yeteneği, demo/production sınırı, mimari ve güvenlik anayasası |
| `01` | Repo standardı, sürümler, ortam dosyaları, platformlar arası komutlar |
| `02` | Demo site kabuğu, tasarım tokenları, responsive ve erişilebilir yapı |
| `03` | Chatbot widget state modeli, klavye/focus, retry/reset/unread davranışı |
| `04` | Ürün arama normalizasyonu, AND/OR filtreleme, deterministik sıralama |
| `05` | Kesin sipariş eşleşmesi, demo etiketi, timeline ve gizlilik |
| `06` | Bayi filtreleme, izinli konum, yaklaşık mesafe ve liste–harita senkronu |
| `07` | Sürümlü/published SSS, güven eşikleri ve kaynak gösterimi |
| `08` | Ortak state sınırları, repository portları ve hassas veri kalıcılık yasağı |
| `09` | FastAPI sözleşmeleri, ortak hata zarfı, health ve OpenAPI |
| `10` | Redis HMAC key, TTL, CAS, lock, idempotency ve fail-closed mod |
| `11` | Token bütçesi, typed context, structured memory ve redaction |
| `12` | Typed Supervisor planı, Worker izolasyonu, review ve sınırlı replan |
| `13` | Local/API transport seçimi, session ve retry idempotency entegrasyonu |
| `14` | KVKK envanteri, tehdit modeli, güvenli telemetry ve incident hazırlığı |
| `15` | Test piramidi, contract/integration/E2E/security kalite kapıları |
| `16` | Docker/Compose topolojisi, healthcheck, secret ve local çalışma |
| `17` | Kurumsal port/adapter, sandbox/shadow/canary ve fail-closed entegrasyon |
| `18` | Production readiness, SLO, rollout, rollback, backup ve runbook |
| `19` | KPI registry, UAT, veri kalitesi, pilot stop ve go/no-go modeli |

Bir görevin Markdown belgesinin bulunması, tablodaki ana çıktının uygulandığını kanıtlamaz.

---

## 9. Kaynak kod envanteri ve değişiklik analizi

Son kabul başlamadan önce proje ağacı makine okunabilir biçimde çıkarılmalıdır.

### 9.1. Dosya sınıfları

Her dosya aşağıdaki sınıflardan birine atanmalıdır:

- `source_frontend`
- `source_backend`
- `test`
- `fixture_synthetic`
- `configuration_example`
- `documentation`
- `migration`
- `script`
- `generated_evidence`
- `generated_build`
- `dependency_lock`
- `delivery_metadata`
- `excluded_sensitive`
- `excluded_cache`

### 9.2. Değişiklik raporu

Git varsa:

```bash
git status --short
git diff --stat
git diff --name-status
git rev-parse HEAD
```

Git yoksa:

- bütün source dosyaları için SHA-256 manifesti üret,
- başlangıç veya referans manifesti varsa karşılaştır,
- referans yoksa bunu açıkça belirt,
- değişiklikleri uydurma.

### 9.3. Beklenmeyen dosya kontrolü

Aşağıdaki örnekler incelenmelidir:

```text
.env
.env.local
*.pem
*.key
*.p12
*.pfx
id_rsa*
credentials*.json
secrets*.json
*.sqlite
*.db
redis-dump*
dump.rdb
*.log
*.har
*.pcap
```

Bulunan her dosya otomatik silinmemeli; önce sınıflandırılmalı, final paketten dışlanmalı ve güvenlik raporuna yazılmalıdır.

---

## 10. Dört MVP akışı için son işlevsel kabul

### 10.1. Ürün arama

Aşağıdaki senaryolar en az birim ve uçtan uca seviyede doğrulanmalıdır:

1. Yalnız kategori araması
2. Yalnız renk araması
3. Yalnız ölçü araması
4. Kategori + renk
5. Kategori + renk + ölçü
6. Türkçe karakterli sorgu
7. Farklı `x`, `×` ve boşluklu ölçü biçimleri
8. Ürün adı veya koduyla kesin eşleşme
9. Aynı facet içinde kontrollü OR
10. Farklı facet’ler arasında AND
11. Sonuçların deterministik sıralanması
12. Sonuç bulunamadığında güvenli genişletme önerisi
13. Stok ve fiyat bilgisi yoksa uydurulmaması
14. Site filtreleri ile chatbot sonuçlarının tutarlılığı
15. Sonuç kartlarının klavye ve ekran okuyucu ile kullanılabilmesi

### 10.2. Sipariş durumu

1. Geçerli sentetik sipariş numarası
2. Küçük/büyük harf ve boşluk normalizasyonu
3. Geçersiz biçim
4. Kısmi numara
5. Fuzzy eşleşme yapılmaması
6. Bir mesajda birden fazla numara
7. Bulunamayan kayıt için veri sızdırmayan yanıt
8. Demo etiketinin görünmesi
9. Timeline sırasının doğrulanması
10. Tahmini tarihin garanti gibi sunulmaması
11. Takip kodunun maskelenmesi
12. Production modunda auth/ownership olmadan fail-closed davranış
13. Tam sipariş numarasının telemetry’de bulunmaması
14. Retry sırasında ikinci işleme oluşmaması
15. Başka session’a veri sızmaması

### 10.3. Bayi bulma

1. Şehir seçimi
2. İlçe seçimi
3. Türkçe karakter normalizasyonu
4. Belirsiz şehir sorgusu
5. Konum izninin yalnız açık kullanıcı eylemiyle istenmesi
6. İzin reddinde manuel akışın sürmesi
7. Timeout ve desteklenmeyen tarayıcı fallback’i
8. Yaklaşık mesafenin demo niteliğinin görünmesi
9. Haversine hesabının test edilmesi
10. Liste ve harita seçiminin tek state üzerinden senkron olması
11. Klavye ile pin seçimi
12. Güvenli telefon ve dış harita linki
13. Ham koordinatın storage/log/analytics’e yazılmaması
14. Mağaza stoku veya rota süresinin uydurulmaması
15. Mobil görünümde kullanılabilirlik

### 10.4. SSS ve bilgi bankası

1. Published içerikten yanıt
2. Draft/archived içeriğin dışlanması
3. Exact eşleşme
4. Strong eşleşme
5. Düşük güvenli suggested durum
6. No-match durumu
7. Çok konulu sorguda clarification
8. Sipariş, ürün ve bayi işlemsel intent ayrımı
9. Kaynak, sürüm ve inceleme tarihinin gösterilmesi
10. Prompt injection içeren bilgi kaynağının talimat olarak uygulanmaması
11. İçeriğin plain text/güvenli render edilmesi
12. İlgili soru önerilerinin doğrulanması
13. Stale content uyarısı
14. Provider hatasında uydurma yanıt üretilmemesi
15. SSS yanıtının kullanıcı mesajı içeriğiyle telemetry’ye gitmemesi

---

## 11. Chatbot konuşma deneyimi son kabulü

Aşağıdaki davranışlar gerçek kullanıcı etkileşimi üzerinden test edilmelidir:

- Launcher açma ve kapama
- Açılışta doğru focus hedefi
- Kapanınca focus’un launcher’a dönmesi
- `Enter` ile gönderme
- `Shift+Enter` ile satır sonu
- IME composition sırasında yanlış gönderim olmaması
- Boş mesajın gönderilmemesi
- Gönderim sırasında duplicate submit engeli
- Loading göstergesi
- Hata mesajı ve retry
- Retry’da aynı `clientMessageId`
- Mesaj değişirse yeni `clientMessageId`
- Widget kapanınca draft ve session-scope konuşmanın korunması
- Kapalıyken tamamlanan yanıt için unread göstergesi
- Reset onayı
- Reset sırasında active request abort
- Reset sonrası eski response’un ekrana yazılmaması
- Kullanıcının geçmişi okurken otomatik scroll ile zorla aşağı çekilmemesi
- Yeni mesaj bildirimi ve kontrollü “sona git” davranışı
- `aria-live` bölgesinin mesajları iki kez okumaması
- Mobil klavye ve `100dvh` davranışı
- `prefers-reduced-motion` desteği
- Dış linklerde güvenli `rel` kullanımı
- HTML/script içeriğinin çalıştırılmaması

---

## 12. Frontend state ve veri katmanı son kabulü

Doğrulanması gereken invariant’lar:

1. Türetilmiş ürün veya bayi listeleri global state’e kopyalanmaz.
2. Chat transcript ortak site state’ine taşınmaz.
3. Composer draft kalıcı browser storage’a yazılmaz.
4. Sipariş numarası browser storage’a yazılmaz.
5. Ham koordinat browser storage’a yazılmaz.
6. Widget görünürlüğü açık ve tek sahipli state’tir.
7. Ürün arama bağlamı site–chatbot arasında typed event ile taşınır.
8. Bayi seçimi tek `selectedDealerId` üzerinden senkron olur.
9. Context event tek kullanımlıktır ve replay sonucu duplicate işlem oluşturmaz.
10. UI bileşenleri doğrudan demo fixture dizilerine bağımlı değildir.
11. Local ve HTTP repository aynı port sözleşmesini uygular.
12. `DataResult` error/metadata modeli bütün domainlerde tutarlıdır.
13. Stale response güncel state’i ezemez.
14. Abort edilen request kullanıcıya yanlış başarı göstermez.
15. Provider değiştirme bileşen kodunu değiştirmeyi gerektirmez.

---

## 13. FastAPI ve sözleşme son kabulü

### 13.1. Endpoint envanteri

En az aşağıdaki sözleşmeler doğrulanmalıdır:

```text
GET  /health/live
GET  /health/ready
GET  /api/v1/products
GET  /api/v1/orders/{orderNumber}/status
GET  /api/v1/dealers
POST /api/v1/knowledge/search
POST /api/v1/chat/messages
```

Gerçek uygulamadaki yollar farklıysa OpenAPI source of truth kabul edilir ve görev belgesiyle fark raporlanır.

### 13.2. Contract kontrolleri

- Dış JSON alanları `camelCase`
- Python iç modelleri `snake_case`
- `extra` alan politikası açık
- Request body boyut sınırı
- Field uzunluk sınırı
- Content-Type doğrulaması
- Ortak başarı envelope’u
- Ortak hata envelope’u
- Validation hatalarının ortak formata dönüştürülmesi
- Request ID header/body tutarlılığı
- Hassas veri içermeyen error detail
- Localhost CORS allowlist
- Credentials politikasının açık olması
- Health endpoint’lerinin veri sızdırmaması
- Readiness’in Redis/provider durumunu doğru yansıtması
- OpenAPI snapshot drift kontrolü
- Frontend consumer contract testi

### 13.3. Route katmanı sınırı

Route fonksiyonları:

- doğrudan fixture okumamalı,
- Redis key üretmemeli,
- LangGraph iç state modelini response olarak döndürmemeli,
- iş kuralı içermemeli,
- raw upstream response sızdırmamalı,
- vendor SDK’sını doğrudan çağırmamalıdır.

---

## 14. Redis session ve idempotency son kabulü

Gerçek Redis entegrasyon testleriyle aşağıdaki davranışlar doğrulanmalıdır:

1. Ham session ID Redis key’de görünmez.
2. HMAC storage ID environment namespace ile kullanılır.
3. Session payload şema versiyonu taşır.
4. Session revision monoton artar.
5. Expected revision yanlışsa CAS conflict oluşur.
6. Paralel mutasyonlar veri kaybı üretmez.
7. Lock owner token olmadan release edilemez.
8. Süresi dolan lock başka owner tarafından alınabilir.
9. Lock lease gerektiğinde kontrollü yenilenir.
10. Salt read idle TTL’yi gereksiz yenilemez.
11. Mutasyon state ve TTL’yi atomik günceller.
12. Mutlak session ömrü idle refresh ile aşılamaz.
13. Payload byte sınırı uygulanır.
14. Bozuk payload güvenli hata üretir.
15. Aynı `clientMessageId` ve aynı payload replay sonucu aynı sonucu verir.
16. Aynı `clientMessageId` ve farklı payload conflict üretir.
17. Yarım kalmış idempotency kaydı kontrollü toparlanır.
18. Redis kesintisinde production memory fallback olmaz.
19. Memory adapter yalnız açık local/test modunda çalışır.
20. Readiness Redis yokken doğru biçimde başarısız olur.
21. Redis key/value test çıktısına veya telemetry’ye sızmaz.
22. Session’lar arası state izolasyonu vardır.
23. TTL ve cleanup testleri zaman kontrollü ve deterministiktir.
24. Checkpoint verisi session state ile aynı key/value sözleşmesine karıştırılmaz.
25. CLI ve API resource lifecycle bağlantıları kapatır.

---

## 15. Token bütçesi ve context compression son kabulü

Aşağıdaki invariant’lar test edilmelidir:

- Model profili ve context window açık config’tir.
- Gerçek tokenizer adapter’ı varsa doğru modelle eşleşir.
- Approximate tokenizer production’da sessiz fallback değildir.
- Output rezervi ve güvenlik payı input bütçesinden ayrılır.
- Final context hard input limitini aşmaz.
- Aşarsa model çağrısı yapılmaz.
- Recent history tam konuşma turlarıyla seçilir.
- Structured memory yalnız allowlist alanlarını taşır.
- Sipariş numarası, OTP, e-posta, telefon, adres ve koordinat structured memory’ye girmez.
- Summary artifact schema version ve provenance taşır.
- Summary PII redaction’dan geçer.
- Prompt injection metni policy olarak yükseltilmez.
- Retrieval/tool sonuçları kendi bütçe sınırına sahiptir.
- Supervisor ile Worker context görünümleri farklıdır.
- Worker yalnız alanına ait minimum gerekli context’i alır.
- Compression deterministic testlerde aynı girdiye aynı seçimi üretir.
- Legacy rolling summary migration’ı veri kaybını ve PII riskini raporlar.
- Token metric’leri kullanıcı içeriğini taşımaz.

---

## 16. LangGraph Supervisor–Worker son kabulü

### 16.1. Worker allowlist

Yalnız aşağıdaki Worker’lar çalıştırılabilmelidir:

```text
product_worker
order_worker
dealer_worker
faq_worker
```

Kullanıcı mesajı, retrieval veya model çıktısı dinamik Worker/tool adı oluşturamamalıdır.

### 16.2. Plan ve review invariant’ları

- Supervisor typed plan üretir.
- Plan step sayısı config limitini aşamaz.
- Çoklu intent kullanıcı mesajındaki sırayı korur.
- Belirsiz intent clarification üretir.
- Worker sonucu typed contract ile doğrulanır.
- Worker başka Worker’a doğrudan çağrı yapmaz.
- Worker SessionStore’a doğrudan yazmaz.
- Review kararı typed enum/union’dır.
- Replan sayısı sınırlıdır.
- Retry yalnız retryable ve idempotent hatalarda yapılır.
- Timeout sınırlıdır.
- Recursion/transition limiti vardır.
- Partial success güvenli ve açık biçimde sunulur.
- Replay side effect’i iki kez çalıştırmaz.
- Checkpointer `thread_id` ve session ID sorumlulukları karıştırılmaz.
- Normal eksik bilgi her durumda interrupt olarak modellenmez.
- Prompt injection plan allowlist’ini aşamaz.
- Worker context’i başka domain hassas slotlarını içermez.

---

## 17. Frontend–backend entegrasyonu son kabulü

### 17.1. Mod seçimi

```text
local → local repositories + local ChatTransport
api   → HTTP repositories + HTTP ChatTransport
```

Doğrulanacak kurallar:

- Mod uygulama başlangıcında açık seçilir.
- API hatasında sessiz local fallback olmaz.
- API modunda local `resolveChatInput` çağrılmaz.
- Local modda backend zorunlu değildir.
- API modunda contract parser zorunludur.

### 17.2. Session ve mesaj kimliği

- İlk request session’sız gönderilebilir.
- Backend session ID üretip response’ta döndürür.
- Frontend session ID’yi yalnız bellekte tutar.
- Yeni mesaj yeni `clientMessageId` alır.
- Retry aynı kimliği ve aynı payload’ı kullanır.
- Düzenlenen mesaj yeni kimlik alır.
- Duplicate response iki bot mesajı üretmez.
- Reset active request’i iptal eder.
- Eski generation response’u ekrana yazılmaz.

### 17.3. Ağ güvenliği

- Timeout uygulanır.
- AbortSignal desteklenir.
- Maksimum response boyutu kontrol edilir.
- Content-Type doğrulanır.
- Request ID tutarlılığı kontrol edilir.
- Güvenilmeyen action allowlist’ten geçer.
- Auth token veya session ID console’a yazılmaz.

---

## 18. KVKK, güvenlik ve gözlemlenebilirlik son kabulü

### 18.1. Veri envanteri

Her veri alanı için aşağıdaki metadata bulunmalıdır:

- veri adı
- veri sınıfı
- işleme amacı
- kaynak
- hedef
- saklama yeri
- saklama süresi
- redaction yöntemi
- owner rolü
- production hukuki onay durumu
- yurt dışı aktarım durumu

### 18.2. Sıfır tolerans kontrolleri

Aşağıdakilerin herhangi biri final sonucu `REJECTED` yapar:

- Yetkisiz sipariş bilgisi gösterimi
- Gerçek kişisel verinin demo fixture’a girmesi
- Ham kullanıcı mesajının telemetry’ye gitmesi
- Ham koordinatın log/analytics’e gitmesi
- Secret’ın repo, image, log veya final ZIP’e girmesi
- Prompt injection ile yetkisiz action/tool çalışması
- Production’da sessiz demo fallback
- Production Redis kesintisinde memory fallback
- Güvenlik header’larının kritik eksikliği ve açık internet yayını
- Bilinen kritik dependency açığının gerekçesiz bırakılması

### 18.3. Telemetry kabulü

- Structured allowlist log
- Düşük kardinaliteli metric
- İçeriksiz trace span
- Baggage alanlarında hassas veri yasağı
- Exporter arızasının ana request’i bozmaması
- Bounded queue/drop politikası
- Redaction unit testleri
- Sentetik marker sızıntı taraması
- Log rotation
- Alarm owner ve runbook bağlantısı

---

## 19. Test otomasyonu ve kalite güvence son kabulü

### 19.1. Zorunlu katmanlar

- Format/lint/type/static validation
- Frontend unit
- Frontend component
- Backend unit
- API contract
- OpenAPI drift
- Repository/transport contract
- Gerçek Redis integration
- LangGraph transition/invariant
- Context/token/privacy
- Full-stack smoke
- Browser E2E
- Accessibility
- Security/privacy leak
- Build
- Artifact/package validation

### 19.2. Test sonucu kaydı

Her komut için aşağıdaki bilgiler kaydedilmelidir:

```json
{
  "command": "npm test",
  "workingDirectory": ".",
  "startedAt": "...",
  "finishedAt": "...",
  "durationMs": 0,
  "exitCode": 0,
  "status": "PASS",
  "stdoutLog": "logs/npm-test.stdout.log",
  "stderrLog": "logs/npm-test.stderr.log",
  "sourceRevision": "..."
}
```

### 19.3. Flaky test kontrolü

- Kritik testte otomatik retry varsayılan olmamalıdır.
- Retry kullanılıyorsa ilk hata ve tekrar sonucu birlikte raporlanmalıdır.
- Flaky test owner ve issue taşımadan quarantine edilemez.
- Quarantine edilen kritik test release kapısını devre dışı bırakamaz.
- Aynı revision’da tekrar çalıştırılan test sonucu overwrite edilmemeli; run kimliğiyle saklanmalıdır.

---

## 20. Docker ve local çalıştırma son kabulü

Aşağıdaki iki çalışma yolu ayrı doğrulanmalıdır.

### 20.1. Docker’sız yerel çalışma

- README’ye göre bağımlılık kurulumu
- Frontend dev/start
- Backend CLI
- Backend API
- Local demo modu
- Test komutları

### 20.2. Docker Compose çalışma

- `docker compose config`
- Image build
- Redis health
- API live/readiness
- Frontend health
- Full-stack smoke
- Redis kesinti testi
- API kesinti kullanıcı davranışı
- Güvenli log kontrolü
- `down` sonrası süreç/port temizliği
- Test volume izolasyonu

### 20.3. Container güvenliği

- Root olmayan kullanıcı
- Redis host’a varsayılan publish edilmez
- Secret image layer’a girmez
- `privileged` kullanılmaz
- Docker socket mount edilmez
- Host network kullanılmaz
- Gereksiz capability kaldırılır
- Runtime image minimum dosya taşır
- Healthcheck hassas veri döndürmez
- Resource limit veya koruma yaklaşımı belgelenir

---

## 21. Kurumsal entegrasyon son kabulü

Gerçek live adapter etkin değilse durum açıkça `DEMO_ONLY` veya `SANDBOX_ONLY` olmalıdır.

Kontroller:

- Sistem envanteri
- Veri owner’ları
- Field mapping
- Auth/network gereksinimleri
- Typed port/adapter
- Raw upstream response izolasyonu
- Timeout ve retry sınıflandırması
- Circuit breaker/bulkhead yaklaşımı
- Contract versioning
- Consumer contract testleri
- Data freshness
- Cache/invalidation
- Webhook imzası ve replay koruması
- Demo/sandbox/shadow/live mod ayrımı
- Feature flag
- Kill switch
- Shadow karşılaştırma
- Canary/rollback
- Gerçek sipariş için auth/ownership
- Handoff ticket idempotency
- KVKK ve yurt dışı aktarım onayı

Endpoint veya credential bilinmiyorsa live adapter fail-closed kalmalıdır.

---

## 22. Operasyon ve canlıya geçiş son kabulü

Final paket production’a çıkmasa bile aşağıdaki hazırlıkların durumu görünür olmalıdır:

- Environment matrisi
- Service catalog
- RACI
- Production readiness checklist
- Release manifest
- Immutable artifact yaklaşımı
- SBOM/provenance
- Staged rollout
- Canary stop criteria
- Kill switch
- Rollback runbook
- Schema/state uyumluluk kontrolü
- Dashboard
- Alarm
- On-call/escalation
- Incident classification
- Security/privacy incident süreci
- Backup kapsamı
- Restore testi
- RTO/RPO owner onayı
- Capacity/load/soak planı
- Backpressure
- Secret rotation
- Dependency patch cadence
- Retention/deletion
- Knowledge/model/prompt versioning
- Game day
- Postmortem şablonu
- Maintenance calendar
- Decommission planı

Gerçek owner veya altyapı bilgisi yoksa `PENDING` olarak raporlanır; production readiness `PASS` olamaz.

---

## 23. Pilot, UAT ve başarı metrikleri son kabulü

Aşağıdaki çıktılar doğrulanmalıdır:

- Pilot karar sorusu
- Pilot kapsamı ve dışlamalar
- En fazla üç ana KPI
- Driver metrikleri
- Guardrail metrikleri
- Diagnostic metrikler
- Metric registry
- Event catalog
- Task attempt lifecycle
- Retry/replay dedupe
- Demo/test/pilot trafik ayrımı
- Veri kalite kontrolleri
- Dashboard source-of-truth
- UAT senaryo kataloğu
- Critical UAT listesi
- İnsan değerlendirme rubric’i
- Değerlendirici kalibrasyonu
- Geri bildirim gizlilik sınırları
- Pilot stop rules
- Go/no-go karar matrisi
- Baseline ve target ayrımı
- Güven aralığı/örneklem yaklaşımı
- Pilot bulgularının backlog’a aktarımı

Gerçek pilot yapılmadıysa pilot sonucu `PASS` yazılmaz; **pilot hazırlığı** ile **pilot sonucu** ayrı raporlanır.

---

## 24. Dokümantasyon kabulü

### 24.1. Zorunlu okunabilirlik

Belgeler:

- birbiriyle çelişmemeli,
- göreceli ve bozuk link taşımamalı,
- artık kullanılmayan komutları kaynak gerçekliği gibi sunmamalı,
- gerçek ve demo davranışını ayırmalı,
- bilinmeyen bilgiyi tahmin etmemeli,
- tekrar üretilebilir komutlar vermeli,
- Windows/WSL2/macOS/Linux notlarını tutarlı kullanmalı,
- güvenlik ve gizlilik uyarılarını görünür tutmalıdır.

### 24.2. Link ve başlık kontrolü

Otomatik doğrulama en az şunları yapmalıdır:

- `cursor-tasks/00–20` eksiksiz
- görev indeks bağlantıları geçerli
- docs iç linkleri geçerli
- referans verilen script gerçekten mevcut
- referans verilen npm script gerçekten mevcut
- code fence dengeli
- duplicate heading anchor riski raporlanmış
- boş zorunlu belge yok
- `TODO`, `TBD`, `PENDING` envanteri çıkarılmış

`PENDING` bulunması otomatik hata değildir; kritikliği ve owner’ı değerlendirilmelidir.

---

## 25. Dependency, lisans ve supply-chain kabulü

### 25.1. Dependency kilidi

- Frontend lockfile source ile uyumlu olmalıdır.
- Backend için tekrar üretilebilir dependency lock yaklaşımı bulunmalıdır.
- Unpinned production dependency raporlanmalıdır.
- Kullanılmayan dependency kaldırılmalı veya gerekçelendirilmelidir.
- Development ve runtime dependency ayrımı görünür olmalıdır.

### 25.2. Güvenlik taraması

Mümkün olan ortamda:

- dependency vulnerability scan
- secret scan
- source static scan
- container image scan
- license inventory
- SBOM üretimi

çalıştırılmalıdır.

Araç yoksa kontrol `BLOCKED` veya `NOT_RUN` olarak raporlanmalı; sahte temiz sonuç üretilmemelidir.

### 25.3. Lisans teslimi

Final teslimde en az:

```text
delivery/licenses/frontend-dependencies.json
delivery/licenses/backend-dependencies.json
delivery/licenses/NOTICE.md
```

veya eşdeğer makine okunabilir çıktı bulunmalıdır.

Lisans uygunluğu hukuki onay gerektiriyorsa teknik rapor yalnız envanter sunmalı, kesin hukuki karar vermemelidir.

---

## 26. Performans ve kapasite son kabulü

Kesin hedefler önceki SLO ve pilot belgelerinden alınmalı; değer yoksa uydurulmamalıdır.

En az aşağıdaki davranışlar ölçülmelidir:

- Frontend build boyutu
- İlk yükleme ve etkileşim sinyalleri
- Chat açılma gecikmesi
- API p50/p95/p99 latency
- Worker latency dağılımı
- Redis operation latency
- Token/context boyutu
- Concurrent session davranışı
- Retry storm
- Slow upstream
- Response body sınırı
- Memory/CPU eğilimi
- Soak testi
- Controlled `429/503`
- Queue veya saturation işareti

Sonuçlar kişisel veri içermeyen sentetik workload ile üretilmelidir.

---

## 27. Erişilebilirlik son kabulü

Minimum kontroller:

- Keyboard-only dört MVP akışı
- Mantıklı focus sırası
- Görünür focus
- Launcher focus return
- Dialog name/role
- Form label ve error association
- `aria-live` mesaj duyurusu
- Sipariş timeline current step
- Harita için liste alternatifi
- Pinlerin klavye ile seçilmesi
- Ürün kartlarının anlamlı accessible name’i
- Kontrast
- Zoom ve reflow
- Mobil ekran
- Reduced motion
- Ekran okuyucu manuel smoke
- Otomatik accessibility scan

Otomatik accessibility taraması manuel keyboard/screen-reader kontrolünün yerine geçmez.

---

## 28. Hata toleransı ve fault-injection son kabulü

Sentetik ve kontrollü ortamda aşağıdaki arızalar denenmelidir:

1. Redis bağlantı reddi
2. Redis timeout
3. CAS conflict
4. Lock timeout
5. API timeout
6. Bozuk API JSON
7. Yanlış content-type
8. Fazla büyük response
9. Product provider timeout
10. Order provider unauthorized
11. Dealer provider stale response
12. Knowledge provider invalid contract
13. Worker timeout
14. Worker invalid result
15. Context overflow
16. Checkpoint replay
17. Duplicate client message
18. Telemetry exporter arızası
19. Frontend offline
20. Reset sırasında geç yanıt
21. Container healthcheck failure
22. Disk/volume erişim problemi
23. Secret eksikliği
24. Config invalidity
25. Kurumsal kill switch aktivasyonu

Her senaryoda:

- kullanıcıya güvenli mesaj,
- doğru status/error code,
- uydurma veri üretmeme,
- hassas veri sızdırmama,
- bounded retry,
- observable ama içeriksiz event,
- recovery/rollback adımı

doğrulanmalıdır.

---

## 29. Final kabul otomasyonu

### 29.1. Tek komut

Proje kökünde aşağıdaki veya eşdeğer tek komut bulunmalıdır:

```bash
npm run verify:final
```

Bu komut:

1. environment preflight yapmalı,
2. source revision belirlemeli,
3. görev ve belge envanteri çıkarmalı,
4. secret/sensitive file pre-scan yapmalı,
5. frontend statik kontrollerini çalıştırmalı,
6. backend statik/unit kontrollerini çalıştırmalı,
7. contract testlerini çalıştırmalı,
8. gerçek Redis integration testlerini çalıştırmalı,
9. graph/context testlerini çalıştırmalı,
10. build üretmeli,
11. full-stack smoke ve mümkünse E2E çalıştırmalı,
12. security/privacy leak scan yapmalı,
13. artifact doğrulaması yapmalı,
14. kanıt dosyalarını üretmeli,
15. final statüyü hesaplamalıdır.

Bir alt komut başarısız olduğunda diğer bağımsız güvenli kontroller mümkünse devam ettirilebilir; final exit code başarısız olmalıdır.

### 29.2. Exit code standardı

Önerilen standard:

| Exit code | Anlamı |
|---:|---|
| `0` | Bütün zorunlu kapılar geçti |
| `1` | En az bir doğrulama başarısız |
| `2` | Preflight/config sorunu |
| `3` | Gerekli dependency veya servis bulunamadı |
| `4` | Güvenlik/gizlilik kritik ihlali |
| `5` | Paketleme veya manifest bütünlüğü bozuk |

Mevcut repo standardıyla farklı kodlar kullanılıyorsa belgeye yazılmalıdır.

### 29.3. Güvenli log yakalama

Orchestrator:

- stdout/stderr’i ayrı dosyalara yazmalı,
- terminale kısa ilerleme göstermeli,
- token veya secret redaction yapmalı,
- maksimum log boyutu uygulamalı,
- binary veya core dump paketlememeli,
- komut satırında secret göstermemelidir.

---

## 30. Final teslim paketi üretimi

### 30.1. Tek komut

```bash
npm run package:final
```

veya eşdeğeri bulunmalıdır.

Komut yalnız son kabul sonucu izin veriyorsa paket üretmelidir. `--allow-blocked-demo` gibi bir seçenek varsa çıktı adı ve statüsü açıkça `DEMO_ONLY` olmalı, production-ready paketle karışmamalıdır.

### 30.2. Paket kök yapısı

Final ZIP tek bir kök klasör içermelidir:

```text
merinos-chatbot-demo/
```

ZIP açıldığında dosyalar doğrudan dağınık biçimde hedef klasöre düşmemelidir.

### 30.3. Paket içine alınacaklar

- frontend source
- backend source
- testler
- sentetik fixture’lar
- migration’lar
- lockfile’lar
- güvenli example config’ler
- Docker/Compose dosyaları
- scriptler
- docs
- `cursor-tasks/00–20`
- final handoff ve acceptance belgeleri
- sanitize edilmiş final kanıt özeti
- source manifest
- dependency/license envanteri
- release notes

### 30.4. Paket dışında bırakılacaklar

```text
.git/
.github token cache’leri
node_modules/
.venv/
venv/
__pycache__/
.pytest_cache/
.mypy_cache/
.ruff_cache/
.next/
dist/
coverage raw cache/
playwright browser binaries/
test-results raw screenshots with sensitive content/
.wrangler/
.turbo/
.vscode/
.idea/
.DS_Store
Thumbs.db
.env
.env.*.local
*.pem
*.key
*.p12
*.pfx
*.log
*.tmp
*.swp
*.pid
dump.rdb
appendonly.aof*
local database files
real credentials
```

Güvenli `.env.example` dosyaları bu dışlama kuralının istisnasıdır.

### 30.5. Deterministik paketleme

Paketleyici mümkün olduğunca:

- yolları normalize etmeli,
- dosyaları lexicographic sırada eklemeli,
- path traversal engellemeli,
- symlink politikasını açık uygulamalı,
- gizli dosyaları allowlist/denylist ile değerlendirmeli,
- dosya izinlerini öngörülebilir kılmalı,
- timestamp davranışını manifestte açıklamalı,
- source dosyalarını paketleme sırasında değiştirmemelidir.

Tam byte-for-byte reproducibility sağlanmıyorsa nedenleri raporlanmalıdır.

---

## 31. Delivery manifest sözleşmesi

`FINAL-DELIVERY-MANIFEST.json` en az aşağıdaki alanları taşımalıdır:

```json
{
  "schemaVersion": "1.0",
  "project": "merinos-chatbot-demo",
  "deliveryStatus": "DEMO_ONLY_ACCEPTED",
  "sourceRevision": "<commit-or-source-digest>",
  "acceptanceRunId": "<run-id>",
  "createdAtUtc": "<iso-8601>",
  "runtime": {
    "node": "<version>",
    "npm": "<version>",
    "python": "<version>",
    "docker": "<version-or-null>"
  },
  "taskFiles": {
    "first": "00-PROJE-ANAYASASI.md",
    "last": "20-SON-KABUL-VE-TESLIM-PAKETI.md",
    "count": 21
  },
  "acceptance": {
    "passed": 0,
    "failed": 0,
    "blocked": 0,
    "notRun": 0,
    "waived": 0
  },
  "artifacts": [],
  "openRisks": [],
  "pendingApprovals": [],
  "files": []
}
```

### 31.1. Dosya manifesti

Her paket dosyası için:

```json
{
  "path": "merinos-chatbot-demo/README.md",
  "sizeBytes": 0,
  "sha256": "...",
  "classification": "documentation",
  "generated": false
}
```

Alanları bulunmalıdır.

### 31.2. Manifest doğrulaması

- Schema validation
- Duplicate path kontrolü
- Case-insensitive collision kontrolü
- Path traversal kontrolü
- Paket içindeki gerçek boyut/hash karşılaştırması
- Manifestte olup pakette olmayan dosya kontrolü
- Pakette olup manifestte olmayan dosya kontrolü

---

## 32. Checksum teslimi

Final ZIP üretildikten sonra ayrı dosyada SHA-256 yazılmalıdır.

Örnek içerik:

```text
<sha256>  Merinos_Chatbot_Demo_Localhost_Final.zip
```

Doğrulama:

```bash
sha256sum -c Merinos_Chatbot_Demo_Localhost_Final.zip.sha256
```

Windows için eşdeğer PowerShell doğrulaması dokümante edilmelidir:

```powershell
(Get-FileHash .\Merinos_Chatbot_Demo_Localhost_Final.zip -Algorithm SHA256).Hash
```

Checksum dosyası final ZIP’in içine gömülmemelidir; dış teslim öğesidir.

---

## 33. Paketi yeniden açarak doğrulama

Final paket geçici, temiz bir klasöre açılmalıdır.

Doğrulama en az şunları içermelidir:

1. ZIP CRC/bütünlük kontrolü
2. Tek kök klasör kontrolü
3. Path traversal kontrolü
4. Manifest hash kontrolü
5. Secret/sensitive file yeniden taraması
6. `cursor-tasks/00–20` sayımı
7. README ve handoff dosyalarının bulunması
8. Dependency install preflight
9. Mümkünse build
10. Mümkünse unit/scope test
11. Artifact validator
12. Final doğrulama scriptinin `--package-mode` çalışması

Kaynak çalışma klasöründeki cache veya bağımlılıklar paketin doğrulanmasını yanlışlıkla kolaylaştırmamalıdır.

---

## 34. Güvenlik ve gizlilik paket taraması

Final ZIP üzerinde binary/text taraması yapılmalıdır.

### 34.1. Aranacak sentetik marker’lar

Testlerde kontrollü marker’lar kullanılmalıdır:

```text
SENSITIVE_TEST_MESSAGE_9f4c
TEST_ORDER_FULL_2026_9999
TEST_LATITUDE_37_0662
TEST_LONGITUDE_37_3833
TEST_BEARER_TOKEN_DO_NOT_SHIP
```

Bu marker’lar final source fixture’da yalnız güvenlik test kodu içinde bulunabilir; generated log, report, telemetry örneği veya teslim kanıtında bulunmamalıdır.

### 34.2. Pattern taraması

- private key header
- bearer token
- AWS/GCP/Azure credential benzeri pattern
- connection string
- Redis URL password
- gerçek e-posta/telefon/adres örneği
- tam sipariş referansı
- ham koordinat
- cookie/session dump

Pattern eşleşmesi otomatik olarak gerçek secret kararı vermemeli; bulgular sınıflandırılmalıdır. Doğrulanmış gerçek secret bulunursa teslim durdurulmalıdır.

---

## 35. Final handoff rehberi

`docs/FINAL-HANDOFF-GUIDE.md` en az aşağıdaki başlıkları içermelidir:

1. Projenin amacı
2. Dört MVP akışı
3. Mimari özet
4. Frontend çalışma biçimi
5. Backend çalışma biçimi
6. Local ve API modu
7. Redis ve session davranışı
8. LangGraph Supervisor–Worker akışı
9. Config ve secret yönetimi
10. Docker’sız kurulum
11. Docker ile kurulum
12. Test komutları
13. Final doğrulama komutu
14. Demo verileri
15. Kurumsal entegrasyon hazırlığı
16. Güvenlik/KVKK sınırları
17. Gözlemlenebilirlik
18. Açık riskler ve pending kararlar
19. Sorun giderme
20. Devir sonrası ilk önerilen işlemler

Rehber yeni ekip üyesinin source code’u incelemeden önce sistemi doğru çerçevede anlamasını sağlamalıdır.

---

## 36. Açık risk ve pending envanteri

`docs/OPEN-RISKS-AND-PENDING.md` ve makine okunabilir JSON aynı source of truth’tan üretilmelidir.

Her kayıt:

```json
{
  "id": "RISK-001",
  "title": "...",
  "category": "security",
  "severity": "P1",
  "status": "OPEN",
  "ownerRole": "PENDING_OWNER",
  "sourceTask": "17",
  "evidence": [],
  "impact": "...",
  "mitigation": "...",
  "dueDate": null,
  "blocksProduction": true
}
```

alanlarını taşımalıdır.

### 36.1. Zorunlu risk sınıfları

- product/functionality
- data quality
- security
- privacy/KVKK
- accessibility
- reliability
- performance
- dependency/supply-chain
- enterprise integration
- operations
- pilot/measurement
- documentation/handoff

Açık kritik risk yoksa “yok” yazılabilir; ancak taramanın yapıldığı kanıtlanmalıdır.

---

## 37. Release notes gereksinimi

`docs/RELEASE-NOTES.md` şu bilgileri içermelidir:

- release adı ve revision
- teslim durumu
- kullanıcıya görünen işlevler
- mimari değişiklikler
- güvenlik/KVKK iyileştirmeleri
- test kapsamı
- bilinen sınırlamalar
- demo veri uyarısı
- kurumsal/live entegrasyon durumu
- migration veya config değişiklikleri
- rollback bilgisi
- açık riskler

Release notes reklam metni olmamalı; doğrulanmış değişiklik ve sınırlamaları açıklamalıdır.

---

## 38. Kullanıcı kabul kanıtı

UAT yapıldıysa final kanıt:

- senaryo ID
- test eden rol
- build/revision
- ortam
- başlangıç koşulları
- adımlar
- beklenen sonuç
- gerçek sonuç
- durum
- defect bağlantısı
- kişisel veri içermeyen evidence

alanlarını taşımalıdır.

UAT yapılmadıysa:

- test paketi hazır
- gerçek kullanıcı uygulaması bekleniyor
- owner/onay `PENDING`

şeklinde açık raporlanmalıdır.

---

## 39. Final kalite kapıları

### 39.1. P0 — Mutlak kapılar

Aşağıdakiler `PASS` olmadan final durum `ACCEPTED` olamaz:

- Dört MVP akışı temel işlevsel testleri
- Yetkisiz sipariş veri erişimi engeli
- Secret ve hassas telemetry sızıntı taraması
- Frontend ve backend build/import doğrulaması
- API contract ve OpenAPI drift
- Redis CAS/lock/idempotency gerçek integration testi
- LangGraph Worker allowlist ve context izolasyonu
- Token hard-limit ve PII redaction
- Local/API modunda sessiz fallback olmaması
- Production Redis memory fallback olmaması
- ZIP bütünlüğü ve manifest hash doğrulaması
- `00–20` görev dosyalarının eksiksizliği
- Kritik accessibility keyboard akışları
- Final paketin temiz klasörde açılıp doğrulanması

### 39.2. P1 — Koşullu kabul kapıları

- Browser E2E tam matrisi
- Performance baseline
- Container image scan
- Lisans inceleme onayı
- Restore prova kanıtı
- Kurumsal sandbox contract testleri
- UAT critical olmayan senaryolar
- Pilot baseline hazırlığı

P1 açıkları ancak süreli, sahipli ve production etkisi değerlendirilmişse `CONDITIONAL_ACCEPTANCE` altında kalabilir.

### 39.3. P2 — Sonraki iterasyon

- Geniş tarayıcı/device matrisi
- Uzun süreli soak
- Gelişmiş dashboard
- Ek destek kanalı
- Ek ürün öneri yetenekleri
- Daha geniş pilot segmentleri

P2 açıkları ana MVP teslimini engellemez; backlog’a taşınır.

---

## 40. Final kabul karar matrisi

| Koşul | Sonuç |
|---|---|
| Tüm P0 `PASS`, P1 kritik açık yok | `ACCEPTED` |
| Tüm P0 `PASS`, sahipli ve süreli P1 açıkları var | `CONDITIONAL_ACCEPTANCE` |
| Demo P0’ları geçti, production/kurumsal/onay kapıları eksik | `DEMO_ONLY_ACCEPTED` |
| P0 `BLOCKED`, `NOT_RUN` veya `PENDING_REVIEW` | `BLOCKED` |
| P0 `FAIL` | `REJECTED` |
| Secret/KVKK/yetkisiz veri ihlali | `REJECTED` ve incident review |
| Paket checksum/manifest bozuk | `REJECTED` |

Karar algoritması kodla uygulanmalı ve rapor ile JSON’da aynı sonucu üretmelidir.

---

## 41. Final uygulama sırası

Cursor aşağıdaki sırayı izlemelidir:

### Aşama A — Envanter

1. `00–20` görev dosyalarını doğrula.
2. Kaynak ağacını ve mevcut çıktıları çıkar.
3. Eksik zorunlu dosyaları belirle.
4. Git/source revision belirle.
5. Mevcut test ve script envanterini çıkar.
6. PENDING/TODO/waiver envanterini çıkar.

### Aşama B — Karakterizasyon

7. Mevcut dört MVP davranışını çalıştır.
8. Mevcut testlerin gerçek durumunu kaydet.
9. Local ve API modlarını ayrı doğrula.
10. Test/kanıt boşluklarını matrise yaz.

### Aşama C — Eksik final altyapısı

11. `cursor-tasks/README.md` indeksini oluştur.
12. Final acceptance orchestrator’u oluştur.
13. Paket üretim scriptini oluştur.
14. Paket doğrulama scriptini oluştur.
15. Manifest schema ve üreticisini oluştur.
16. Final handoff, risk ve release belgelerini oluştur.

### Aşama D — Teknik kabul

17. Frontend statik/unit/component kontrollerini çalıştır.
18. Backend unit/API/contract kontrollerini çalıştır.
19. Redis integration kontrollerini çalıştır.
20. LangGraph/context kontrollerini çalıştır.
21. Build ve artifact doğrulaması yap.
22. Full-stack smoke ve E2E çalıştır.
23. Accessibility kontrollerini çalıştır.
24. Security/privacy leak taraması yap.
25. Dependency/license/SBOM kontrollerini çalıştır.

### Aşama E — Operasyon ve pilot kabulü

26. Operasyon belgelerini doğrula.
27. Rollback/backup/restore kanıtlarını sınıflandır.
28. Kurumsal entegrasyon modunu doğrula.
29. UAT ve pilot hazırlığını değerlendir.
30. Açık riskleri owner ve blocking durumuyla kaydet.

### Aşama F — Paketleme

31. Kaynak çalışma ağacı durumunu kaydet.
32. Final evidence özetini sanitize et.
33. Delivery manifest üret.
34. Final ZIP üret.
35. ZIP checksum üret.
36. ZIP’i temiz klasörde aç.
37. Manifest ve secret taramasını yeniden çalıştır.
38. Paket içinden mümkün olan smoke/validation kontrollerini çalıştır.

### Aşama G — Karar ve teslim

39. Final karar algoritmasını çalıştır.
40. `FINAL-ACCEPTANCE-REPORT.md` üret.
41. `FINAL-DELIVERY-MANIFEST.json` üret.
42. Dosya ve checksum yollarını raporla.
43. Çalıştırılamayan her kontrolü açıkça listele.
44. Kullanıcıya yeni özellik yazmadan teslimi durdur.

---

## 42. İzin verilen değişiklikler

Bu görevde yalnız aşağıdaki tür değişiklikler yapılabilir:

- Önceki görevlerde zorunlu olup eksik kalan küçük entegrasyon düzeltmeleri
- Son kabul otomasyonu
- Paketleme ve doğrulama scriptleri
- Test altyapısı düzeltmeleri
- Contract drift veya bozuk link düzeltmeleri
- Gizlilik/güvenlik açığını kapatan değişiklikler
- Handoff, risk, release ve acceptance belgeleri
- Görev indeksi
- Build ve artifact doğrulama iyileştirmeleri

Her uygulama kodu değişikliği:

- ilgili önceki görev numarasına bağlanmalı,
- davranış testine sahip olmalı,
- final raporda listelenmeli,
- yeni ürün kapsamı eklememelidir.

---

## 43. Yasak değişiklikler

Bu görevde şunlar yapılmamalıdır:

- Beşinci bir chatbot domain Worker’ı eklemek
- Yeni ürün özelliği geliştirmek
- Gerçek ödeme/iade/iptal işlemi eklemek
- Gerçek kurumsal endpoint veya secret uydurmak
- Gerçek müşteri verisi kullanmak
- Test geçsin diye validation kaldırmak
- Test geçsin diye auth/ownership bypass etmek
- Test geçsin diye Redis’i tamamen memory’ye çevirmek
- API hatasında local fixture fallback eklemek
- Full-stack test yerine yalnız mock testi kabul etmek
- Çalıştırılmayan kontrolü rapordan çıkarmak
- Eski kanıtı yeni revision kanıtı gibi kopyalamak
- Paket boyutunu küçültmek için zorunlu source/test/doc dosyasını çıkarmak
- Final pakete dependency klasörleri veya secret koymak
- Production deployment yapmak
- DNS, TLS veya gerçek trafik yönlendirmesi yapmak
- Kurum adına SLA, on-call veya hukuki onay vermek

---

## 44. Zorunlu otomatik testler

Final görev en az aşağıdaki yeni testleri eklemelidir:

1. `cursor-tasks/00–20` eksiksiz ve sıralı
2. Görev indeks bağlantıları geçerli
3. Final manifest schema geçerli
4. Manifest duplicate path yok
5. Manifest case-collision yok
6. Paket path traversal yok
7. ZIP tek kök klasör içeriyor
8. Yasak dosyalar ZIP içinde yok
9. `.env.example` korunuyor
10. Secret pattern taraması kritik bulgu vermiyor
11. Checksum doğrulanıyor
12. Paket dosyalarının hash’i manifestle eşleşiyor
13. Pakette manifest dışı dosya yok
14. Manifestte pakette olmayan dosya yok
15. Final status hesaplama deterministik
16. `NOT_RUN` durumunun `PASS`’e dönüşmediği
17. Kritik `FAIL` durumunda package release-ready olmuyor
18. Demo-only kararının production-ready ile karışmadığı
19. Kanıt dosyalarının source revision ile eşleştiği
20. Paket doğrulamasının temiz klasörde çalıştığı

---

## 45. Önerilen npm scriptleri

`package.json` içine mevcut standarda uygun olarak aşağıdaki veya eşdeğer scriptler eklenmelidir:

```json
{
  "scripts": {
    "verify:tasks": "node scripts/verify-task-set.mjs",
    "verify:final": "node scripts/final-acceptance.mjs",
    "package:final": "node scripts/create-delivery-package.mjs",
    "verify:package": "node scripts/verify-delivery-package.mjs"
  }
}
```

Script adları farklıysa handoff rehberi ve final rapor aynı gerçek adları kullanmalıdır.

---

## 46. Önerilen doğrulama komutları

Gerçek proje komutları envanterden türetilmelidir. Örnek final sıra:

```bash
# Ortam
node --version
npm --version
python --version
docker --version
docker compose version

# Görev ve belge seti
npm run verify:tasks

# Frontend
npm ci
npm run lint
npm run test
npm run build
npm run validate:artifact

# Backend
cd backend
python -m pip install -e ".[checkpoint]"
python -m unittest discover -s tests -p "test_*.py"
cd ..

# Compose ve full stack
npm run stack:config
npm run stack:build
npm run stack:test
npm run stack:smoke

# Final
npm run verify:final
npm run package:final
npm run verify:package
```

Komut mevcut değilse önceki görev çıktısı olarak eksikliği raporlanmalıdır. Komutun adı uydurularak çalıştı gösterilmemelidir.

### 46.1. Windows notu

Bash zorunlu scriptler varsa WSL2/Git Bash gereksinimi açıkça belirtilmeli veya Node tabanlı platformlar arası eşdeğer sağlanmalıdır.

---

## 47. Final kabul raporu formatı

`FINAL-ACCEPTANCE-REPORT.md` en az şu yapıya sahip olmalıdır:

```markdown
# Merinos Chatbot — Final Kabul Raporu

## Teslim özeti
- Proje:
- Revision:
- Acceptance run:
- Tarih:
- Nihai durum:

## Kapsam
- Dört MVP akışı
- Local/API modu
- Kurumsal/live kapsam durumu

## 00–19 izlenebilirlik özeti
| Görev | Durum | Kanıt | Açık nokta |

## Kalite kapıları
| Kapı | Durum | Komut | Exit code | Kanıt |

## İşlevsel kabul
- Ürün:
- Sipariş:
- Bayi:
- SSS:

## Güvenlik ve KVKK
- Secret scan:
- Telemetry leak:
- Yetkilendirme:
- Açık onaylar:

## Operasyon
- Docker/local:
- Readiness:
- Rollback:
- Backup/restore:
- On-call/SLO:

## Pilot ve UAT
- Hazırlık:
- Gerçek pilot:
- KPI baseline:
- Karar:

## Paket
- ZIP:
- SHA-256:
- Manifest:
- Temiz klasör doğrulaması:

## Açık riskler
- ...

## Çalıştırılamayan kontroller
- ...

## Nihai karar gerekçesi
- ...

## Sonraki sahipli işlemler
- ...
```

---

## 48. Cursor tamamlanma raporu formatı

Cursor görev sonunda yalnız doğrulanmış bilgiyle aşağıdaki kısa raporu vermelidir:

```markdown
## Nihai durum
- ACCEPTED / CONDITIONAL_ACCEPTANCE / DEMO_ONLY_ACCEPTED / BLOCKED / REJECTED

## Tamamlananlar
- ...

## Değişen dosyalar
- `...`

## Kalite kapıları
- `komut`: PASS / FAIL / BLOCKED / NOT_RUN — exit code

## Final teslimler
- ZIP: `...`
- SHA-256: `...`
- Kabul raporu: `...`
- Manifest: `...`

## Açık riskler ve pending onaylar
- ...

## Çalıştırılamayan kontroller
- ...

## Sonraki işlem
- Yeni geliştirmeye otomatik geçilmedi; teslim ve devralma bekleniyor.
```

---

## 49. Kabul ölçütleri

Görev ancak aşağıdaki maddeler değerlendirilip gerçek durumları kaydedildiğinde tamamlanmış sayılır.

### 49.1. Görev seti

- [ ] `cursor-tasks/00–20` dosyaları eksiksizdir.
- [ ] `cursor-tasks/README.md` sıralı indeks içerir.
- [ ] Bütün görev linkleri geçerlidir.
- [ ] Her görev izlenebilirlik matrisine bağlıdır.
- [ ] Eksik önceki görev çıktıları görünür biçimde raporlanmıştır.

### 49.2. İşlev

- [ ] Ürün arama P0 senaryoları değerlendirilmiştir.
- [ ] Sipariş P0 senaryoları değerlendirilmiştir.
- [ ] Bayi P0 senaryoları değerlendirilmiştir.
- [ ] SSS P0 senaryoları değerlendirilmiştir.
- [ ] Chatbot konuşma deneyimi kritik akışları değerlendirilmiştir.
- [ ] Site–chatbot state senkronu değerlendirilmiştir.

### 49.3. Backend ve state

- [ ] FastAPI contract ve OpenAPI drift değerlendirilmiştir.
- [ ] Redis CAS/lock/TTL/idempotency gerçek integration durumu kaydedilmiştir.
- [ ] Token hard-limit ve redaction değerlendirilmiştir.
- [ ] Supervisor–Worker allowlist/context izolasyonu değerlendirilmiştir.
- [ ] Checkpoint replay idempotency değerlendirilmiştir.

### 49.4. Güvenlik ve KVKK

- [ ] Secret taraması çalıştırılmış veya açıkça `BLOCKED/NOT_RUN` kaydedilmiştir.
- [ ] Hassas telemetry sızıntı testi değerlendirilmiştir.
- [ ] Yetkisiz sipariş veri erişimi testi değerlendirilmiştir.
- [ ] Browser storage gizlilik kontrolleri değerlendirilmiştir.
- [ ] Final ZIP ayrıca güvenlik taramasından geçirilmiştir.
- [ ] Yurt dışı aktarım ve production hukuki onay eksikleri görünürdür.

### 49.5. Kalite ve çalışma ortamı

- [ ] Frontend lint/test/build durumu kaydedilmiştir.
- [ ] Backend test durumu kaydedilmiştir.
- [ ] Contract test durumu kaydedilmiştir.
- [ ] Redis integration durumu kaydedilmiştir.
- [ ] Full-stack smoke durumu kaydedilmiştir.
- [ ] Browser E2E durumu kaydedilmiştir.
- [ ] Accessibility durumu kaydedilmiştir.
- [ ] Docker build/health durumu kaydedilmiştir.
- [ ] Docker’sız çalışma durumu kaydedilmiştir.

### 49.6. Operasyon ve pilot

- [ ] Production readiness belgeleri değerlendirilmiştir.
- [ ] Rollback/kill switch durumu kaydedilmiştir.
- [ ] Backup/restore durumu kaydedilmiştir.
- [ ] SLO/owner/on-call `PENDING` alanları görünürdür.
- [ ] UAT hazırlığı değerlendirilmiştir.
- [ ] Gerçek pilot yapılmadıysa yapılmış gibi raporlanmamıştır.
- [ ] KPI baseline ve hedef durumu açıkça ayrılmıştır.

### 49.7. Paket

- [ ] Final ZIP tek kök klasör içerir.
- [ ] Yasak dosyalar dışlanmıştır.
- [ ] Manifest schema geçerlidir.
- [ ] Her paket dosyasının SHA-256 değeri vardır.
- [ ] ZIP dış checksum dosyası üretilmiştir.
- [ ] ZIP temiz klasöre açılmıştır.
- [ ] Paket içeriği manifestle eşleşmektedir.
- [ ] Paket içinde secret bulunmadığı doğrulanmıştır.
- [ ] Final kabul raporu ve manifest teslim edilmiştir.

### 49.8. Dürüstlük

- [ ] Çalıştırılmayan hiçbir kontrol `PASS` değildir.
- [ ] Eski revision kanıtı kullanılmamıştır.
- [ ] Kritik `FAIL/BLOCKED` gizlenmemiştir.
- [ ] Waiver’lar sahipli ve sürelidir.
- [ ] Nihai statü karar matrisine göre hesaplanmıştır.

---

## 50. Durma ve `NO-GO` koşulları

Aşağıdaki durumlardan biri varsa Cursor final paketi `RELEASE_READY` veya `ACCEPTED` olarak işaretlememelidir:

- `00–20` görev seti eksikse
- Dört MVP akışından biri kritik biçimde çalışmıyorsa
- Sipariş yetkilendirmesi fail-open ise
- Gerçek kişisel veri demo veya test fixture’a girdiyse
- Ham kullanıcı mesajı veya koordinat telemetry’ye gidiyorsa
- Secret repo, image, log veya ZIP içinde bulunuyorsa
- API contract drift incelenmemişse
- Redis CAS/lock/idempotency kanıtsızsa
- Production Redis kesintisinde memory fallback varsa
- API hatasında sessiz local demo fallback varsa
- Worker allowlist aşılabiliyorsa
- Context hard limiti aşılabiliyorsa
- PII redaction başarısızsa
- Kritik accessibility keyboard akışı bozuksa
- Final ZIP bozuksa
- Manifest hashleri eşleşmiyorsa
- Yasak dosya ZIP’e girdiyse
- Checksum doğrulanmıyorsa
- Paket temiz klasörde çalıştırılamıyorsa ve bu durum gizleniyorsa
- Çalıştırılmayan P0 test `PASS` yazıldıysa
- Critical risk owner’sız ve görünmez bırakıldıysa
- Production/law/security onayı olmadan canlı kullanım öneriliyorsa
- Gerçek pilot yapılmadan pilot başarısı iddia ediliyorsa
- Son kabul raporu ile JSON manifest sonucu çelişiyorsa

Bu durumda güvenli kaynak paketi yine teslim edilebilir; ancak durum `BLOCKED`, `REJECTED` veya uygun şekilde `DEMO_ONLY_ACCEPTED` olmalıdır.

---

## 51. Sorun bulunduğunda izlenecek yöntem

Son kabul sırasında hata bulunursa Cursor:

1. Hatanın hangi önceki göreve ait olduğunu belirlemeli.
2. Minimum güvenli düzeltmeyi yapmalı.
3. Regresyon testi eklemeli.
4. İlgili kalite kapısını tekrar çalıştırmalı.
5. Bağımlı kapıları gerektiğinde tekrar çalıştırmalı.
6. Değişen source revision’ı kanıtlara yansıtmalı.
7. Eski kanıtları güncel kabulte kullanmamalı.
8. Düzeltmeyi final raporda açıkça listelemeli.

Büyük mimari karar veya yeni ürün kapsamı gerekiyorsa düzeltme yapılmamalı; `BLOCKED` ve önerilen sonraki proje görevi olarak raporlanmalıdır.

---

## 52. Son görev sonrası davranış

Bu görev `20/20` son görevdir.

Görev tamamlandığında Cursor:

- yeni görev dosyası oluşturmamalı,
- otomatik yeni özellik geliştirmemeli,
- production deployment başlatmamalı,
- kurumsal credential istemeden live adapter açmamalı,
- kullanıcı adına Git commit/push yapmamalı,
- açık onay olmadan dosya silmemeli,
- teslim yollarını ve gerçek final durumunu raporlayıp durmalıdır.

---

## 53. Beklenen nihai sonuç

Bu görev doğru uygulandığında Merinos Chatbot projesi:

- `00–20` görev setiyle baştan sona izlenebilir hâle gelir.
- Dört MVP akışı gerçek kabul senaryolarıyla doğrulanır.
- Frontend, API, Redis, LangGraph ve context sözleşmeleri birlikte test edilir.
- Demo ve production davranışları kesin biçimde ayrılır.
- Hassas veri ve secret sızıntıları paket seviyesinde taranır.
- Test sonuçları gerçek komut ve exit code kanıtlarıyla saklanır.
- Çalıştırılamayan kontroller dürüstçe görünür kalır.
- Operasyon, kurumsal entegrasyon ve pilot hazırlığı tek karar matrisine bağlanır.
- Yeni ekip için devralma rehberi oluşur.
- Açık riskler sahipli ve öncelikli biçimde teslim edilir.
- Final kaynak paketi deterministik kurallarla üretilir.
- ZIP içeriği manifest ve SHA-256 checksum ile doğrulanır.
- Paket temiz klasörde yeniden açılıp kontrol edilir.
- Projenin gerçek durumu `ACCEPTED`, `CONDITIONAL_ACCEPTANCE`, `DEMO_ONLY_ACCEPTED`, `BLOCKED` veya `REJECTED` olarak kanıta dayalı biçimde belirlenir.

Bu dosya uygulandıktan sonra Cursor yeni göreve geçmemeli; final teslimi raporlayıp kullanıcı kararını beklemelidir.
