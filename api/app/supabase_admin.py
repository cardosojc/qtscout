"""Supabase service-role admin operations via the GoTrue admin REST API.

Replaces the Hono `createSupabaseAdmin()` (supabase-js). Used only by user
create (register) and delete.
"""

from typing import Any

import httpx

from app.config import get_settings

settings = get_settings()


def _headers() -> dict[str, str]:
    return {
        "apikey": settings.supabase_secret_key,
        "Authorization": f"Bearer {settings.supabase_secret_key}",
        "Content-Type": "application/json",
    }


def _error_message(resp: httpx.Response, fallback: str) -> str:
    try:
        data = resp.json()
    except ValueError:
        return fallback
    if isinstance(data, dict):
        for key in ("msg", "message", "error_description", "error"):
            value = data.get(key)
            if isinstance(value, str):
                return value
    return fallback


async def create_user(
    *, email: str, password: str, name: str, username: str
) -> tuple[dict[str, Any] | None, str | None]:
    """Create a Supabase auth user (email pre-confirmed). Returns (user, error)."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{settings.supabase_url}/auth/v1/admin/users",
            headers=_headers(),
            json={
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"name": name, "username": username},
            },
        )
    if resp.status_code in (200, 201):
        user: dict[str, Any] = resp.json()
        return user, None
    return None, _error_message(resp, "Erro ao criar utilizador")


async def delete_user(user_id: str) -> str | None:
    """Delete a Supabase auth user. Returns an error message or None on success."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.delete(
            f"{settings.supabase_url}/auth/v1/admin/users/{user_id}",
            headers=_headers(),
        )
    if resp.status_code in (200, 204):
        return None
    return _error_message(resp, "Erro ao eliminar utilizador")
