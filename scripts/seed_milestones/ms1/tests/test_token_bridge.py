import pytest

from src.token_bridge import BridgeError, TokenBridge


def test_deposit_locks_and_issues_ticket():
    b = TokenBridge()
    t = b.deposit("alice", 100)
    assert b.total_locked() == 100
    assert t == 1


def test_withdraw_releases_once():
    b = TokenBridge()
    t = b.deposit("alice", 100)
    assert b.withdraw(t) == 100
    assert b.total_locked() == 0
    with pytest.raises(BridgeError):
        b.withdraw(t)


def test_rejects_non_positive_deposit():
    with pytest.raises(BridgeError):
        TokenBridge().deposit("alice", 0)


def test_unknown_ticket():
    with pytest.raises(BridgeError):
        TokenBridge().withdraw(99)


def test_reentrant_withdraw_is_blocked():
    holder = {}

    def hook(account, amount):
        holder["bridge"].withdraw(holder["ticket"])  # try to drain twice

    b = TokenBridge(on_release=hook)
    holder["bridge"] = b
    holder["ticket"] = b.deposit("mallory", 50)
    with pytest.raises(BridgeError):
        b.withdraw(holder["ticket"])
    assert b.total_locked() == 0


def test_multiple_accounts_tracked_separately():
    b = TokenBridge()
    b.deposit("alice", 10)
    b.deposit("bob", 20)
    assert b.locked == {"alice": 10, "bob": 20}
