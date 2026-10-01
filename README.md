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
Contract: [`0x9902D0502512B3897Ee966F29a39e5334C585aFd`](https://explorer-studio-next.genlayer.com/address/0x9902D0502512B3897Ee966F29a39e5334C585aFd)  
Deploy tx: [`0xe14b1037e89b...`](https://explorer-studio-next.genlayer.com/tx/0xe14b1037e89b6ed0faeb4f48cec71fd8dcad8d0bd2d169e46327a87bb65e4b03)

| Grant | Status | Score | Evaluation tx |
|---|---|---|---|
| #1 EVM Token Bridge Implementation | APPROVED | 88/100 | [`0xd06ab520f4e9...`](https://explorer-studio-next.genlayer.com/tx/0xd06ab520f4e9754910bc305974b412e9c80a48b7b0c57b075e82db2c1351860b) |
| #2 Flash Loan Vault | REJECTED | 12/100 | [`0xe900a755f767...`](https://explorer-studio-next.genlayer.com/tx/0xe900a755f7670b23dc1095da1d3bcf7b589cbb1a65616ed8cb8afd5a956d7e23) |
| #3 Decentralized Identity Indexer | DELIVERED | 0/100 | pending (steward) |
<!-- LIVE-PROOFS:END -->

Full record (addresses, transaction hashes, SHA-256 of the deployed source): [`deployments/studio-next.json`](deployments/studio-next.json).

### What the seeded milestones are

Each grant is bound to the GitHub handle **`Handik4`**. The deliverables are **fresh commits authored in `Handik4/codeproof-milestones` after the grants were created on-chain**, so they pass the oracle's own provenance and freshness checks. GitHub Actions ran on every commit and the oracle read those check-runs.

| Grant | Commit | What it is |
|---|---|---|
| #1 EVM Token Bridge Implementation | `4d6f472` | lock-and-release bridge ledger with a reentrancy guard, 6 tests |
| #2 Flash Loan Vault | `5b2c543` | deliberately bad: no guard, no repayment check, no tests, a `TODO` |
| #3 Decentralized Identity Indexer | `c2a8196` | DID registry with rotation and history, 5 tests; left `DELIVERED` for you |

Scores are whatever the validators agreed on; they were recorded, not forced. Caveat: the flash-vault commit's CI is green only because the repository still contains the bridge tests (`pytest` collects them). The oracle never claims more than "a GitHub Actions run succeeded", and the grant is rejected on its missing file, missing methods and the model's reading of the code.

### Superseded deployments (kept for the audit trail)

| Contract | Why it was replaced |
|---|---|
| `0xe1d5F76F...7eBd6` | v1: round-1 audit findings #1-#6 unpatched |
| `0xD7670320...29892` | v2: patched, but the prompt sanitiser rewrote `<` and `>` inside the code under review, so the model graded `if amount (= 0:` and rejected a correct commit as a syntax error. Found on the first live run; fixed in v3 with a regression test |
| `0x5CFb8869...532a8` | v3: round-1 fixes plus the sanitiser fix; replaced by v4 for the round-2 findings (author binding, structural declarations, code-only scanning, workflow integrity) |

Each record, with its grants and transaction hashes, is preserved under `superseded_deployments` in [`deployments/studio-next.json`](deployments/studio-next.json). The current contract is **v4**, source SHA-256 `d01982e9b45cd70d827949b1b06123f546c1c87f0926fce5308cb4d773749838`.

## Audit findings and fixes (v3, round 1)

| # | Severity | Finding | Fix | Regression tests |
|---|---|---|---|---|
| 1 | Critical | A committed `.codeproof/report.json` could claim 999 passing tests and 100% coverage | The file is **never read**. Test telemetry comes only from the commit's GitHub **Actions check-runs** (`app.slug == "github-actions"`): a success is needed, a failure halves the score, and no authentic run clamps the CI component to 0 (ceiling 10). Coverage cannot be verified from check-runs, so `min_coverage` is informational and never raises a score | `test_spoofed_report_json_rejected`, `..._never_requested`, third-party and neutral check-run cases |
| 2 | Critical | Anyone could submit another developer's historical commit | `create_grant` registers a **`developer_handle`**. v3 accepted a commit in a repository owned by that handle; **v4 requires the commit's author to be the handle** (see round 2). The older of author/committer dates must be `>= grant.created_at`. Failures settle as `DISPUTED` with `ERR_UNAUTHORIZED_AUTHOR` / `ERR_HISTORICAL_COMMIT` | `test_historical_commit_rejected`, `test_foreign_repo_commit_rejected`, rebase and date-parsing cases |
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

### Round 2 audit findings and fixes (v4)

| # | Severity | Finding | Fix | Regression tests |
|---|---|---|---|---|
| 1 | Critical/High | Provenance accepted "repo owner == handle", so a third party's or upstream commit sitting in the developer's repo (or fork) passed | **Always** require `author.login == developer_handle` and `committer.login in [handle, "web-flow"]`; repository ownership is no longer consulted. Failures settle as `DISPUTED` with `ERR_UNAUTHORIZED_AUTHOR` | `test_foreign_author_in_developers_repo_rejected`, upstream-fork, third-party-committer, web-flow and case cases |
| 2 | Medium | A required method was satisfied by any declaration keyword on the line, e.g. `var deposit, withdraw;` | **Structural** checks per language: Python `def name(`; Solidity/JS/TS `function name(`, `name = (...)` / `name = async (...)` / `name = function`, class-method shorthand; `modifier name`; plus Rust, Go, Ruby, shell forms. `var`/`let`/`const` bindings, typed variables, call sites and docs never count | `test_var_declaration_does_not_satisfy_required_methods`, 10 non-function mentions, 11 JS forms, 25-case matrix |
| 3 | Medium | A commit could rewrite its own workflow to publish a green check; "anyone can evaluate" lets a funder time a developer out | A commit that touches `.github/workflows/` has its check-runs **ignored** (CI counts as none, ceiling 10, report shows `workflow_edited=1`). Evaluation stays permissionless; see *Trust model* below | `test_workflow_edit_makes_ci_untrusted`, path variants, `test_developer_evaluating_early_beats_the_funder_timeout` |
| 4 | Medium | `curl ... \| bash` in a README zeroed the corridor and (via FRAUD) slashed the bond; the stripper also treated `//` in `https://` as a comment | Signatures, forbidden patterns and method checks run **only on code files** (`.py .sol .js .ts .sh .rs .go ...`), never on `.md .txt .rst .json .yml .yaml`. A `//` right after `:` is a URL scheme, not a comment. A signature hit still zeroes the ceiling, but **no longer forfeits the bond on its own**: slashing needs an empty commit or an independent model score under 40 | `test_curl_pipe_bash_in_docs_is_not_scanned` (6 file types), `test_signature_alone_never_slashes_the_bond`, URL-preservation cases |

Interface changes in v4: the telemetry object (and `compute_bounds`) gains `workflow_tampered`; `ERR_PROVENANCE_MISMATCH` is now `ERR_UNAUTHORIZED_AUTHOR`.


## Trust model & game theory

- **Evaluation is permissionless.** Anyone can call `evaluate_milestone_consensus` on a `DELIVERED` grant, and it only ever resolves one way for a given commit. That also means a funder can trigger it. **Developers should trigger evaluation immediately after `submit_deliverable`** (it is a single transaction): the funder's exit is `cancel_stuck_delivery` after 7 days, which refunds escrow and bond, so a developer who submits and waits hands the funder a free option to cancel a delivery nobody has graded.
- **Why the 7-day cancel is not a funder weapon.** It only works while the grant is still `DELIVERED`. Once anyone evaluates, the grant settles and the cancel reverts with `ERR_INVALID_STATE`. A funder who cancels a good, unevaluated delivery costs the developer nothing but time (bond refunded), and a developer who evaluates promptly removes the option entirely.
- **Who can lose money.** A developer risks the 0.05 GEN bond only on an empty commit or a deliverable the model independently scores under 40, and the acceptance spec is public and immutable before they stake. Funders cannot slash through spec: forbidden patterns, impossible required methods and signature false-positives lower a score but never forfeit a bond.
- **What the oracle trusts.** GitHub's API for commit metadata and Actions check-runs, and the validator committee for grading. It does not trust anything the developer commits as evidence (no report files, no edited workflows) or anything in documentation files.
- **What it cannot prove.** That tests are meaningful, that the code is original, or that the GitHub identity is a human. Those are what the model's grade, the public spec and the funder's judgement of the result are for.

## Limitations & Trust Model

CodeProof narrows what a dishonest party can get away with; it does not remove judgement. These are the boundaries as they stand in the deployed contract.

1. **Untrusted workflows in separate commits.** The oracle ignores check-runs for a commit that edits `.github/workflows/`, but it only inspects that commit's own diff. A developer who rewrites CI in an *earlier* commit can arrange for a later commit to show passing check-runs, and a workflow that merely runs `echo ok` is still green. CI is evidence that a run happened, not that the tests are meaningful. The current contract counts any successful GitHub Actions run; it does **not** yet require a named check. A production deployment should bind each grant to an explicit required check-run name (for example `ci / tests`) in the grant criteria, ideally one defined by a workflow the funder controls. That hardening is not implemented here.
2. **Syntactic method declarations.** Required methods are matched structurally (`def foo(`, `function foo(`, `name = (...)`, `modifier foo`, `fn foo`, `func foo`), so a mention, a variable, a comment or a docs file cannot satisfy them. A declaration says nothing about the body: an empty stub like `def foo(): pass` passes this check. Catching stubs is left to the LLM committee, whose score must agree across validators under the Equivalence Principle. It is a judgement, not a deterministic rule, and it can be wrong in both directions.
3. **Code authorship vs plagiarism.** The deterministic checks bind a commit to the registered GitHub handle (author is the developer, committer is the developer or `web-flow`) and require that it post-dates the grant. They cannot tell whether freshly authored code was copied from elsewhere, or written by someone else and committed under the developer's name by a compromised account. Spotting copied or derivative logic relies on the model's qualitative review and on the funder reading the result.
4. **Evaluation liveness and the funder timeout.** `evaluate_milestone_consensus` is permissionless: anyone, including the developer, can call it on a `DELIVERED` grant. A grant left `DELIVERED` can be unwound by the funder (or the developer) with `cancel_stuck_delivery` after 7 days, refunding escrow and bond. **Developers should trigger evaluation immediately after `submit_deliverable`.** Once it settles, the grant can no longer be cancelled as stuck. The timeout is also the exit when evaluation genuinely cannot complete (rate limits, a model that never agrees).

Also worth knowing: GitHub's API and the validators' model are trusted inputs, and the oracle never trusts anything a developer commits as evidence (report files, edited workflows) or anything in documentation files.

## Protocol theory

### 1. Evidence fixes a corridor; the model grades inside it

LLMs are good at judging readability and architecture and bad at counting. So CodeProof splits the verdict:

1. **Deterministic ingestion** (`_gather`): GitHub API commit metadata (SHA must match), **authorship** (author is the developer, committer is the developer or web-flow), **freshness** (after the grant), required files present, required methods *structurally declared* in executable added code (comments, docstrings and strings stripped; code files only), forbidden patterns and malicious signatures (code files only), and test telemetry from authentic **GitHub Actions check-runs only**, ignored if the commit edits a workflow.
2. **Corridor** (`_bounds`): three satisfaction ratios (files, methods, CI) in `[0, 1]`. The **weakest** governs: `hi = 100*min + 10`, `lo = 50*min`. Every forbidden-pattern hit costs 15 points of ceiling; an empty commit is capped at 20; a malicious-payload signature caps it at 0. A deliverable that misses a hard requirement cannot be averaged into approval by excelling elsewhere.
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
| below threshold **and** (empty commit, or model score < 40) | back to funder | **forfeited**: 50% funder compensation, 50% protocol treasury |
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
tests/                       482 pytest cases (direct mode, no network)
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
pytest                                            # 482 tests, about 9 minutes
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
