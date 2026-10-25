"""One-off: copy the Supabase Postgres data into D1 (the switch-over).

    PG_URL=postgresql://... uv run --with 'psycopg[binary]' \\
        python scripts/pg_to_d1.py /path/outside/the/repo/data.sql
    npx wrangler d1 execute qtscout --remote --file /path/outside/the/repo/data.sql

Reads every table the models define (only the columns they define) and writes
INSERTs in foreign-key order, in the formats the app stores (naive-UTC
timestamps as text, JSON as text, booleans as 0/1), then builds the FTS5 search
index for meetings. The output holds personal data: write it outside the repo
and delete it after the import.
"""

import json
import os
import sys
from datetime import UTC, datetime
from enum import Enum
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from app.core.meeting_search import _strings, html_to_text  # noqa: E402
from app.models import Base  # noqa: E402


def literal(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, int | float):
        return repr(value)
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            value = value.astimezone(UTC).replace(tzinfo=None)
        value = value.strftime("%Y-%m-%d %H:%M:%S.%f")
    elif isinstance(value, Enum):
        value = value.value
    elif isinstance(value, dict | list):
        value = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return "'" + str(value).replace("'", "''") + "'"


def main() -> None:
    import psycopg

    out_path = Path(sys.argv[1])
    statements: list[str] = []
    with psycopg.connect(os.environ["PG_URL"]) as conn:
        for table in Base.metadata.sorted_tables:
            cols = [c.name for c in table.columns]
            quoted = ", ".join(f'"{c}"' for c in cols)
            rows = conn.execute(f"SELECT {quoted} FROM {table.name}").fetchall()  # noqa: S608
            for row in rows:
                values = ", ".join(literal(v) for v in row)
                statements.append(f"INSERT INTO {table.name} ({quoted}) VALUES ({values});")
            print(f"{table.name}: {len(rows)}", file=sys.stderr)

        meetings = conn.execute(
            'SELECT id, identifier, location, content, agenda, "actionItems" FROM meetings'
        ).fetchall()
        for mid, identifier, location, content, agenda, action_items in meetings:
            extra = " ".join(s for s in _strings([agenda, action_items]) if s)
            values = ", ".join(
                literal(v) for v in (mid, identifier, location or "", html_to_text(content), extra)
            )
            statements.append(
                "INSERT INTO meeting_search (meeting_id, identifier, location, body, extra) "
                f"VALUES ({values});"
            )
        print(f"meeting_search: {len(meetings)}", file=sys.stderr)

    out_path.write_text("\n".join(statements) + "\n", encoding="utf-8")
    print(f"Wrote {len(statements)} statements to {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
