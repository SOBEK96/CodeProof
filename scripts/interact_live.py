#!/usr/bin/env python3
"""Seed three real milestones on the deployed CodeProof contract and record live proofs.

  Grant #1  EVM Token Bridge Implementation   -> evaluated, expected APPROVED
  Grant #2  Flash Loan Vault                  -> evaluated, expected REJECTED (bond forfeited)
  Grant #3  Decentralized Identity Indexer    -> left DELIVERED for a steward to evaluate

The deliverables are REAL public GitHub commits (pinned by SHA). Validators fetch them
live, so the scores on-chain are whatever the validator committee actually agreed on.
This script records the true outcome, it never forces one.

Idempotent: re-running skips steps already recorded in deployments/studio-next.json.
"""

import json
import re
import sys

from common import (ROOT, GEN, Node, accounts, address_url, load_deployment, save_deployment,
                    tx_url)

OZ = "https://github.com/OpenZeppelin/openzeppelin-contracts"
HELLO = "https://github.com/octocat/Hello-World"

ESCROW = 1 * GEN
BOND = GEN // 20

SEEDS = [
    {
        "title": "EVM Token Bridge Implementation",
        "repo_url": OZ,
        "commit_sha": "4e35b0b4078bc0aa532c740e58f30dddd6b17574",
        "evaluate": True,
        "note": "Real commit with a green CI run (12 passing checks) that adds a hook to the "
                "reentrancy-guard contracts.",
        "spec": {
            "required_files": ["contracts/utils/ReentrancyGuard.sol",
                               "contracts/utils/ReentrancyGuardTransient.sol"],
            "required_methods": ["_reentrancyGuardStorageSlot"],
            "min_coverage": 0,
            "forbidden_patterns": ["tx.origin", "delegatecall"],
            "security_invariants": ["reentrancy protection must be preserved",
                                    "no behavioural regression of the guard"],
            "architecture": "Guard contracts expose an overridable storage slot; "
                            "the bridge must reuse them rather than re-implement locking.",
        },
    },
    {
        "title": "Flash Loan Vault",
        "repo_url": HELLO,
        "commit_sha": "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d",
        "evaluate": True,
        "note": "Real but unrelated commit (a README edit): no vault, no reentrancy guard, "
                "no tests. The spec is not met.",
        "spec": {
            "required_files": ["src/FlashLoanVault.sol", "test/FlashLoanVault.t.sol"],
            "required_methods": ["flashLoan", "nonReentrant", "maxFlashLoan"],
            "min_coverage": 90,
            "forbidden_patterns": ["tx.origin"],
            "security_invariants": ["reentrancy guard on every state-changing entry point",
                                    "loan repaid with fee inside the same transaction"],
            "architecture": "ERC-3156 flash lender vault with a reentrancy guard.",
        },
    },
    {
        "title": "Decentralized Identity Indexer",
        "repo_url": OZ,
        "commit_sha": "0134b0095654419e51b8818b49049385cba96d0a",
        "evaluate": False,
        "note": "Real commit (adds a nonReentrantView modifier plus tests). Left DELIVERED "
                "so a steward can trigger the evaluation interactively.",
        "spec": {
            "required_files": ["contracts/utils/ReentrancyGuard.sol",
                               "test/utils/ReentrancyGuard.test.js"],
            "required_methods": ["nonReentrantView"],
            "min_coverage": 0,
            "forbidden_patterns": ["tx.origin", "delegatecall"],
            "security_invariants": ["view functions must be protected against read-only reentrancy"],
            "architecture": "Identity indexer read paths must not be callable mid-update.",
        },
    },
]


