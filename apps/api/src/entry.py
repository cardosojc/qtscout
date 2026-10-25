"""Cloudflare Python Worker entrypoint: serves the FastAPI app (`app.main`) and
runs the weekly backup (cron trigger -> `scheduled`, see app/backup.py).

Reached only through the web Worker's service binding (no public route). Heavy
imports happen here at module level so they land in the deploy-time memory
snapshot; importing them per request would blow the request CPU budget.
"""

import os

from workers import WorkerEntrypoint, asgi

import app.db  # noqa: F401  (snapshot: SQLAlchemy + models)
from app.backup import run_backup
from app.config import Settings
from app.main import app
from app.runtime import worker_env

# Settings fields that come from the Worker env (vars + secrets).
_ENV_KEYS = [name.upper() for name in Settings.model_fields]


def _load_env(env: object) -> None:
    for key in _ENV_KEYS:
        value = getattr(env, key, None)
        if isinstance(value, str):
            os.environ[key] = value


class Default(WorkerEntrypoint):
    async def fetch(self, request):  # type: ignore[no-untyped-def]
        _load_env(self.env)
        token = worker_env.set(self.env)
        try:
            return await asgi.fetch(app, request, self.env, self.ctx)
        finally:
            worker_env.reset(token)

    async def scheduled(self, controller, env, ctx):  # type: ignore[no-untyped-def]
        # Bindings come from self.env (the env argument can be None here).
        key = await run_backup(self.env)
        print(f"Backup written to R2: {key}")
