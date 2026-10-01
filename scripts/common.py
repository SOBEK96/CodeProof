"""Shared helpers for CodeProof deployment and live-proof scripts.

Run with a Python that has genlayer-py installed (pip install genlayer-py python-dotenv).
"""

import base64
import hashlib
import json
import os
import stat
import time
from pathlib import Path

from dotenv import dotenv_values
from eth_account import Account
from genlayer_py import create_account, create_client
from genlayer_py.chains import studio_devnet  # Studio Next serves chain 61997

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"
DEPLOYMENT = ROOT / "deployments" / "studio-next.json"
CONTRACT_PATH = ROOT / "contracts" / "code_proof.py"

RPC_URL = "https://studio-next.genlayer.com/api"
EXPLORER = "https://explorer-studio-next.genlayer.com"
CHAIN_ID = 61997
GEN = 10**18
FUND_AMOUNT = 10 * GEN
OK_EXEC = "FINISHED_WITH_RETURN"
OK_CONSENSUS = "MAJORITY_AGREE"


class ChainError(Exception):
    pass


# ----------------------------------------------------------------------- keys
def _write_env(values: dict) -> None:
    lines = [f"{k}={v}" for k, v in values.items()]
    ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    os.chmod(ENV_PATH, stat.S_IRUSR | stat.S_IWUSR)  # 600


def load_keys() -> dict:
    """Auto-derive/generate the FUNDER (deployer + steward) and DEVELOPER keys.

    Stored in `.env` (git-ignored, mode 600). Never printed, never committed.
    """
    values = dict(dotenv_values(ENV_PATH)) if ENV_PATH.exists() else {}
    changed = False
    for name in ("FUNDER_PRIVATE_KEY", "DEVELOPER_PRIVATE_KEY"):
        if not values.get(name):
            values[name] = Account.create().key.hex()
            if not values[name].startswith("0x"):
                values[name] = "0x" + values[name]
            changed = True
    if changed or (ENV_PATH.exists() and (ENV_PATH.stat().st_mode & 0o777) != 0o600):
        _write_env(values)
    return values


def accounts() -> dict:
    keys = load_keys()
    return {
        "funder": create_account(keys["FUNDER_PRIVATE_KEY"]),
        "developer": create_account(keys["DEVELOPER_PRIVATE_KEY"]),
    }


# --------------------------------------------------------------------- client
def retry(fn, attempts: int = 4, wait_s: float = 6.0):
    last = None
    for i in range(attempts):
        try:
            return fn()
        except ChainError:
            raise
        except Exception as exc:  # noqa: BLE001 - transient transport failures
            last = exc
            if i + 1 < attempts:
                time.sleep(wait_s * (i + 1))
    raise ChainError(f"transient RPC failure after {attempts} attempts: {last}")


def fees_from(estimate: dict) -> dict:
    fees = {
        "distribution": estimate["distribution"],
        "feeValue": estimate.get("feeValue") or estimate.get("fee_value") or 0,
    }
    if estimate.get("messageAllocations") is not None:
        fees["messageAllocations"] = estimate["messageAllocations"]
    return fees


def policy_fees(client) -> dict:
    """Studio Next fee distribution derived from the live fee policy (~0.1 GEN)."""
    from genlayer_py.contracts.actions import (
        _estimate_transaction_fees_with_policy,
        get_current_fee_policy,
    )

    est = _estimate_transaction_fees_with_policy(client, None, get_current_fee_policy(client))
    return fees_from(est)


def receipt_ok(receipt: dict, label: str) -> None:
    exec_name = receipt.get("txExecutionResultName") or receipt.get("tx_execution_result_name")
    consensus = receipt.get("result_name")
    if exec_name is not None and exec_name != OK_EXEC:
        raise ChainError(f"{label}: execution {exec_name}")
    if consensus is not None and consensus != OK_CONSENSUS:
        raise ChainError(f"{label}: consensus {consensus}")


class Node:
    """One account's connection to Studio Next."""

    def __init__(self, account, address: str | None = None):
        self.account = account
        self.client = create_client(chain=studio_devnet, endpoint=RPC_URL, account=account)
        self.address = address

    @property
    def me(self) -> str:
        return self.account.address

    def balance(self) -> int:
        def call():
            r = self.client.provider.make_request("eth_getBalance", [self.me, "latest"])
            return int(r.get("result", "0x0"), 16)

        return retry(call)

    def ensure_funded(self, target: int = FUND_AMOUNT) -> bool:
        cur = self.balance()
        if cur >= target:
            return False
        retry(lambda: self.client.fund_account(self.me, target - cur + 1))  # sim_fundAccount
        return True

    def read(self, method: str, args=None):
        return retry(lambda: self.client.read_contract(self.address, method, args=args or []))

    def write(self, method: str, args=None, value: int = 0, label: str = "") -> dict:
        """Submit through consensus (with Studio Next fee distribution) and wait for a decision."""
        label = label or method
        fees = policy_fees(self.client)
        tx_hash = self.client.write_contract(
            self.address, method, args=args or [], value=value, fees=fees
        )
        tx_hex = tx_hash.hex() if hasattr(tx_hash, "hex") else str(tx_hash)
        if not tx_hex.startswith("0x"):
            tx_hex = "0x" + tx_hex
        print(f"   tx {label} {tx_hex[:18]}... waiting for consensus")
        receipt = retry(
            lambda: self.client.wait_for_transaction_receipt(
                tx_hash, wait_until="decided", interval=4, retries=150
            ),
            attempts=3,
        )
        receipt_ok(receipt, label)
        return {"hash": tx_hex, "receipt": receipt}


# ------------------------------------------------------------------- helpers
def source_sha256() -> str:
    return hashlib.sha256(CONTRACT_PATH.read_bytes()).hexdigest()


def load_deployment() -> dict:
    if DEPLOYMENT.exists():
        return json.loads(DEPLOYMENT.read_text(encoding="utf-8"))
    return {}


def save_deployment(data: dict) -> None:
    DEPLOYMENT.parent.mkdir(parents=True, exist_ok=True)
    DEPLOYMENT.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def tx_url(tx_hash: str) -> str:
    return f"{EXPLORER}/tx/{tx_hash}"


def address_url(addr: str) -> str:
    return f"{EXPLORER}/address/{addr}"
