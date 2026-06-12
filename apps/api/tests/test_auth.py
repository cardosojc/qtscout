from app.auth import bearer_from_header


def test_bearer_from_header() -> None:
    assert bearer_from_header("Bearer abc.def.ghi") == "abc.def.ghi"
    assert bearer_from_header("bearer lower") == "lower"  # case-insensitive
    assert bearer_from_header("  Bearer   spaced  ") == "spaced"
    assert bearer_from_header(None) is None
    assert bearer_from_header("") is None
    assert bearer_from_header("Basic foo") is None
    assert bearer_from_header("Bearer") is None
