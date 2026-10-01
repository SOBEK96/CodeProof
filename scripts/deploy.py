#!/usr/bin/env python3
"""Deploy contracts/code_proof.py to GenLayer Studio Next (chain 61997).

1. derives/generates the local keys in .env (git-ignored, mode 600)
2. funds the deployer with 10 GEN through the sim_fundAccount RPC
3. deploys the contract with the Studio Next fee distribution (~0.1 GEN)
4. records address + source/bytecode SHA-256 in deployments/studio-next.json
"""

import datetime
import hashlib
import sys

from common import (CHAIN_ID, CONTRACT_PATH, EXPLORER, RPC_URL, ChainError, Node, accounts,
                    address_url, load_deployment, policy_fees, receipt_ok, retry,
                    save_deployment, source_sha256, tx_url, FUND_AMOUNT, GEN)


def contract_address_from(receipt: dict) -> str | None:
    decoded = receipt.get("txDataDecoded") or receipt.get("tx_data_decoded") or {}
    for src in (decoded, receipt.get("data") or {}, receipt):
        for key in ("contractAddress", "contract_address"):
            if isinstance(src, dict) and src.get(key):
                return src[key]
    return None


def main() -> int:
    acct = accounts()["funder"]
    node = Node(acct)
    print(f"network   Studio Next  chain {CHAIN_ID}  {RPC_URL}")
    print(f"deployer  {acct.address}")
    if node.ensure_funded(FUND_AMOUNT):
        print(f"funded    {FUND_AMOUNT // GEN} GEN via sim_fundAccount")
    print(f"balance   {node.balance() / GEN:.4f} GEN")

    code = CONTRACT_PATH.read_bytes()
    fees = policy_fees(node.client)
    print(f"fee       {fees['feeValue'] / GEN:.4f} GEN distribution attached")
    tx_hash = node.client.deploy_contract(code=code, args=[], fees=fees)
    tx_hex = tx_hash.hex() if hasattr(tx_hash, "hex") else str(tx_hash)
    tx_hex = tx_hex if tx_hex.startswith("0x") else "0x" + tx_hex
    print(f"deploy tx {tx_hex}  waiting for consensus...")
    receipt = retry(
        lambda: node.client.wait_for_transaction_receipt(
            tx_hash, wait_until="decided", interval=4, retries=200),
        attempts=3,
    )
    receipt_ok(receipt, "deploy")
    address = contract_address_from(receipt)
    if not address:
        raise ChainError(f"no contract address in receipt: {receipt}")
    print(f"deployed  {address}")

    dep = load_deployment()
    dep.update({
        "network": "studio-next",
        "chain_id": CHAIN_ID,
        "rpc_url": RPC_URL,
        "contract_address": address,
        "explorer_url": address_url(address),
        "deploy_tx": tx_hex,
        "deploy_tx_url": tx_url(tx_hex),
        "source": "contracts/code_proof.py",
        "runner": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng",
        "bytecode_sha256": hashlib.sha256(code).hexdigest(),
        "source_sha256": source_sha256(),
        "deployer": acct.address,
        "deployed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    })
    dep.pop("grants", None)  # a fresh deployment invalidates earlier seeds
    save_deployment(dep)
    print("recorded  deployments/studio-next.json")
    print(f"explorer  {EXPLORER}/address/{address}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
