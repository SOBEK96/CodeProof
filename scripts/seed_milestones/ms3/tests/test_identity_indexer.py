import pytest

from src.identity_indexer import IdentityIndexer, IndexError_


def test_register_and_resolve():
    idx = IdentityIndexer()
    idx.register("did:example:123", "alice")
    assert idx.resolve("did:example:123") == "alice"


def test_rejects_malformed_did():
    with pytest.raises(IndexError_):
        IdentityIndexer().register("not-a-did", "alice")


def test_duplicate_registration_rejected():
    idx = IdentityIndexer()
    idx.register("did:example:1", "alice")
    with pytest.raises(IndexError_):
        idx.register("did:example:1", "bob")


def test_rotation_requires_current_controller():
    idx = IdentityIndexer()
    idx.register("did:example:1", "alice")
    with pytest.raises(IndexError_):
        idx.rotate("did:example:1", "mallory", "mallory")
    idx.rotate("did:example:1", "alice", "bob")
    assert idx.resolve("did:example:1") == "bob"


def test_history_is_ordered():
    idx = IdentityIndexer()
    idx.register("did:example:1", "alice")
    idx.rotate("did:example:1", "alice", "bob")
    assert [h[0] for h in idx.history("did:example:1")] == ["register", "rotate"]
