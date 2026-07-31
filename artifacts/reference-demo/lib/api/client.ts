import type { DataError, DataResult } from "@/lib/types";

export type ApiSuccess<T> = { data: T; meta: { requestId: string; generatedAt?: string; demo: boolean } };
export type ApiFailure = { error: { code: string; message: string; retryable: boolean; fields?: Record<string, string> }; meta: { requestId: string; demo: boolean } };

export class ApiClient {
  readonly baseUrl: string;
  readonly timeoutMs: number;

  constructor(baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000", timeoutMs = 8000) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.timeoutMs = timeoutMs;
  }

  async request<T>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<DataResult<T>> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort("timeout"), this.timeoutMs);
    const abort = () => controller.abort(signal?.reason ?? "caller");
    signal?.addEventListener("abort", abort, { once: true });
    const requestId = crypto.randomUUID();
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "X-Request-ID": requestId,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
        credentials: "omit",
        cache: "no-store",
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) return this.failure("INVALID_RESPONSE", "Sunucu JSON yanıtı döndürmedi.", false, requestId);
      const text = await response.text();
      if (text.length > 1_000_000) return this.failure("INVALID_RESPONSE", "Sunucu yanıtı izin verilen boyutu aşıyor.", false, requestId);
      let parsed: ApiSuccess<T> | ApiFailure;
      try { parsed = JSON.parse(text) as ApiSuccess<T> | ApiFailure; } catch { return this.failure("INVALID_RESPONSE", "Sunucu yanıtı okunamadı.", false, requestId); }
      if (!response.ok || "error" in parsed) {
        const failure = parsed as ApiFailure;
        return this.failure(this.mapCode(failure.error?.code, response.status), failure.error?.message ?? "İstek başarısız oldu.", Boolean(failure.error?.retryable), failure.meta?.requestId ?? requestId);
      }
      const success = parsed as ApiSuccess<T>;
      return { ok: true, data: success.data, meta: { source: "api", requestId: success.meta.requestId, generatedAt: success.meta.generatedAt, demo: success.meta.demo } };
    } catch (error) {
      if (controller.signal.aborted) {
        const timeoutAbort = controller.signal.reason === "timeout";
        return this.failure(timeoutAbort ? "TIMEOUT" : "ABORTED", timeoutAbort ? "İstek zaman aşımına uğradı." : "İstek iptal edildi.", timeoutAbort, requestId);
      }
      return this.failure("NETWORK_ERROR", error instanceof Error ? error.message : "Ağ bağlantısı kurulamadı.", true, requestId);
    } finally {
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }

  private mapCode(code: string | undefined, status: number): DataError["code"] {
    if (code === "VALIDATION_ERROR") return "VALIDATION_ERROR";
    if (code === "NOT_FOUND" || status === 404) return "NOT_FOUND";
    if (code === "CONFLICT" || status === 409) return "CONFLICT";
    if (status === 401) return "UNAUTHORIZED";
    if (status === 403) return "FORBIDDEN";
    if (status === 503) return "UNAVAILABLE";
    return "INVALID_RESPONSE";
  }

  private failure<T>(code: DataError["code"], message: string, retryable: boolean, requestId: string): DataResult<T> {
    return { ok: false, error: { code, message, retryable, requestId }, meta: { source: "api", requestId, demo: true } };
  }
}
