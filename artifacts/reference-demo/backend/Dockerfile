# syntax=docker/dockerfile:1.7
FROM python:3.11.9-slim-bookworm AS builder
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_NO_CACHE_DIR=1
WORKDIR /build
COPY backend/pyproject.toml backend/README.md ./
COPY backend/src ./src
RUN python -m venv /venv && /venv/bin/pip install --upgrade pip && /venv/bin/pip install .

FROM python:3.11.9-slim-bookworm AS runtime
ENV PATH=/venv/bin:$PATH PYTHONUNBUFFERED=1
WORKDIR /app
RUN useradd --create-home --uid 10001 appuser && mkdir -p /app/.runtime && chown -R appuser:appuser /app
COPY --from=builder /venv /venv
COPY --chown=appuser:appuser shared ./shared
COPY --chown=appuser:appuser backend/pyproject.toml backend/README.md ./backend/
COPY --chown=appuser:appuser backend/src ./backend/src
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health/live', timeout=2)"
CMD ["uvicorn", "merinos_agent.api:app", "--app-dir", "backend/src", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
