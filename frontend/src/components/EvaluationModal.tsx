import { AlertTriangle, CheckCircle2, CircleDot, ExternalLink, FileCode2, GitCommitHorizontal, Loader2, Play, ScanSearch, Scale, Vault, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { claimPayout, evaluateMilestone, hasWallet, type TxProgress } from "../lib/chain";
import { txUrl } from "../lib/config";
import { commitUrl, gen, parseSpec, repoSlug, short } from "../lib/format";
import type { Grant } from "../lib/types";
import ScoreMeter from "./ScoreMeter";
import StatusBadge from "./StatusBadge";

interface Evidence {
  files: { filename: string; additions: number; deletions: number; patch?: string }[];
  message: string;
  checks: { passed: number; failed: number; total: number } | null;
}

interface Props {
  grant: Grant;
  account: string | null;
  onConnect: () => void;
  onClose: () => void;
  onSettled: () => void;
}

async function fetchEvidence(g: Grant): Promise<Evidence> {
  const slug = repoSlug(g.repo_url);
  const base = `https://api.github.com/repos/${slug}`;
  const res = await fetch(`${base}/commits/${g.commit_sha}`, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(res.status === 404 ? "Commit not found on GitHub (validators would fail closed)." : `GitHub responded ${res.status} (rate limits apply to unauthenticated browsers).`);
  const data = await res.json();
  let checks: Evidence["checks"] = null;
  try {
    const c = await fetch(`${base}/commits/${g.commit_sha}/check-runs?per_page=100`, { headers: { Accept: "application/vnd.github+json" } });
    if (c.ok) {
      const runs = ((await c.json()).check_runs ?? []) as { conclusion: string | null }[];
      const passed = runs.filter((r) => r.conclusion === "success").length;
      const failed = runs.filter((r) => ["failure", "timed_out", "cancelled", "action_required"].includes(r.conclusion ?? "")).length;
      checks = { passed, failed, total: runs.length };
    }
  } catch {
    checks = null;
  }
  return { files: data.files ?? [], message: String(data.commit?.message ?? "").split("\n")[0], checks };
}

type StepState = "idle" | "active" | "done";

function Step({ n, title, desc, state, Icon }: { n: number; title: string; desc: string; state: StepState; Icon: typeof ScanSearch }) {
  const ring = state === "done" ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300" : state === "active" ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300 shadow-cyan" : "border-slate-700 bg-slate-800/40 text-slate-500";
  return (
    <li className="flex gap-3">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${ring}`}>
        {state === "active" ? <Loader2 className="h-5 w-5 animate-spin" /> : state === "done" ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
      </span>
      <div>
        <div className={`text-sm font-semibold ${state === "idle" ? "text-slate-400" : "text-white"}`}>
          {n}. {title}
        </div>
        <p className="text-xs leading-relaxed text-slate-400">{desc}</p>
      </div>
    </li>
  );
}

export default function EvaluationModal({ grant: g, account, onConnect, onClose, onSettled }: Props) {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [phase, setPhase] = useState<TxProgress["phase"] | "idle">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimHash, setClaimHash] = useState<string | null>(null);
  const spec = useMemo(() => parseSpec(g.spec_criteria), [g.spec_criteria]);
  const settled = g.status === "APPROVED" || g.status === "REJECTED" || g.status === "DISPUTED";
  const canEvaluate = g.status === "DELIVERED";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!g.repo_url || !g.commit_sha) return;
    let live = true;
    fetchEvidence(g)
      .then((e) => live && setEvidence(e))
      .catch((e: Error) => live && setEvidenceError(e.message));
    return () => {
      live = false;
    };
  }, [g]);

  const trigger = async () => {
    if (!account) return onConnect();
    setError(null);
    try {
      const out = await evaluateMilestone(account, g.grant_id, (p) => {
        setPhase(p.phase);
        if (p.hash) setTxHash(p.hash);
      });
      setTxHash(out.hash);
      onSettled();
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const claim = async () => {
    if (!account) return onConnect();
    try {
      setClaimHash(await claimPayout(account, g.grant_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const running = phase === "signing" || phase === "consensus";
  const s1: StepState = settled || phase === "done" ? "done" : phase === "signing" ? "active" : phase === "consensus" ? "done" : "idle";
  const s2: StepState = settled || phase === "done" ? "done" : phase === "consensus" ? "active" : "idle";
  const s3: StepState = settled || phase === "done" ? "done" : "idle";
  const patch = evidence?.files.find((f) => f.patch)?.patch ?? "";
  const patchLines = patch.split("\n").slice(0, 40);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-label={`Milestone ${g.title}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card w-full max-w-4xl border-slate-700 bg-ink-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={g.status} />
              <span className="font-mono text-xs text-slate-500">grant #{g.grant_id}</span>
            </div>
            <h3 className="text-xl font-bold text-white">{g.title}</h3>
            <p className="mt-1 font-mono text-xs text-slate-400">
              {gen(g.escrow_amount)} GEN escrow · bond 0.05 GEN · threshold {g.threshold_score}/100
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-5">
          <div className="space-y-5 lg:col-span-3">
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
                <FileCode2 className="h-4 w-4 text-emerald-300" /> Commit diff
              </h4>
              {g.repo_url ? (
                <a href={commitUrl(g.repo_url, g.commit_sha)} target="_blank" rel="noreferrer" className="hash mb-2 inline-flex items-center gap-1">
                  <GitCommitHorizontal className="h-3.5 w-3.5" /> {repoSlug(g.repo_url)}@{short(g.commit_sha, 12, 4)} <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <p className="text-sm text-slate-500">No deliverable submitted yet.</p>
              )}
              {evidenceError && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {evidenceError}
                </p>
              )}
              {g.repo_url && !evidence && !evidenceError && <p className="text-xs text-slate-500">Fetching commit from GitHub…</p>}
              {evidence && (
                <pre className="max-h-64 overflow-auto rounded-lg border border-slate-800 bg-ink-950 p-3 font-mono text-[11.5px] leading-relaxed">
                  {patchLines.map((l, i) => (
                    <div key={i} className={l.startsWith("+") ? "text-emerald-300" : l.startsWith("-") ? "text-rose-300" : l.startsWith("@@") ? "text-cyan-300" : "text-slate-400"}>
                      {l || " "}
                    </div>
                  ))}
                  {patchLines.length === 0 && <span className="text-slate-500">(no textual patch in this commit)</span>}
                </pre>
              )}
              {evidence && (
                <p className="mt-1.5 text-xs text-slate-500">
                  {evidence.files.length} file{evidence.files.length === 1 ? "" : "s"} changed · “{evidence.message}”
                </p>
              )}
            </div>

            <div>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
                <CircleDot className="h-4 w-4 text-cyan-300" /> Test execution output
              </h4>
              <pre className="rounded-lg border border-slate-800 bg-ink-950 p-3 font-mono text-[11.5px] leading-relaxed text-slate-300">
                {evidence?.checks
                  ? `CI check-runs: ${evidence.checks.passed} passed, ${evidence.checks.failed} failed (${evidence.checks.total} total)`
                  : evidence
                    ? "No CI telemetry reachable for this commit."
                    : "Waiting for telemetry…"}
                {g.audit_report ? `\n\non-chain audit report:\n${g.audit_report}` : ""}
              </pre>
            </div>

            {spec && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-200">Acceptance criteria</h4>
                <dl className="grid gap-2 rounded-lg border border-slate-800 bg-ink-950 p-3 text-xs sm:grid-cols-2">
                  <div><dt className="text-slate-500">Required files</dt><dd className="font-mono text-slate-300">{spec.required_files.join(", ") || "-"}</dd></div>
                  <div><dt className="text-slate-500">Required methods</dt><dd className="font-mono text-slate-300">{spec.required_methods.join(", ") || "-"}</dd></div>
                  <div><dt className="text-slate-500">Min coverage</dt><dd className="font-mono text-slate-300">{spec.min_coverage}%</dd></div>
                  <div><dt className="text-slate-500">Forbidden patterns</dt><dd className="font-mono text-slate-300">{spec.forbidden_patterns.join(", ") || "-"}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-slate-500">Security invariants</dt><dd className="text-slate-300">{spec.security_invariants.join(" · ") || "-"}</dd></div>
                </dl>
              </div>
            )}
          </div>

          <div className="space-y-5 lg:col-span-2">
            <div>
              <h4 className="mb-3 text-sm font-semibold text-slate-200">Validator consensus</h4>
              <ol className="space-y-4">
                <Step n={1} title="Telemetry Ingestion" desc="Every validator fetches the commit, files, patch and CI results straight from GitHub." state={s1} Icon={ScanSearch} />
                <Step n={2} title="Multi-Validator Equivalence Grading" desc="Evidence fixes a score corridor; the LLM committee grades inside it and must agree under the Equivalence Principle." state={s2} Icon={Scale} />
                <Step n={3} title="Autonomous Escrow Settlement" desc={`Score ≥ ${g.threshold_score} releases escrow to the developer. Below, it returns to the funder.`} state={s3} Icon={Vault} />
              </ol>
            </div>

            <div className="rounded-lg border border-slate-800 bg-ink-950 p-4">
              <ScoreMeter score={g.quality_score} threshold={g.threshold_score} evaluated={g.evaluated} size="lg" />
            </div>

            {canEvaluate && (
              <button type="button" className="btn-primary w-full" onClick={trigger} disabled={running}>
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {running ? (phase === "signing" ? "Confirm in wallet…" : "Validators reaching consensus…") : account ? "Trigger GenVM Milestone Evaluation" : hasWallet() ? "Connect wallet to evaluate" : "Wallet required to evaluate"}
              </button>
            )}
            {g.status === "APPROVED" && (
              <button type="button" className="btn-ghost w-full" onClick={claim}>Claim payout (developer)</button>
            )}
            {!canEvaluate && !settled && <p className="text-xs text-slate-500">This grant is {g.status.toLowerCase()}; evaluation opens once the developer submits a deliverable.</p>}
            {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-300">{error}</p>}
            {(txHash || claimHash) && (
              <a href={txUrl((claimHash ?? txHash) as string)} target="_blank" rel="noreferrer" className="hash inline-flex items-center gap-1">
                tx {short((claimHash ?? txHash) as string, 10, 6)} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
