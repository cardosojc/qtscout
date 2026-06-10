# QTScout FastAPI service. Deployed as a container (Railway/Render).
# Includes Chromium for Playwright-based PDF rendering.
FROM python:3.13-slim AS base

# uv for fast, reproducible installs.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install dependencies first (cached layer) from the lockfile.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Chromium + system libs for Playwright. Run after deps so the playwright CLI exists.
RUN uv run playwright install --with-deps chromium

# Application code.
COPY . .
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH" \
    PORT=8080

EXPOSE 8080

# Gunicorn with Uvicorn workers; binds to the platform-provided $PORT.
CMD ["sh", "-c", "gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:${PORT} --timeout 120"]
