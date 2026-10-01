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
Contract: [`0xe1d5F76F02930B2adde5cd6d34C65EC2c7F7eBd6`](https://explorer-studio-next.genlayer.com/address/0xe1d5F76F02930B2adde5cd6d34C65EC2c7F7eBd6)  
Deploy tx: [`0xa751a02f25bb...`](https://explorer-studio-next.genlayer.com/tx/0xa751a02f25bbb782af471bf7e28145a50027f72a44252a909a7ceeed22ef1c89)

| Grant | Status | Score | Evaluation tx |
|---|---|---|---|
| #1 EVM Token Bridge Implementation | APPROVED | 92/100 | [`0x573481465bda...`](https://explorer-studio-next.genlayer.com/tx/0x573481465bda123d0d64f0440b39ba2a8ebc04c114d54ce950703d3ddfa3f2cb) |
| #2 Flash Loan Vault | REJECTED | 2/100 | [`0x6fc4a110d881...`](https://explorer-studio-next.genlayer.com/tx/0x6fc4a110d8819aa8fe7fa3c7e9b6a51beb6b7d147e942d217e290106551defd3) |
| #3 Decentralized Identity Indexer | DELIVERED | 0/100 | pending (steward) |
<!-- LIVE-PROOFS:END -->

Full record (addresses, transaction hashes, SHA-256 of the deployed source): [`deployments/studio-next.json`](deployments/studio-next.json).

### What the seeded milestones really are

The three deliverables are **real public GitHub commits pinned by SHA**, not fixtures invented for the demo, and validators fetch them live. Because nobody wrote a bridge, a flash-loan vault or an identity indexer for this grant, each title is paired with the closest genuine commit and an acceptance spec written to match what that commit does or does not contain:

| Grant | Commit | Why it was chosen |
|---|---|---|
| #1 EVM Token Bridge Implementation | `OpenZeppelin/openzeppelin-contracts@4e35b0b` | green CI (12 passing checks), touches both required files, adds the required method |
| #2 Flash Loan Vault | `octocat/Hello-World@7fd1a60` | a README edit: no vault, no guard, no tests, so the spec is not met |
| #3 Decentralized Identity Indexer | `OpenZeppelin/openzeppelin-contracts@0134b00` | real commit with tests, left `DELIVERED` for you to evaluate |

The scores on-chain are whatever the validators agreed on. They are recorded, not forced, so they may differ from the round numbers in the original brief.

## Protocol theory

### 1. Evidence fixes a corridor; the model grades inside it

LLMs are good at judging readability and architecture and bad at counting. So CodeProof splits the verdict:

1. **Deterministic ingestion** (`_gather`): GitHub API commit metadata (SHA must match, files, added lines), required files present, required method names present in *added* code, forbidden patterns (`tx.origin`, `delegatecall`, ...) absent, and test telemetry from a committed `.codeproof/report.json` (`tests_passed`, `tests_failed`, `coverage`) or, failing that, the commit's CI check-runs.
2. **Corridor** (`_bounds`): four satisfaction ratios (files, methods, tests, coverage) in `[0, 1]`. The **weakest** governs: `hi = 100*min + 10`, `lo = 60*min`. Every forbidden-pattern hit costs 15 points of ceiling; an empty commit is capped at 20. A deliverable that misses a hard requirement cannot be averaged into approval by excelling elsewhere.
3. **LLM grade** inside the corridor: readability, architectural adherence, edge cases, CVE-free design. Commit text is wrapped as untrusted data; whatever it says, the score is clamped to `[lo, hi]`, so prompt injection cannot buy more than the measurements allow.

### 2. Equivalence Principle

`evaluate_milestone_consensus` uses `gl.vm.run_nondet` with a custom validator (`_agree`). Each validator re-fetches the evidence and re-grades, then agrees only if:

- the status matches (`OK` vs `INCONCLUSIVE`; same reason when inconclusive),
- **all deterministic telemetry is identical**,
- the leader's score lies inside the corridor the validator derived itself (a forged leader cannot exceed it),
- `|leader - validator| <= 12`,
- both land in the same settlement tier (`PASS` / `FAIL` / `FRAUD`).

Transient GitHub failures (429, 5xx, rate limit) raise `[TRANSIENT]` and the transaction simply retries; LLM failures raise `[LLM_ERROR]` and force leader rotation. Neither can settle funds.

### 3. Economics and settlement

| Outcome | Escrow | Developer bond (0.05 GEN) |
|---|---|---|
| `score >= threshold` **APPROVED** | to developer | refunded |
| `40 <= score < threshold` **REJECTED** | back to funder | refunded (honest miss, not spam) |
| `score < 40` **REJECTED** | back to funder | **forfeited**: 50% funder compensation, 50% protocol treasury |
| repo or commit 404 **DISPUTED** | stays locked | refunded; developer may re-submit (max 3 attempts) or funder cancels |

All payouts are **pull-payments** (`claim_payout`), following checks-effects-interactions with a rollback if enqueueing the transfer fails. Solvency is an explicit, publicly readable invariant:

```
balance >= locked_escrow + locked_bonds + total_claimable + treasury
```

`get_protocol_metrics().solvent` evaluates it on-chain.

### Design choices worth knowing

- **Missing commit fails closed.** A 404/422 gives `DISPUTED`, not `REJECTED`: a dead link is an infrastructure fact, not a verdict, so nobody is slashed for it. "Fabricated" therefore means a commit that exists but is empty or irrelevant (score < 40).
- **A funder can always get out.** `OPEN` grants become cancellable after 14 days; `DISPUTED` grants immediately.
- **No test telemetry means no approval.** Without a report or CI check-runs the test ratio is 0 and the ceiling is 10.

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
tests/                       230 pytest cases (direct mode, no network)
scripts/deploy.py            key bootstrap, 10 GEN funding, deploy, record
scripts/interact_live.py     seed 3 milestones, record tx hashes
deployments/studio-next.json addresses, hashes, live transactions
frontend/                    Vite + React + Tailwind Grant HUD
```

## Running it

Python side (needs `genlayer-py`, `python-dotenv`, and for tests `genlayer-test`):

```bash
genvm-lint check contracts/code_proof.py          # lint + validate
pytest                                            # 230 tests, about 5 minutes
python scripts/deploy.py                          # keys in .env (git-ignored, mode 600)
python scripts/interact_live.py                   # seeds + records live proofs
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

CLI equivalent: `genlayer write <contract> evaluate_milestone_consensus --args 3`.

GitHub allows 60 unauthenticated API calls per hour per IP. If validators share an exhausted address the transaction reverts with `[TRANSIENT]` and changes nothing; wait and retry.

## Testing

`tests/` runs the contract in GenVM direct mode with mocked GitHub and LLM responses: exact-match approval, substandard code, every bond-forfeiture path, unreachable-commit fail-closed, prompt-injection clamping, multi-validator agreement and disagreement (forged leader results, tier-boundary splits, tolerance edges, 2-of-3 and 3-of-5 majorities), and a solvency check after every settlement scenario.
