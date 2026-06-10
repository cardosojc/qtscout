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
