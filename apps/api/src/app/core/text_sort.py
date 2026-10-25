"""Portuguese-friendly sort key for names.

SQLite (D1) compares text byte by byte, so "Álvaro" sorts after "Zé" and
lower case after upper case. Sorting in Python with this key ignores accents
and case the way the Postgres collation did.
"""

import unicodedata


def name_key(value: str | None) -> str:
    decomposed = unicodedata.normalize("NFKD", value or "")
    return "".join(c for c in decomposed if not unicodedata.combining(c)).casefold()
