"""Shared helpers for CodeProof direct-mode tests (pure ASCII).

Uses the genlayer-test pytest plugin fixtures: direct_vm, direct_deploy,
direct_alice (funder), direct_bob (developer), direct_charlie (steward).
"""

import json

CONTRACT = "contracts/code_proof.py"

ATTO = 10**18
GRANT = 10 * ATTO
BOND = ATTO // 20  # 0.05 GEN

SHA = "a" * 39 + "1"
SHA2 = "b" * 39 + "2"
REPO = "https://github.com/acme/bridge"
API = r"https://api\.github\.com/repos/acme/bridge/commits/[0-9a-f]{40}$"
REPORT = r"https://raw\.githubusercontent\.com/acme/bridge/[0-9a-f]{40}/\.codeproof/report\.json"
CHECKS = r"https://api\.github\.com/repos/acme/bridge/commits/[0-9a-f]{40}/check-runs"

SPEC = {
    "required_files": ["src/Bridge.sol", "test/Bridge.t.sol"],
    "required_methods": ["deposit", "withdraw", "nonReentrant"],
    "min_coverage": 90,
    "forbidden_patterns": ["tx.origin", "delegatecall"],
    "security_invariants": ["no reentrancy", "checks-effects-interactions"],
    "architecture": "Lock/mint bridge with guardian pause",
}

GOOD_PATCH = (
    "@@ -0,0 +1,40 @@\n+function deposit(uint256 a) external nonReentrant {}\n"
    "+function withdraw(uint256 a) external nonReentrant {}\n+// tests\n"
)


def spec_json(**over) -> str:
    s = dict(SPEC)
    s.update(over)
    return json.dumps(s)


def commit_body(sha=SHA, files=None, message="feat: bridge", patch=GOOD_PATCH):
    if files is None:
        files = ["src/Bridge.sol", "test/Bridge.t.sol"]
    return json.dumps({
        "sha": sha,
        "commit": {"message": message},
        "files": [
            {"filename": f, "additions": 20, "deletions": 0, "patch": patch} for f in files
        ],
    })


def mock_github(direct_vm, sha=SHA, files=None, patch=GOOD_PATCH, report=None,
                commit_status=200, checks=None, message="feat: bridge"):
    """Mock GitHub: the commit endpoint, the committed report, and CI check-runs."""
    direct_vm.clear_mocks()
    direct_vm.mock_web(CHECKS, {"status": 200, "body": json.dumps({"check_runs": checks or []})})
    direct_vm.mock_web(API, {
        "status": commit_status,
        "body": commit_body(sha, files, message, patch) if commit_status == 200 else "{}",
    })
    if report is None:
        direct_vm.mock_web(REPORT, {"status": 404, "body": ""})
    else:
        direct_vm.mock_web(REPORT, {"status": 200, "body": json.dumps(report)})


def good_report(passed=42, failed=0, coverage=100):
    return {"tests_passed": passed, "tests_failed": failed, "coverage": coverage}


def mock_score(direct_vm, score, rationale="Clear, well structured code."):
    # Double-encoded: the harness json.loads the mock into a string, and
    # exec_prompt(response_format="json") parses that string again.
    direct_vm.mock_llm(r".*", json.dumps(json.dumps({"score": score, "rationale": rationale})))


def fund(direct_vm, who, amount=1000 * ATTO):
    try:
        direct_vm.deal(who, amount)
    except Exception:
        pass


def create(c, vm, funder, developer_hex, title="EVM Token Bridge", threshold=85,
           spec=None, value=GRANT):
    fund(vm, funder)
    vm.sender = funder
    vm.value = value
    gid = c.create_grant(developer_hex, title, threshold, spec if spec is not None else spec_json())
    vm.value = 0
    return gid


def submit(c, vm, dev, gid, repo=REPO, sha=SHA, value=BOND):
    fund(vm, dev)
    vm.sender = dev
    vm.value = value
    c.submit_deliverable(gid, repo, sha)
    vm.value = 0


def hexof(c, vm, who) -> str:
    prev = getattr(vm, "sender", None)
    vm.sender = who
    k = c.whoami()
    if prev is not None:
        vm.sender = prev
    return k


def sync_balance(c, vm):
    """Direct mode does not auto-credit self.balance; fund the contract to the
    tracked liabilities so the on-chain solvency predicate is meaningful."""
    m = c.get_protocol_metrics()
    tracked = (int(m["locked_escrow"]) + int(m["locked_bonds"])
               + int(m["total_claimable"]) + int(m["treasury"]))
    vm.deal(vm._contract_address, tracked)
    return c.get_protocol_metrics()


def delivered(c, vm, funder, dev, **kw):
    dev_hex = hexof(c, vm, dev)
    gid = create(c, vm, funder, dev_hex, **{k: v for k, v in kw.items() if k in ("title", "threshold", "spec", "value")})
    submit(c, vm, dev, gid)
    return gid


def evaluate(c, vm, who, gid):
    vm.sender = who
    return c.evaluate_milestone_consensus(gid)
