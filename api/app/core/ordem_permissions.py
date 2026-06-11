"""OS item permissions. Port of `@qtscout/core/ordem-permissions`."""

from dataclasses import dataclass

from app.core.ordem_categories import CATEGORY_MAP, CategorySpec, is_ordem_category_key

GROUP_ROLES = (
    "Chefe de Agrupamento",
    "Chefe de Agrupamento Adjunto",
    "Secretário de Agrupamento",
    "Tesoureiro de Agrupamento",
    "Assistente de Agrupamento",
)

SECTION_ROLES = (
    "Chefe de Unidade",
    "Chefe de Unidade Adjunto",
    "Instrutor",
)


@dataclass
class ProfileForAuth:
    role: str  # ADMIN | LEADER | MEMBER
    roles: list[str]
    section: str | None


def has_group_role(profile: ProfileForAuth) -> bool:
    return any(r in GROUP_ROLES for r in profile.roles)


def has_section_role(profile: ProfileForAuth) -> bool:
    return any(r in SECTION_ROLES for r in profile.roles)


def can_manage_item(profile: ProfileForAuth, category: CategorySpec, section: str | None) -> bool:
    if profile.role == "ADMIN":
        return True

    if category.scope == "GROUP":
        return has_group_role(profile)

    if category.scope == "BOTH":
        if section is None:
            return has_group_role(profile)
        if has_section_role(profile) and profile.section == section:
            return True
        return has_group_role(profile)

    # SECTION-scoped
    if not section:
        return False
    if not has_section_role(profile):
        return False
    return profile.section == section


def allowed_categories_for(profile: ProfileForAuth) -> list[CategorySpec]:
    if profile.role == "ADMIN":
        return list(CATEGORY_MAP.values())
    group = has_group_role(profile)
    section = has_section_role(profile) and profile.section is not None
    result = []
    for c in CATEGORY_MAP.values():
        if c.scope == "GROUP":
            keep = group
        elif c.scope == "SECTION":
            keep = section
        else:
            keep = group or section
        if keep:
            result.append(c)
    return result


def resolve_category(key: str) -> CategorySpec | None:
    return CATEGORY_MAP[key] if is_ordem_category_key(key) else None
