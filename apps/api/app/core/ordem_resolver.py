"""Resolve scout/profile refs in OrdemItem.data and build display labels.
Port of `@qtscout/core/ordem-resolver`.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import OrdemItem, Profile, Scout


@dataclass
class ResolvedRefs:
    scouts: dict[str, dict[str, Any]]
    profiles: dict[str, dict[str, Any]]


def extract_ids(items: Sequence[OrdemItem]) -> tuple[set[str], set[str]]:
    scout_ids: set[str] = set()
    profile_ids: set[str] = set()
    for item in items:
        d = item.data or {}
        if isinstance(d.get("scoutId"), str):
            scout_ids.add(d["scoutId"])
        if isinstance(d.get("profileId"), str):
            profile_ids.add(d["profileId"])
        if isinstance(d.get("scoutIds"), list):
            scout_ids.update(i for i in d["scoutIds"] if isinstance(i, str))
        if isinstance(d.get("kind"), str) and isinstance(d.get("refId"), str):
            if d["kind"] == "scout":
                scout_ids.add(d["refId"])
            elif d["kind"] == "profile":
                profile_ids.add(d["refId"])
    return scout_ids, profile_ids


async def resolve_refs(session: AsyncSession, items: Sequence[OrdemItem]) -> ResolvedRefs:
    scout_ids, profile_ids = extract_ids(items)
    scouts: dict[str, dict[str, Any]] = {}
    profiles: dict[str, dict[str, Any]] = {}
    if scout_ids:
        rows = (
            await session.execute(
                select(Scout.id, Scout.first_name, Scout.last_name, Scout.numero_associado).where(
                    Scout.id.in_(scout_ids)
                )
            )
        ).all()
        scouts = {
            r.id: {
                "id": r.id,
                "firstName": r.first_name,
                "lastName": r.last_name,
                "numeroAssociado": r.numero_associado,
            }
            for r in rows
        }
    if profile_ids:
        prows = (
            await session.execute(
                select(Profile.id, Profile.name, Profile.email).where(Profile.id.in_(profile_ids))
            )
        ).all()
        profiles = {r.id: {"id": r.id, "name": r.name, "email": r.email} for r in prows}
    return ResolvedRefs(scouts, profiles)


def scout_label(s: dict[str, Any] | None) -> str:
    if not s:
        return "—"
    name = f"{s['firstName']} {s['lastName']}".strip()
    return f"{name} ({s['numeroAssociado']})" if s.get("numeroAssociado") else name


def profile_label(p: dict[str, Any] | None) -> str:
    if not p:
        return "—"
    return str(p["name"] or p["email"])


def build_display(data: dict[str, Any] | None, refs: ResolvedRefs) -> dict[str, Any]:
    d = data or {}
    display: dict[str, Any] = {}
    if isinstance(d.get("scoutId"), str):
        display["scout"] = scout_label(refs.scouts.get(d["scoutId"]))
    if isinstance(d.get("profileId"), str):
        display["profile"] = profile_label(refs.profiles.get(d["profileId"]))
    if isinstance(d.get("scoutIds"), list):
        display["scouts"] = [
            scout_label(refs.scouts.get(i)) for i in d["scoutIds"] if isinstance(i, str)
        ]
    if isinstance(d.get("kind"), str) and isinstance(d.get("refId"), str):
        if d["kind"] == "scout":
            display["ref"] = scout_label(refs.scouts.get(d["refId"]))
        elif d["kind"] == "profile":
            display["ref"] = profile_label(refs.profiles.get(d["refId"]))
        else:
            display["ref"] = "—"
    return display
