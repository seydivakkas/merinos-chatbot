# Açık Riskler ve Engeller

| Risk | Durum | Kapatma koşulu |
|---|---|---|
| Frontend tam `npm ci`, typecheck, lint ve build bu ortamda tamamlanamadı | BLOCKED | Temiz Node 22 ortamında lockfile kurulumu (`zod-validation-error@4.0.2` dahil) ve tüm frontend kalite kapılarının geçmesi |
| Docker daemon bu doğrulama ortamında mevcut değil | BLOCKED | Compose config/build, gerçek Redis/PostgreSQL integration ve full-stack smoke çalıştırılması |
| Gerçek LangGraph paketi paket deposunda bulunamadı | BLOCKED_FOR_PRODUCTION | Standart bağımlılık kaynağından kurulum ve gerçek LangGraph regresyon testleri |
| Kurumsal katalog, stok, OMS, bayi ve CMS endpointleri bilinmiyor | PENDING | Sistem sahipleri, contract, auth ve sandbox bilgileri |
| Canlı sipariş kimliği/sahiplik doğrulayıcısı yok | FAIL_CLOSED | Kurumsal IAM ve server-side ownership portunun bağlanması |
| RAG/pgvector ve Qwen2.5-VL canlı inference eklenmedi | PLANNED | Ayrı güvenlik, kapasite ve model kabul süreci |
| Hukuki dayanak, aydınlatma ve yurt dışı aktarım kararı tamamlanmadı | PENDING | Kurum hukuk/KVKK onayı |
