"""A lock-and-release token bridge ledger with a reentrancy guard.

Deposits lock tokens on the source side and emit a transfer ticket; withdrawals
release tokens against a ticket exactly once.
"""

import functools


class BridgeError(Exception):
    pass


def nonreentrant(fn):
    """Reject a call made while another guarded call is still running."""

    @functools.wraps(fn)
    def wrapper(self, *args, **kwargs):
        if self._entered:
            raise BridgeError("reentrant call")
        self._entered = True
        try:
            return fn(self, *args, **kwargs)
        finally:
            self._entered = False

    return wrapper


class TokenBridge:
    def __init__(self, on_release=None):
        self.locked = {}
        self.tickets = {}
        self.redeemed = set()
        self._next_ticket = 1
        self._entered = False
        self._on_release = on_release  # external hook, called on withdraw

    @nonreentrant
    def deposit(self, account, amount):
        if amount <= 0:
            raise BridgeError("amount must be positive")
        self.locked[account] = self.locked.get(account, 0) + amount
        ticket = self._next_ticket
        self._next_ticket += 1
        self.tickets[ticket] = (account, amount)
        return ticket

    @nonreentrant
    def withdraw(self, ticket):
        if ticket not in self.tickets:
            raise BridgeError("unknown ticket")
        if ticket in self.redeemed:
            raise BridgeError("ticket already redeemed")
        account, amount = self.tickets[ticket]
        # effects before interactions: mark redeemed and debit first
        self.redeemed.add(ticket)
        self.locked[account] -= amount
        if self._on_release is not None:
            self._on_release(account, amount)
        return amount

    def total_locked(self):
        return sum(self.locked.values())
