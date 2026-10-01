"""Seed three milestones on the deployed CodeProof contract and record live proofs.

Two phases, because a commit must post-date its grant (the oracle rejects historical
commits and commits that are not the registered developer's):

  python interact_live.py create    create 3 funded grants bound to the developer handle
  python seed_repo.py               author fresh commits in the developer's own repo (CI runs)
  python interact_live.py deliver   submit the commits, evaluate #1 and #2, claim #1

  Grant #1  EVM Token Bridge Implementation   solid code + tests          expected APPROVED
  Grant #2  Flash Loan Vault                  no guard, no tests, TODO     expected REJECTED
  Grant #3  Decentralized Identity Indexer    valid commit                 left DELIVERED

The outcomes are whatever the validator committee agrees on; they are recorded, never forced.
Idempotent: re-running skips steps already recorded in deployments/studio-next.json.
"""

import json
import re
import sys

from common import (ROOT, GEN, Node, accounts, address_url, load_deployment, save_deployment,
                    tx_url)

HANDLE = "Handik4"  # GitHub account that owns the developer's repository
ESCROW = 1 * GEN
BOND = GEN // 20
THRESHOLD = 85

SEEDS = [
    {
        "title": "EVM Token Bridge Implementation",
        "evaluate": True,
        "spec": {
            "required_files": ["src/token_bridge.py", "tests/test_token_bridge.py"],
            "required_methods": ["deposit", "withdraw", "nonreentrant"],
            "min_coverage": 0,
            "forbidden_patterns": ["eval(", "exec(", "pickle"],
            "security_invariants": ["withdrawals are exactly-once per ticket",
                                    "no reentrancy through the release hook"],
            "architecture": "Lock-and-release ledger; state is updated before any external call.",
        },
    },
    {
        "title": "Flash Loan Vault",
        "evaluate": True,
        "spec": {
            "required_files": ["src/flash_vault.py", "tests/test_flash_vault.py"],
            "required_methods": ["flash_loan", "max_flash_loan", "nonreentrant", "repay"],
            "min_coverage": 0,
            "forbidden_patterns": ["eval(", "exec("],
            "security_invariants": ["reentrancy guard on every state-changing entry point",
                                    "loan plus fee repaid inside the same call"],
            "architecture": "ERC-3156 style flash lender with a reentrancy guard and fee accounting.",
        },
    },
    {
        "title": "Decentralized Identity Indexer",
        "evaluate": False,
        "spec": {
            "required_files": ["src/identity_indexer.py", "tests/test_identity_indexer.py"],
            "required_methods": ["register", "resolve", "rotate"],
            "min_coverage": 0,
            "forbidden_patterns": ["eval(", "exec("],
            "security_invariants": ["only the current controller may rotate a DID"],
            "architecture": "Append-only registry with an ordered per-DID history.",
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
        rows.append(f"| #{g['grant_id']} {g['title']} | {g.get('final_status', 'OPEN')} | "
                    f"{g.get('quality_score', 0)}/100 | {link} |")
    block = (
        "<!-- LIVE-PROOFS:START -->\n"
        f"Contract: [`{dep['contract_address']}`]({dep['explorer_url']})  \n"
        f"Deploy tx: [`{dep['deploy_tx'][:14]}...`]({dep['deploy_tx_url']})\n\n"
        + "\n".join(rows) + "\n<!-- LIVE-PROOFS:END -->"
    )
    new = re.sub(r"<!-- LIVE-PROOFS:START -->.*?<!-- LIVE-PROOFS:END -->", block, text,
                 flags=re.S)
    readme.write_text(new, encoding="utf-8")


def phase_create(dep, funder, dev) -> None:
    recorded = {g["title"]: g for g in dep.get("grants", [])}
    for seed in SEEDS:
        rec = recorded.get(seed["title"], {"title": seed["title"]})
        if "grant_id" not in rec:
            before = int(funder.read("get_protocol_metrics")["total_grants"])
            tx = funder.write(
                "create_grant",
                [dev.me, seed["title"], THRESHOLD, json.dumps(seed["spec"]), HANDLE],
                value=ESCROW, label="create_grant")
            rec["grant_id"] = before + 1
            rec["create_tx"] = tx["hash"]
            rec["developer_handle"] = HANDLE
            rec["created_at"] = funder.read("get_grant", [rec["grant_id"]])["created_at"]
            print(f"grant #{rec['grant_id']} {seed['title']}: {ESCROW / GEN} GEN locked, "
                  f"created_at={rec['created_at']}")
        recorded[seed["title"]] = rec
        dep["grants"] = list(recorded.values())
        save_deployment(dep)
    print("\nnext: python seed_repo.py  (commits must be authored after these timestamps)")


def phase_deliver(dep, funder, dev) -> None:
    recorded = {g["title"]: g for g in dep.get("grants", [])}
    for seed in SEEDS:
        rec = recorded.get(seed["title"])
        if not rec or not rec.get("seed_commit"):
            print(f"{seed['title']}: no seed commit yet, run seed_repo.py")
            continue
        gid = rec["grant_id"]
        print(f"\n== grant #{gid} {seed['title']}")
        if "submit_tx" not in rec:
            tx = dev.write("submit_deliverable", [gid, rec["repo_url"], rec["seed_commit"]],
                           value=BOND, label="submit_deliverable")
            rec["submit_tx"] = tx["hash"]
            print("   deliverable submitted, 0.05 GEN bond staked")
        if seed["evaluate"] and "evaluate_tx" not in rec:
            tx = funder.write("evaluate_milestone_consensus", [gid],
                              label="evaluate_milestone_consensus")
            rec["evaluate_tx"] = tx["hash"]
        g = funder.read("get_grant", [gid])
        rec.update(final_status=g["status"], quality_score=g["quality_score"],
                   audit_report=g["audit_report"])
        print(f"   status {g['status']}  score {g['quality_score']}/100\n   {g['audit_report']}")
        dep["grants"] = list(recorded.values())
        save_deployment(dep)

    for rec in dep["grants"]:
        if rec.get("final_status") == "APPROVED" and "claim_tx" not in rec:
            tx = dev.write("claim_payout", [rec["grant_id"]], label="claim_payout")
            rec["claim_tx"] = tx["hash"]
            print(f"\ndeveloper claimed payout for grant #{rec['grant_id']}")
    metrics = funder.read("get_protocol_metrics")
    dep["metrics"] = {k: (v if isinstance(v, (int, bool)) else str(v)) for k, v in metrics.items()}
    save_deployment(dep)
    patch_readme(dep)
    print("\nprotocol metrics:", json.dumps(dep["metrics"]))


def main() -> int:
    phase = sys.argv[1] if len(sys.argv) > 1 else ""
    if phase not in ("create", "deliver"):
        print(__doc__)
        return 2
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
    print(f"funder    {funder.me}\ndeveloper {dev.me}  (GitHub: @{HANDLE})")
    (phase_create if phase == "create" else phase_deliver)(dep, funder, dev)
    return 0


if __name__ == "__main__":
    sys.exit(main())
