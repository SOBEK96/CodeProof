import { CheckCircle2, ExternalLink, FileCode2, Loader2, Play, ScanSearch, Scale, Vault, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { claimPayout, evaluateMilestone, hasWallet, type TxProgress } from "../lib/chain";
import { txUrl } from "../lib/config";
import { fetchEvidence, onchainLines, previewLines, type Evidence, type TLine } from "../lib/evidence";
import { commitUrl, gen, parseSpec, repoSlug, short } from "../lib/format";
import { inconclusiveReason, parseAudit, signalsOf } from "../lib/telemetry";
import type { Grant } from "../lib/types";
import { CiBadge } from "./MilestoneCard";
import CommitPill from "./CommitPill";
import ScoreMeter from "./ScoreMeter";
import StatusBadge from "./StatusBadge";
import Terminal from "./Terminal";

interface Props {
  grant: Grant;
  account: string | null;
  onConnect: () => void;
  onClose: () => void;
  onSettled: () => void;
}

type StepState = "idle" | "active" | "done";

function Step({ n, title, desc, state, Icon }: { n: number; title: string; desc: string; state: StepState; Icon: typeof ScanSearch }) {
  const tone =
    state === "done" ? "border-emerald-500/40 bg-emerald-500/5" : state === "active" ? "border-cyan-400/50 bg-cyan-400/5 shadow-cyan" : "border-zinc-800 bg-zinc-900/40";
  const icon = state === "done" ? "text-emerald-300" : state === "active" ? "text-cyan-300" : "text-zinc-500";
  return (
    <li className={`flex-1 rounded-lg border p-3 transition-all duration-300 ${tone}`}>
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 place-items-center rounded-md border border-current/30 ${icon}`}>
          {state === "active" ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "done" ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </span>
        <span className={`text-[13px] font-semibold ${state === "idle" ? "text-zinc-400" : "text-white"}`}>
          {n}. {title}
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{desc}</p>
    </li>
  );
}

export default function EvaluationModal({ grant: g, account, onConnect, onClose, onSettled }: Props) {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [phase, setPhase] = useState<TxProgress["phase"] | "idle">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chainLines, setChainLines] = useState<TLine[]>([]);
  const [claimHash, setClaimHash] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);

  const audit = useMemo(() => parseAudit(g.audit_report), [g.audit_report]);
  const reason = inconclusiveReason(g.audit_report);
  const spec = useMemo(() => parseSpec(g.spec_criteria), [g.spec_criteria]);
  const sig = signalsOf(g, audit);
  const settled = g.status === "APPROVED" || g.status === "REJECTED" || g.status === "DISPUTED";
  const canEvaluate = g.status === "DELIVERED";
  const running = phase === "signing" || phase === "consensus";

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
  }, [g.repo_url, g.commit_sha]); // eslint-disable-line react-hooks/exhaustive-deps

  const lines = useMemo(
    () => [...previewLines(g, evidence, evidenceError), ...chainLines, ...(settled ? onchainLines(g, audit, reason) : [])],
    [g, evidence, evidenceError, chainLines, settled, audit, reason],
  );

  const push = (l: TLine) => setChainLines((p) => [...p, l]);

  const trigger = async () => {
    if (!account) return onConnect();
    setError(null);
    setChainLines([]);
    setRunKey((k) => k + 1); // restart the log from the first line
    try {
      const out = await evaluateMilestone(account, g.grant_id, (p) => {
        setPhase(p.phase);
        if (p.phase === "signing") push({ kind: "chain", text: "[chain] evaluate_milestone_consensus: waiting for wallet signature" });
        if (p.phase === "consensus") push({ kind: "chain", text: `[chain] tx ${short(p.hash ?? "", 10, 6)} broadcast: validators fetch the commit and CI independently` });
        if (p.phase === "done") push({ kind: "chain", text: "[chain] consensus decided: reading the settled record" });
      });
      setTxHash(out.hash);
      push({ kind: "ok", text: `[chain] decided (${out.status}). Escrow settlement applied by the contract.` });
      onSettled();
    } catch (e) {
      setPhase("idle");
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      push({ kind: "err", text: `[chain] ${msg}` });
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

  const done = settled || phase === "done";
  const s1: StepState = done || phase === "consensus" ? "done" : phase === "signing" ? "active" : "idle";
  const s2: StepState = done ? "done" : phase === "consensus" ? "active" : "idle";
  const s3: StepState = done ? "done" : "idle";
  const patch = evidence?.files.find((f) => f.patch)?.patch ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-label={`Milestone ${g.title}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rise card w-full max-w-5xl border-zinc-700/80 bg-zinc-900/95 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 p-5">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <StatusBadge status={g.status} />
              <span className="font-mono text-xs text-zinc-500">grant #{g.grant_id}</span>
              <CiBadge ci={sig.ci} />
            </div>
            <h3 className="truncate text-xl font-bold tracking-tight text-white">{g.title}</h3>
            <p className="mt-1 font-mono text-xs text-zinc-400">
              {gen(g.escrow_amount)} GEN escrow · 0.05 GEN bond · {short(g.funder, 6, 4)} → @{g.developer_handle}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <ol className="flex flex-col gap-3 md:flex-row">
              <Step n={1} title="Commit Provenance & Telemetry Ingestion" desc="Scraping the Git tree and GitHub Actions runs; checking author, freshness and workflow edits." state={s1} Icon={ScanSearch} />
              <Step n={2} title="Equivalence Principle Multi-LLM Quorum" desc="Multi-validator rubric evaluation: the model grades inside the evidence-derived corridor." state={s2} Icon={Scale} />
              <Step n={3} title="Autonomous Escrow Settlement" desc={`Pull-payment state transition: score ≥ ${g.threshold_score} releases escrow to the developer, otherwise it returns to the funder.`} state={s3} Icon={Vault} />
            </ol>
            <p className="mt-2 font-mono text-[11px] text-zinc-500">Validators run steps 1 and 2 inside one consensus round, so stage changes here are approximate.</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-5">
            <div className="space-y-3 lg:col-span-3">
              <Terminal lines={lines} runKey={runKey} />
              {g.repo_url && (
                <details className="rounded-lg border border-zinc-800 bg-zinc-950/60 open:pb-3">
                  <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-300 hover:text-white">
                    <FileCode2 className="h-4 w-4 text-emerald-300" /> Commit diff
                    <a href={commitUrl(g.repo_url, g.commit_sha)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="hash ml-auto inline-flex items-center gap-1">
                      {repoSlug(g.repo_url)}@{g.commit_sha.slice(0, 7)} <ExternalLink className="h-3 w-3" />
                    </a>
                  </summary>
                  <pre className="mx-3 max-h-56 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11.5px] leading-relaxed">
                    {(patch ? patch.split("\n").slice(0, 60) : [evidenceError ?? "loading…"]).map((l, i) => (
                      <div key={i} className={l.startsWith("+") ? "text-emerald-300" : l.startsWith("-") ? "text-rose-300" : l.startsWith("@@") ? "text-cyan-300" : "text-zinc-400"}>
                        {l || " "}
                      </div>
                    ))}
                  </pre>
                </details>
              )}
            </div>

            <div className="space-y-4 lg:col-span-2">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                <ScoreMeter score={g.quality_score} threshold={g.threshold_score} evaluated={g.evaluated} size="lg" />
                {audit && <p className="mt-3 font-mono text-[11px] text-zinc-500">corridor [{audit.lo}, {audit.hi}] from measured evidence · tier {audit.tier}</p>}
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="eyebrow mb-2">Commit</div>
                <CommitPill repo={g.repo_url} sha={g.commit_sha} handle={g.developer_handle} author={sig.author} wide />
              </div>
              {spec && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="eyebrow mb-2">Acceptance criteria</div>
                  <div className="flex flex-wrap gap-1.5">
                    {spec.required_methods.map((m) => (
                      <span key={m} className="chip border-zinc-700 bg-zinc-800/40 text-zinc-300">{m}()</span>
                    ))}
                  </div>
                  <ul className="mt-3 space-y-1 font-mono text-[11px] text-zinc-400">
                    <li>files: {spec.required_files.join(", ") || "-"}</li>
                    <li>forbidden: {spec.forbidden_patterns.join(", ") || "-"}</li>
                    <li>invariants: {spec.security_invariants.join(" · ") || "-"}</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-300">{error}</p>}
          {g.status === "DELIVERED" && g.delivered_at > 0 && Date.now() / 1000 > g.delivered_at + 7 * 86400 && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
              Delivered over 7 days ago without a verdict: the funder or developer may call cancel_stuck_delivery to refund escrow and bond. Evaluating now is still possible.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
            <div className="min-w-0 text-xs text-zinc-500">
              {(txHash || claimHash) ? (
                <a href={txUrl((claimHash ?? txHash) as string)} target="_blank" rel="noreferrer" className="hash inline-flex items-center gap-1">
                  tx {short((claimHash ?? txHash) as string, 10, 6)} <ExternalLink className="h-3 w-3" />
                </a>
              ) : canEvaluate ? (
                "Anyone may trigger evaluation. Developers should do it right after submitting."
              ) : (
                `This grant is ${g.status.toLowerCase()}.`
              )}
            </div>
            <div className="flex items-center gap-2">
              {g.status === "APPROVED" && <button type="button" className="btn-ghost" onClick={claim}>Claim payout</button>}
              {canEvaluate && (
                <button type="button" className="btn-primary" onClick={trigger} disabled={running}>
                  {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {running ? (phase === "signing" ? "Confirm in wallet…" : "Quorum deliberating…") : account ? "Run GenVM Evaluation" : hasWallet() ? "Connect wallet to run" : "Run GenVM Evaluation"}
                </button>
              )}
              <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
