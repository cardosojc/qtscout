"""Primary-key generators matching Prisma's client-side defaults.

Profile uses uuid (`@default(uuid())`); every other table uses cuid
(`@default(cuid())`). These run app-side, so the columns have no DB default.

`cuid_id` implements cuid v1 (same 25-char shape as Prisma's): "c" + timestamp
+ counter + fingerprint + random, all base36. It is inline because the `cuid`
package has no wheel the Worker can install. Randomness comes from `secrets` at
call time — never from state captured in the Worker's deploy-time snapshot,
which every isolate starts from.
"""

import secrets
import time
from uuid import uuid4

_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"
_BLOCK = 4
_DISCRETE = 36**_BLOCK

_counter = -1
_fingerprint: str | None = None


def _base36(number: int) -> str:
    out = ""
    while number:
        number, i = divmod(number, 36)
        out = _ALPHABET[i] + out
    return out or "0"


def _pad(value: str, size: int) -> str:
    return value.rjust(size, "0")[-size:]


def _random_block() -> str:
    return _pad(_base36(secrets.randbelow(_DISCRETE)), _BLOCK)


def cuid_id() -> str:
    global _counter, _fingerprint
    if _fingerprint is None:
        _fingerprint = _random_block()  # per isolate/process
    _counter = (_counter + 1) % _DISCRETE
    return (
        "c"
        + _pad(_base36(int(time.time() * 1000)), 8)
        + _pad(_base36(_counter), _BLOCK)
        + _fingerprint
        + _random_block()
        + _random_block()
    )


def uuid_id() -> str:
    return str(uuid4())