def patch_readme(dep: dict) -> None:
    readme = ROOT / "README.md"
    if not readme.exists():
        return
    text = readme.read_text(encoding="utf-8")
    rows = ["| Grant | Status | Score | Evaluation tx |", "|---|---|---|---|"]
    for g in dep.get("grants", []):
        tx = g.get("evaluate_tx")
        link = f"[`{tx[:14]}...`]({tx_url(tx)})" if tx else "pending (steward)"
        rows.append(f"| #{g['grant_id']} {g['title']} | {g['final_status']} | "
                    f"{g['quality_score']}/100 | {link} |")
    block = (
        "<!-- LIVE-PROOFS:START -->\n"
        f"Contract: [`{dep['contract_address']}`]({dep['explorer_url']})  \n"
        f"Deploy tx: [`{dep['deploy_tx'][:14]}...`]({dep['deploy_tx_url']})\n\n"
        + "\n".join(rows) + "\n<!-- LIVE-PROOFS:END -->"
    )
    new = re.sub(r"<!-- LIVE-PROOFS:START -->.*?<!-- LIVE-PROOFS:END -->", block, text,
                 flags=re.S)
    readme.write_text(new, encoding="utf-8")


def main() -> int:
    dep = load_deployment()
    if not dep.get("contract_address"):
        print("run scripts/deploy.py first")
        return 1
    accts = accounts()
    funder = Node(accts["funder"], dep["contract_address"])
    dev = Node(accts["developer"], dep["contract_address"])
    for n, who in ((funder, "funder/steward"), (dev, "developer")):
        if n.ensure_funded():
            print(f"funded {who} {n.me} with 10 GEN")
    print(f"funder    {funder.me}\ndeveloper {dev.me}")

    recorded = {g["title"]: g for g in dep.get("grants", [])}
    for seed in SEEDS:
        rec = recorded.get(seed["title"], {"title": seed["title"]})
        print(f"\n== {seed['title']}")

        if "grant_id" not in rec:
            before = int(funder.read("get_protocol_metrics")["total_grants"])
            tx = funder.write(
                "create_grant",
                [dev.me, seed["title"], 85, json.dumps(seed["spec"])],
                value=ESCROW, label="create_grant")
            rec["grant_id"] = before + 1
            rec["create_tx"] = tx["hash"]
            rec.update(repo_url=seed["repo_url"], commit_sha=seed["commit_sha"], note=seed["note"])
            print(f"   grant #{rec['grant_id']} created, {ESCROW / GEN} GEN locked")
        gid = rec["grant_id"]

        if "submit_tx" not in rec:
            tx = dev.write("submit_deliverable", [gid, seed["repo_url"], seed["commit_sha"]],
                           value=BOND, label="submit_deliverable")
            rec["submit_tx"] = tx["hash"]
            print("   deliverable submitted, 0.05 GEN bond staked")

        if seed["evaluate"] and "evaluate_tx" not in rec:
            tx = funder.write("evaluate_milestone_consensus", [gid],
                              label="evaluate_milestone_consensus")
            rec["evaluate_tx"] = tx["hash"]

        g = funder.read("get_grant", [gid])
        rec["final_status"] = g["status"]
        rec["quality_score"] = g["quality_score"]
        rec["audit_report"] = g["audit_report"]
        print(f"   status {g['status']}  score {g['quality_score']}/100")
        print(f"   {g['audit_report']}")
        recorded[seed["title"]] = rec
        dep["grants"] = list(recorded.values())
        save_deployment(dep)

    # Pull-payment proof: the approved developer withdraws.
    for rec in dep["grants"]:
        if rec["final_status"] == "APPROVED" and "claim_tx" not in rec:
            tx = dev.write("claim_payout", [rec["grant_id"]], label="claim_payout")
            rec["claim_tx"] = tx["hash"]
            print(f"\ndeveloper claimed payout for grant #{rec['grant_id']}")
    metrics = funder.read("get_protocol_metrics")
    dep["metrics"] = {k: (v if isinstance(v, (int, bool)) else str(v)) for k, v in metrics.items()}
    save_deployment(dep)
    patch_readme(dep)
    print("\nprotocol metrics:", json.dumps(dep["metrics"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
