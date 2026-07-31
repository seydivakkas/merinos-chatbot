# Operasyon Runbook

## Yerel çalıştırma
```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up --build
```

Frontend: `http://127.0.0.1:5173`  
API: `http://127.0.0.1:8000`  
API dokümanı: `http://127.0.0.1:8000/docs`

## Sağlık kontrolleri
```bash
curl -fsS http://127.0.0.1:8000/health/live
curl -fsS http://127.0.0.1:8000/health/ready
docker compose ps
```

## Sorun giderme
- API readiness başarısızsa Redis ve PostgreSQL health durumlarını kontrol edin.
- Redis kesintisinde production benzeri mod memory fallback yapmaz.
- Aynı mesaj tekrarında aynı `clientMessageId` korunmalıdır.
- Rollback için aynı image digest ve önceki uyumlu config/schema sürümü kullanılmalıdır.

## Güvenli kapatma ve reset
```bash
docker compose down
# Veri kaybı oluşturur; yalnız açık onayla:
docker compose down -v --remove-orphans
```
