"""Cloudflare Access group membership via the Cloudflare API.

Replaces the Supabase GoTrue admin calls. Who may sign in is the Access policy's
group (`ACCESS_GROUP_ID`, `qtscout-users`): an email include-list. Creating a
user adds their email to it; deleting removes it. The profile row stays the
source of authorization (role); the group only controls who reaches the app.

No-op in `AUTH_MODE=dev` (there is no Access in front of localhost).
"""

from typing import Any

import httpx

from app.config import get_settings

settings = get_settings()

_API = "https://api.cloudflare.com/client/v4"


def _group_url() -> str:
    return f"{_API}/accounts/{settings.cf_account_id}/access/groups/{settings.access_group_id}"


def _headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.cf_api_token}", "Content-Type": "application/json"}


def _error_message(resp: httpx.Response, fallback: str) -> str:
    try:
        errors = resp.json().get("errors") or []
    except ValueError:
        return fallback
    if errors and isinstance(errors[0], dict) and isinstance(errors[0].get("message"), str):
        return f"{fallback}: {errors[0]['message']}"
    return fallback


def _rule_email(rule: dict[str, Any]) -> str | None:
    email = rule.get("email", {}).get("email") if isinstance(rule.get("email"), dict) else None
    return email.lower() if isinstance(email, str) else None


async def _set_membership(email: str, *, present: bool) -> str | None:
    """Ensure `email` is (or is not) in the group's include list. Returns an error or None."""
    if settings.auth_mode == "dev":
        return None
    if not (settings.cf_api_token and settings.cf_account_id and settings.access_group_id):
        return "Gestão de acessos não configurada (CF_API_TOKEN / ACCESS_GROUP_ID)"
    email = email.strip().lower()
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(_group_url(), headers=_headers())
        if resp.status_code != 200:
            return _error_message(resp, "Erro ao ler o grupo de acesso")
        group: dict[str, Any] = resp.json()["result"]
        include: list[dict[str, Any]] = group.get("include") or []
        has = any(_rule_email(r) == email for r in include)
        if has == present:
            return None
        if present:
            include = [*include, {"email": {"email": email}}]
        else:
            include = [r for r in include if _rule_email(r) != email]
        if not include:
            # An empty include list would make the group match nobody — and an
            # Access group must have at least one include rule.
            return "Não é possível remover o último utilizador com acesso"
        resp = await client.put(
            _group_url(),
            headers=_headers(),
            json={
                "name": group["name"],
                "include": include,
                "exclude": group.get("exclude") or [],
                "require": group.get("require") or [],
            },
        )
    if resp.status_code != 200:
        return _error_message(resp, "Erro ao atualizar o grupo de acesso")
    return None


async def grant_access(email: str) -> str | None:
    return await _set_membership(email, present=True)


async def revoke_access(email: str) -> str | None:
    return await _set_membership(email, present=False)
