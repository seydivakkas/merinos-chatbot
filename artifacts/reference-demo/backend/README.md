# Merinos LangGraph + Redis Python Şablonu

Bu klasör, Merinos chatbot için stateful Supervisor–Worker graph'ı ile Redis
tabanlı `SessionState` yönetimini birleştiren çalıştırılabilir örnektir.

Örnek şunları gösterir:

- `StateGraph` ile merkezi Supervisor planlama ve inceleme döngüsü
- Ürün, sipariş, bayi ve SSS için izole Worker alt grafikleri
- Aynı mesajdaki birden fazla görevi sıralı Worker planına dönüştürme
- Her tur başında Redis'ten oturum yükleme
- Kullanıcı ve asistan mesajlarını history'ye ekleme
- Token eşiğinde eski mesajları rolling summary'ye taşıma
- Her tur sonunda JSON session state'i kayan TTL ile Redis'e yazma
- Düğüm geçişlerini `transition_trace` içinde görünür kılma
- İsteğe bağlı LangGraph-native `AsyncRedisSaver`

Gerçek katalog, OMS, bayi, harita veya LLM çağrısı yapılmaz. Dönen iş
yanıtları temsili ve açıklayıcıdır.

## Kurulum

Gereksinimler: Python 3.11+, Docker ve Docker Compose.

```bash
cd backend
docker compose up -d redis

python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e .
```

İsteğe bağlı native Redis checkpoint desteği:

```bash
python -m pip install -e ".[checkpoint]"
```

## Çalıştırma

```bash
merinos-chatbot --session-id demo-001
```

Aynı `--session-id` değeriyle programı yeniden başlatmak, Redis'teki konuşmayı
devam ettirir.

Checkpoint desteği kurulduysa:

```bash
merinos-chatbot --session-id demo-001 --with-checkpoints
```

Örnek mesajlar:

```text
Krem 160x230 salon halısı arıyorum
MRN-2026-1042 siparişim nerede?
İstanbul bayilerini göster
İade süreci nasıl işler?
```

Her yanıttan sonra seçilen düğüm zinciri, yaklaşık token sayımı ve session
sürümü terminale yazılır.

## Test

Kurulumdan sonra:

```bash
PYTHONPATH=src python -m unittest discover -s tests -v
```

Testler Redis gerektirmeyen `InMemorySessionStore` ikizini kullanır. Gerçek
Redis bağlantısı CLI çalıştırmasında kullanılır.

## Yapılandırma

`.env.example` içindeki değerler ortam değişkeni olarak verilebilir. Şablon
`.env` dosyasını kendiliğinden yüklemez; üretimde container/orchestrator secret
ve config yönetimi kullanılması beklenir.

| Değişken | Varsayılan |
| --- | --- |
| `MERINOS_REDIS_URL` | `redis://localhost:6379/0` |
| `MERINOS_SESSION_TTL_SECONDS` | `1800` |
| `MERINOS_CONTEXT_WINDOW_TOKENS` | `8192` |
| `MERINOS_MAX_OUTPUT_TOKENS` | `800` |
| `MERINOS_SAFETY_MARGIN_TOKENS` | `512` |
| `MERINOS_COMPRESSION_TRIGGER_RATIO` | `0.75` |
| `MERINOS_RECENT_MESSAGES_TO_KEEP` | `8` |

## Üretim notu

Kod örneğindeki Redis yazımı tek payload için atomiktir, fakat paralel
isteklerde son-yazma-kazanır. Canlı sistemde session bazlı seri işleme veya
Redis `WATCH` tabanlı sürüm kontrolü eklenmelidir. Redis bağlantısı TLS/ACL ile
korunmalı; gerçek müşteri veya sipariş bilgileri loglara yazılmamalıdır.

Ayrıntılı tasarım ve yapılacaklar:

- [LangGraph, Redis ve Bağlam Yönetimi Mimari Rehberi](../docs/06-LANGGRAPH-REDIS-STATE-MIMARISI.md)
- [Supervisor–Worker Akışı ve Uygulama Rehberi](../docs/07-SUPERVISOR-WORKER-MIMARISI.md)
