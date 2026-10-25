"""CNE especialidades catalog + the Mérito/Especialista insígnias.

Single source of truth for the especialidades list is the JSON sibling
(`especialidades.json`, scraped from https://especialidades.escutismo.pt). The
web's typed copy (`packages/types/src/especialidades.generated.ts`) is generated
from it by `npm run sync:especialidades` (CI guards drift via `:check`).

`Mérito` and `Especialista` are higher-level insígnias awarded on top of
especialidades; they're selectable in the same item alongside the catalog.
"""

import json
from pathlib import Path

_JSON = Path(__file__).with_name("especialidades.json")
ESPECIALIDADES: tuple[str, ...] = tuple(json.loads(_JSON.read_text(encoding="utf-8")))

# Distinct insígnias, kept separate from the site catalog. Mirrored in
# packages/types/src/ordem-item.ts (MERITO_ESPECIALISTA) — keep both in sync.
MERITO_ESPECIALISTA: tuple[str, ...] = ("Mérito", "Especialista")

_ALL_ESPECIALIDADES = frozenset(ESPECIALIDADES) | frozenset(MERITO_ESPECIALISTA)


def is_especialidade(value: object) -> bool:
    return isinstance(value, str) and value in _ALL_ESPECIALIDADES
