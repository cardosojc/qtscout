"""Leader role labels. Mirrors `@qtscout/types/leader-role` (LEADER_ROLES).

This is one of the runtime values shared with the web app today; after the
migration the FE keeps its own copy (packages/web-shared) and this is the BE's.
"""

LEADER_ROLES: tuple[str, ...] = (
    "Chefe de Agrupamento",
    "Chefe de Agrupamento Adjunto",
    "Secretário de Agrupamento",
    "Tesoureiro de Agrupamento",
    "Assistente de Agrupamento",
    "Chefe de Unidade",
    "Chefe de Unidade Adjunto",
    "Instrutor",
)


def is_leader_role(value: object) -> bool:
    return isinstance(value, str) and value in LEADER_ROLES


def highest_role(roles: list[str]) -> str | None:
    # "de Agrupamento" roles outrank section-level ones; LEADER_ROLES is preordered by seniority.
    if not roles:
        return None
    candidates = [r for r in roles if "de Agrupamento" in r] or roles
    for r in LEADER_ROLES:
        if r in candidates:
            return r
    return candidates[0]
