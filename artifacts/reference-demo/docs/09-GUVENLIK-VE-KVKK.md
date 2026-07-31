# Güvenlik ve KVKK Uygulama Notları

## Veri minimizasyonu
- Chat mesajı, tam sipariş numarası, ham konum, token ve oturum anahtarları telemetry alanlarına yazılmaz.
- Frontend session kimliği ve JWT yalnız bellekte tutulur.
- Sipariş sorgusu demo modunda sentetik veriyle çalışır. Canlı mod, kimlik ve sipariş sahipliği doğrulayıcısı bulunmadan fail-closed davranır.
- Redis anahtarlarında ham session kimliği yerine HMAC özeti kullanılır.

## Uygulanan kontroller
- FastAPI request boyutu, validation, CORS ve güvenlik header'ları
- Ortak ve içerik sızdırmayan hata zarfı
- JWT ve rol tabanlı admin yetkilendirmesi
- Redis CAS, owner-token lock ve idempotency
- LangGraph Worker allowlist'i ve daraltılmış Worker context'i
- Prompt ve kullanıcı içeriğini güvenilmez veri kabul eden typed sonuç modelleri

## Production kapıları
Production için gerçek LangGraph, Redis, güçlü secretlar, provider tokenizer, HTTPS, kurum içi kimlik/sahiplik doğrulaması, hukuk/KVKK onayı ve yurt dışı aktarım değerlendirmesi zorunludur. Demo ayarları production'da reddedilir.
