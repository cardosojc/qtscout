"""Create a fresh local SQLite database with the D1 schema (+ optional seed).

    uv run python scripts/local_db.py local.db --seed you@example.pt

Applies d1/migrations/*.sql in order (the same files D1 gets), then, with
--seed, adds an ADMIN profile for that email and the CA/RD meeting types. Used
for local development (`DATABASE_URL=sqlite:///./local.db`) and by the
Playwright E2E run, which gets a throwaway database instead of real data.
"""

import argparse
import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path

MIGRATIONS = Path(__file__).resolve().parents[1] / "d1" / "migrations"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    parser.add_argument("--seed", metavar="EMAIL", help="create an ADMIN profile for EMAIL")
    parser.add_argument("--name", help="profile name (default: the email's local part)")
    parser.add_argument("--username", help="profile username (default: the email's local part)")
    args = parser.parse_args()

    args.path.unlink(missing_ok=True)
    conn = sqlite3.connect(args.path)
    for migration in sorted(MIGRATIONS.glob("*.sql")):
        conn.executescript(migration.read_text())

    if args.seed:
        now = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S.%f")
        email = args.seed.strip().lower()
        local_part = email.split("@")[0]
        username = args.username or local_part
        name = args.name or local_part
        conn.execute(
            'INSERT INTO profiles (id, username, email, name, role, roles, "createdAt", '
            '"updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            (str(uuid.uuid4()), username, email, name, "ADMIN", "[]", now, now),
        )
        for code, name, description in (
            ("CA", "Conselho de Agrupamento", "Reunião do conselho"),
            ("RD", "Reunião de Direção", "Reunião da direção"),
        ):
            conn.execute(
                'INSERT INTO meeting_types (id, code, name, description, "createdAt", '
                '"updatedAt") VALUES (?, ?, ?, ?, ?, ?)',
                (uuid.uuid4().hex, code, name, description, now, now),
            )
    conn.commit()
    conn.close()
    print(f"Created {args.path}" + (f" (seeded {args.seed})" if args.seed else ""))


if __name__ == "__main__":
    main()
