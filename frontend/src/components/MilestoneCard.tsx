import { ArrowRight, BadgeCheck, CircleSlash, FileCheck2, Play, ScanSearch, ShieldAlert, ShieldQuestion, Workflow } from "lucide-react";
import { useMemo } from "react";
import { ago, gen, parseSpec, short } from "../lib/format";
import { parseAudit, signalsOf, type Tri } from "../lib/telemetry";
import type { Grant } from "../lib/types";
import CommitPill from "./CommitPill";
import ScoreMeter from "./ScoreMeter";
import StatusBadge from "./StatusBadge";

const TONE: Record<Tri, string> = {
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  bad: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  unknown: "border-zinc-700 bg-zinc-800/40 text-zinc-400",
};

export function CiBadge({ ci }: { ci: ReturnType<typeof signalsOf>["ci"] }) {
  const map = {
    passed: { t: "CI: Passed", c: TONE.ok, I: Workflow, h: "GitHub Actions check-runs succeeded" },
    failed: { t: "CI: Failed", c: TONE.bad, I: ShieldAlert, h: "A GitHub Actions check-run failed" },
    untrusted: { t: "CI: Untrusted", c: "border-amber-500/30 bg-amber-500/10 text-amber-300", I: ShieldQuestion, h: "The commit edits a workflow, so its CI is ignored" },
    none: { t: "CI: None", c: TONE.bad, I: CircleSlash, h: "No authentic GitHub Actions run was found" },
    unverified: { t: "CI: unverified", c: TONE.unknown, I: ShieldQuestion, h: "Read by the validators when the milestone is evaluated" },
  }[ci];
  return (
    <span className={`chip ${map.c}`} title={map.h}>
      <map.I className="h-3.5 w-3.5" /> {map.t}
    </span>
  );
}

interface Props {
  grant: Grant;
  onOpen: (g: Grant) => void;
  index: number;
}

export default function MilestoneCard({ grant: g, onOpen, index }: Props) {
  const audit = useMemo(() => parseAudit(g.audit_report), [g.audit_report]);
  const sig = signalsOf(g, audit);
  const spec = useMemo(() => parseSpec(g.spec_criteria), [g.spec_criteria]);
  const pending = g.status === "DELIVERED";

  return (
    <article className="card card-hover rise group flex min-w-0 flex-col gap-4 p-5 hover:shadow-glow" style={{ animationDelay: `${index * 50}ms` }}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold leading-snug text-white" title={g.title}>{g.title}</h3>
          <p className="mt-0.5 font-mono text-xs text-zinc-500">grant #{g.grant_id} · {ago(g.created_at)}</p>
        </div>
        <StatusBadge status={g.status} />
      </header>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="font-mono">
          <span className="text-2xl font-bold text-white">{gen(g.escrow_amount, 1)}</span>
          <span className="ml-1.5 rounded border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">GEN</span>
          <span className="ml-2 text-xs text-zinc-500">escrow</span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-zinc-400">
          <span title={g.funder}>{short(g.funder, 6, 4)}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" aria-hidden />
          <span className="truncate text-zinc-200" title={g.developer}>@{g.developer_handle}</span>
        </div>
      </div>

      <CommitPill repo={g.repo_url} sha={g.commit_sha} handle={g.developer_handle} author={sig.author} />

      <div className="space-y-2">
        <div className="eyebrow">Acceptance criteria</div>
        <div className="flex flex-wrap gap-1.5">
          {(spec?.required_methods ?? []).map((m) => (
            <span key={m} className={`chip ${TONE[sig.methods.state]}`} title={sig.methods.state === "ok" ? "All required methods are declared" : "Required method"}>
              {m}()
            </span>
          ))}
          <CiBadge ci={sig.ci} />
          <span className={`chip ${TONE[sig.files.state]}`}><FileCheck2 className="h-3.5 w-3.5" /> {sig.files.label}</span>
          {audit && audit.forbidden + audit.malicious > 0 && (
            <span className={`chip ${TONE.bad}`}><ShieldAlert className="h-3.5 w-3.5" /> {audit.forbidden} forbidden · {audit.malicious} signatures</span>
          )}
        </div>
      </div>

      <ScoreMeter score={g.quality_score} threshold={g.threshold_score} evaluated={g.evaluated} />

      <button type="button" onClick={() => onOpen(g)} className={`mt-auto ${pending ? "btn-primary" : "btn-ghost"}`}>
        {pending ? <Play className="h-4 w-4" aria-hidden /> : <ScanSearch className="h-4 w-4" aria-hidden />}
        {pending ? "Evaluate Milestone" : "Inspect milestone"}
      </button>
      {g.status === "APPROVED" && (
        <p className="-mt-2 flex items-center gap-1 font-mono text-[11px] text-emerald-400/80"><BadgeCheck className="h-3.5 w-3.5" /> escrow released to @{g.developer_handle}</p>
      )}
    </article>
  );
}
