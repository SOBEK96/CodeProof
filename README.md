# CodeProof

**Autonomous software-engineering grant escrow and milestone verification oracle on GenLayer Studio Next.**

Funders lock a grant in GEN together with machine-readable acceptance criteria. A developer stakes a 0.05 GEN anti-spam bond and submits a GitHub commit. Any steward can then trigger evaluation: every GenVM validator independently ingests the commit and CI telemetry from GitHub, a score corridor is derived from those measurements, an LLM grades quality inside the corridor, and the committee must agree under the Equivalence Principle. A score of **85 or more** (configurable per grant) releases the escrow to the developer with no human in the loop.

| | |
|---|---|
| Network | GenLayer Studio Next, chain `61997` (`0xF22D`) |
| RPC | `https://studio-next.genlayer.com/api` |
| Explorer | `https://explorer-studio-next.genlayer.com` |
| Contract | `contracts/code_proof.py` |

## Live proofs

<!-- LIVE-PROOFS:START -->
Contract: [`0x5CFb886928A2d74e37Da4C602f6083CF71B532a8`](https://explorer-studio-next.genlayer.com/address/0x5CFb886928A2d74e37Da4C602f6083CF71B532a8)  
Deploy tx: [`0x9eb757285295...`](https://explorer-studio-next.genlayer.com/tx/0x9eb7572852950f4c61776dd6bb3c8cb7944318132920a06fd6e38d2d4bdd165e)

| Grant | Status | Score | Evaluation tx |
|---|---|---|---|
| #1 EVM Token Bridge Implementation | APPROVED | 91/100 | [`0x41bbb1781718...`](https://explorer-studio-next.genlayer.com/tx/0x41bbb1781718213398bfd7df8e9b2a4b0d2813de9728ed77162a830b9642f66c) |
| #2 Flash Loan Vault | REJECTED | 12/100 | [`0x0eb9f5844a16...`](https://explorer-studio-next.genlayer.com/tx/0x0eb9f5844a16daaae453c2b2002793e20aaaadef25df992a920096384d127a57) |
| #3 Decentralized Identity Indexer | DELIVERED | 0/100 | pending (steward) |
<!-- LIVE-PROOFS:END -->

Full record (addresses, transaction hashes, SHA-256 of the deployed source): [`deployments/studio-next.json`](deployments/studio-next.json).

### What the seeded milestones are

Each grant is bound to the GitHub handle **`Handik4`**. The deliverables are **fresh commits authored in `Handik4/codeproof-milestones` after the grants were created on-chain**, so they pass the oracle's own provenance and freshness checks. GitHub Actions ran on every commit and the oracle read those check-runs.

| Grant | Commit | What it is |
|---|---|---|
| #1 EVM Token Bridge Implementation | `c6c70f6` | lock-and-release bridge ledger with a reentrancy guard, 6 tests |
| #2 Flash Loan Vault | `500da60` | deliberately bad: no guard, no repayment check, no tests, a `TODO` |
| #3 Decentralized Identity Indexer | `a6a3e49` | DID registry with rotation and history, 5 tests; left `DELIVERED` for you |

Scores are whatever the validators agreed on; they were recorded, not forced. Caveat: the flash-vault commit's CI is green only because the repository still contains the bridge tests (`pytest` collects them). The oracle never claims more than "a GitHub Actions run succeeded", and the grant is rejected on its missing file, missing methods and the model's reading of the code.

### Superseded deployments (kept for the audit trail)

| Contract | Why it was replaced |
|---|---|
| `0xe1d5F76F...7eBd6` | v1: audit findings #1-#6 unpatched |
| `0xD7670320...29892` | v2: patched, but the prompt sanitiser rewrote `<` and `>` inside the code under review, so the model graded `if amount (= 0:` and rejected a correct commit as a syntax error. Found on the first live run; fixed in v3 with a regression test |

## Audit findings and fixes (v3)

| # | Severity | Finding | Fix | Regression tests |
|---|---|---|---|---|
| 1 | Critical | A committed `.codeproof/report.json` could claim 999 passing tests and 100% coverage | The file is **never read**. Test telemetry comes only from the commit's GitHub **Actions check-runs** (`app.slug == "github-actions"`): a success is needed, a failure halves the score, and no authentic run clamps the CI component to 0 (ceiling 10). Coverage cannot be verified from check-runs, so `min_coverage` is informational and never raises a score | `test_spoofed_report_json_rejected`, `..._never_requested`, third-party and neutral check-run cases |
| 2 | Critical | Anyone could submit another developer's historical commit | `create_grant` registers a **`developer_handle`**. The commit must sit in a repository **owned by that handle**, or be authored **and** committed by it. The older of author/committer dates must be `>= grant.created_at`. Failures settle as `DISPUTED` with `ERR_PROVENANCE_MISMATCH` / `ERR_HISTORICAL_COMMIT` | `test_historical_commit_rejected`, `test_foreign_repo_commit_rejected`, rebase and date-parsing cases |
| 3 | High | `required_methods` matched names inside comments | Comments (`//`, `#`, `/* */`), docstrings and string literals are stripped (state carried across diff context lines), and a method counts only on a **declaration line**, not a call site. `forbidden_patterns` also ignore comments | `test_methods_in_comments_ignored`, an 18-case declaration matrix, `preview_code` view |
| 4 | Medium | With threshold <= 60 the corridor floor of 60 passed model score 0 | `MIN_THRESHOLD = 70`; corridor floor is now `50 x weakest ratio`, always below any legal threshold, so the model stays consequential | `test_low_threshold_cannot_bypass_llm` |
| 5 | Medium | A funder could set `["a","e","i","o","u"]` and slash the developer | Patterns need `len >= 3`, at most 10, and not a common keyword. A hit only lowers the score ceiling by 15. **Only** a fixed list of malicious signatures, an empty commit, or a model score under 40 forfeits the bond | `test_forbidden_patterns_sanitized` (20 traps), `test_non_malicious_forbidden_hit_does_not_slash_bond` |
| 6 | Medium | A blocked repo (403) looped in `[TRANSIENT]`, locking funds in `DELIVERED` | A 403 is transient **only** when GitHub says it is a rate limit; otherwise (and for 451) it is terminal `DISPUTED / REPO_BLOCKED` with the bond refunded. `cancel_stuck_delivery` lets the funder or developer unlock everything after 7 days. `audit_report` is capped at 1000 characters | `test_stuck_delivered_timeout_cancellation`, `test_blocked_repo_403_is_terminal_not_transient`, bloat tests |

Interface changes: `create_grant(developer, title, threshold, spec_criteria, developer_handle)`; `compute_bounds(telemetry_json)`; new `cancel_stuck_delivery`, `preview_code`, `is_valid_forbidden_pattern`.

**Deviations from the audit brief**
- A historical or foreign commit **settles as `DISPUTED`** (bond refunded, escrow locked, re-submit up to 3 times) rather than reverting. A revert would leave the grant in `DELIVERED` forever, which is finding #6 again.
- Provenance accepts "repo owner == handle" **or** "author and committer both == handle". Git author fields are spoofable, which is why both must match when the repo is not the developer's.
- A model score under 40 still forfeits the bond (the spec is public before a developer stakes anything). Spec-controlled signals alone never do.

Known limits: a workflow that runs `echo ok` is still a green check-run, so CI is evidence of execution, not of test quality; the model and the required-method declarations carry the rest.

## Protocol theory

### 1. Evidence fixes a corridor; the model grades inside it

LLMs are good at judging readability and architecture and bad at counting. So CodeProof splits the verdict:

1. **Deterministic ingestion** (`_gather`): GitHub API commit metadata (SHA must match), **provenance** (developer's repo, or author+committer), **freshness** (after the grant), required files present, required methods *declared* in executable added code (comments, docstrings and strings stripped), forbidden patterns and malicious signatures, and test telemetry from authentic **GitHub Actions check-runs only**.
2. **Corridor** (`_bounds`): three satisfaction ratios (files, methods, CI) in `[0, 1]`. The **weakest** governs: `hi = 100*min + 10`, `lo = 50*min`. Every forbidden-pattern hit costs 15 points of ceiling; an empty commit is capped at 20; a malicious payload caps it at 0. A deliverable that misses a hard requirement cannot be averaged into approval by excelling elsewhere.
3. **LLM grade** inside the corridor: readability, architectural adherence, edge cases, CVE-free design. Commit text is wrapped as untrusted data; whatever it says, the score is clamped to `[lo, hi]`, so prompt injection cannot buy more than the measurements allow.

### 2. Equivalence Principle

`evaluate_milestone_consensus` uses `gl.vm.run_nondet` with a custom validator (`_agree`). Each validator re-fetches the evidence and re-grades, then agrees only if:

- the status matches (`OK` vs `INCONCLUSIVE`; same reason when inconclusive),
- **all deterministic telemetry is identical**,
- the bond-forfeit flag matches,
- the leader's score lies inside the corridor the validator derived itself (a forged leader cannot exceed it),
- `|leader - validator| <= 12`,
- both land in the same settlement tier (`PASS` / `FAIL` / `FRAUD`).

Transient GitHub failures (429, 5xx, rate limit) raise `[TRANSIENT]` and the transaction simply retries; LLM failures raise `[LLM_ERROR]` and force leader rotation. Neither can settle funds.

### 3. Economics and settlement

| Outcome | Escrow | Developer bond (0.05 GEN) |
|---|---|---|
| `score >= threshold` **APPROVED** | to developer | refunded |
| below threshold **REJECTED** | back to funder | refunded |
| below threshold **and** empty commit, malicious payload, or model score < 40 | back to funder | **forfeited**: 50% funder compensation, 50% protocol treasury |
| repo or commit 404 / blocked / historical / foreign **DISPUTED** | stays locked | refunded; developer may re-submit (max 3) or funder cancels |
| `DELIVERED` for 7 days | `cancel_stuck_delivery` returns it to the funder | returned to the developer |

All payouts are **pull-payments** (`claim_payout`), following checks-effects-interactions with a rollback if enqueueing the transfer fails. Solvency is an explicit, publicly readable invariant:

```
balance >= locked_escrow + locked_bonds + total_claimable + treasury
```

`get_protocol_metrics().solvent` evaluates it on-chain.

### Design choices worth knowing

- **Missing commit fails closed.** A 404/422 gives `DISPUTED`, not `REJECTED`: a dead link is an infrastructure fact, not a verdict, so nobody is slashed for it. "Fabricated" therefore means a commit that exists but is empty or irrelevant (score < 40).
- **A funder can always get out.** `OPEN` grants become cancellable after 14 days; `DISPUTED` grants immediately.
- **No authentic CI means no approval.** Without a successful GitHub Actions run the CI ratio is 0 and the ceiling is 10.

## Architecture

```
  Funder ──create_grant (GEN)──┐                 ┌── GitHub API ──┐
                               ▼                 │ commit · files │
                      ┌─────────────────┐        │ patch · CI runs│
  Developer ─submit──▶│  CodeProof.py   │        └───────▲────────┘
   (commit + 0.05)    │  grants, escrow │                │ fetched independently
                      │  bonds, ledger  │   evaluate     │ by every validator
  Steward ──evaluate─▶│                 │──────────▶ ┌───┴────────────────────┐
                      └────────┬────────┘            │ Leader    Validator ×N │
                               │ settle              │  gather     gather     │
                               ▼                     │  _bounds    _bounds    │
                     claimable (pull-payment)        │  LLM grade  LLM grade  │
                      developer / funder / treasury  │  └──── _agree ────┘    │
                                                     └────────────────────────┘
```

## Repository layout

```
contracts/code_proof.py      the intelligent contract
tests/                       388 pytest cases (direct mode, no network)
scripts/deploy.py            key bootstrap, 10 GEN funding, deploy, record
scripts/interact_live.py     `create` grants, then `deliver` + evaluate, record tx hashes
scripts/seed_repo.py         author the fresh milestone commits (after the grants exist)
scripts/seed_milestones/     sources for those commits
deployments/studio-next.json addresses, hashes, live transactions
frontend/                    Vite + React + Tailwind Grant HUD
```

## Running it

Python side (needs `genlayer-py`, `python-dotenv`, and for tests `genlayer-test`):

```bash
genvm-lint check contracts/code_proof.py          # lint + validate
pytest                                            # 388 tests, about 8 minutes
python scripts/deploy.py                          # keys in .env (git-ignored, mode 600)
python scripts/interact_live.py create            # fund 3 grants bound to a GitHub handle
python scripts/seed_repo.py                       # fresh commits in the developer's repo
python scripts/interact_live.py deliver           # submit, evaluate, record live proofs
```

Frontend:

```bash
cd frontend
npm install
npm run build            # tsc --noEmit + vite build
npm run dev              # http://localhost:5173
npm run console-check    # headless Chrome: zero console errors on live contract load
```

The HUD reads the contract address from `deployments/studio-next.json` (or `VITE_CONTRACT_ADDRESS`).

## Steward test guide

1. Open the HUD, click **Connect Wallet** (it adds or switches to chain 61997). Fund the wallet from the Studio faucet if needed.
2. Find grant #3 (status `PENDING`) and click **Inspect**. You will see the real commit diff, CI output and acceptance criteria.
3. Click **Trigger GenVM Milestone Evaluation** and confirm. Watch the three steps advance: telemetry ingestion, multi-validator equivalence grading, autonomous escrow settlement.
4. The grant flips to `APPROVED` or `REJECTED` with the score, corridor and rationale written into its on-chain audit report.
5. If approved, the developer account calls **Claim payout**. Check **Escrow metrics**: `escrow fully solvent` should stay green throughout.

CLI equivalent: `genlayer write <contract> evaluate_milestone_consensus --args 3`. If a delivery cannot be evaluated for 7 days, either party can call `cancel_stuck_delivery`.

GitHub allows 60 unauthenticated API calls per hour per IP. If validators share an exhausted address the transaction reverts with `[TRANSIENT]` and changes nothing; wait and retry.

## Testing

`tests/` runs the contract in GenVM direct mode with mocked GitHub and LLM responses. `tests/test_code_proof.py` holds one explicit reproduction per audit finding. The rest cover exact-match approval, substandard code, every bond-forfeiture path, unreachable-commit fail-closed, prompt-injection clamping, multi-validator agreement and disagreement (forged leader results, tier-boundary splits, tolerance edges, 2-of-3 and 3-of-5 majorities), and a solvency check after every settlement scenario.
