import { LayoutGrid, Rows3 } from "lucide-react";
import { useMemo, useState } from "react";
import { gen, short } from "../lib/format";
import { parseAudit, signalsOf } from "../lib/telemetry";
import type { Grant } from "../lib/types";
import { CiBadge } from "./MilestoneCard";
import CommitPill from "./CommitPill";
import MilestoneCard from "./MilestoneCard";
import ScoreMeter from "./ScoreMeter";
import StatusBadge from "./StatusBadge";

type Filter = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "OTHER";
const FILTERS: Filter[] = ["ALL", "PENDING", "APPROVED", "REJECTED", "OTHER"];

function matches(g: Grant, f: Filter) {
  if (f === "ALL") return true;
  if (f === "PENDING") return g.status === "DELIVERED" || g.status === "OPEN";
  if (f === "OTHER") return g.status === "DISPUTED" || g.status === "CANCELLED";
  return g.status === f;
}

interface Props {
  grants: Grant[] | null;
  error: string | null;
  onInspect: (g: Grant) => void;
}

export default function MilestoneExplorer({ grants, error, onInspect }: Props) {
  const [view, setView] = useState<"cards" | "table">("cards");
  const [filter, setFilter] = useState<Filter>("ALL");
  const rows = useMemo(() => (grants ?? []).filter((g) => matches(g, filter)).slice().reverse(), [grants, filter]);
  const count = (f: Filter) => (grants ?? []).filter((g) => matches(g, f)).length;

  return (
    <section id="milestones" aria-label="Live milestone explorer" data-testid={grants ? "grants-loaded" : "grants-loading"}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Milestones</h2>
          <p className="text-sm text-zinc-400">Every field is read from the CodeProof contract on Studio Next. Nothing here is mocked.</p>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <div className="flex max-w-full overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/70 p-0.5 text-xs">
            {FILTERS.map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className={`shrink-0 rounded-md px-2.5 py-1 font-medium transition ${filter === f ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"}`}>
                {f}
                {grants && <span className="ml-1 font-mono text-[10px] text-zinc-500">{count(f)}</span>}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-zinc-800 bg-zinc-900/70 p-0.5">
            <button type="button" aria-label="Card view" onClick={() => setView("cards")} className={`rounded-md p-1.5 transition ${view === "cards" ? "bg-zinc-700 text-white" : "text-zinc-400"}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Table view" onClick={() => setView("table")} className={`rounded-md p-1.5 transition ${view === "table" ? "bg-zinc-700 text-white" : "text-zinc-400"}`}>
              <Rows3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {error && <div data-testid="load-error" className="card border-rose-500/30 p-4 text-sm text-rose-300">{error}</div>}
      {!error && grants === null && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="card h-72 animate-pulse" />)}
        </div>
      )}
      {!error && grants !== null && rows.length === 0 && <div className="card p-10 text-center text-sm text-zinc-400">No milestones match this filter yet.</div>}

      {rows.length > 0 && view === "cards" && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((g, i) => <MilestoneCard key={g.grant_id} grant={g} onOpen={onInspect} index={i} />)}
        </div>
      )}

      {rows.length > 0 && view === "table" && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">Milestone</th>
                <th className="px-4 py-3">Commit</th>
                <th className="px-4 py-3">Escrow</th>
                <th className="px-4 py-3">CI</th>
                <th className="w-44 px-4 py-3">Quality</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {rows.map((g) => {
                const sig = signalsOf(g, parseAudit(g.audit_report));
                return (
                  <tr key={g.grant_id} className="transition hover:bg-zinc-800/30">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{g.title}</div>
                      <div className="font-mono text-xs text-zinc-500">#{g.grant_id} · {short(g.funder, 6, 4)} → @{g.developer_handle}</div>
                    </td>
                    <td className="px-4 py-3"><CommitPill repo={g.repo_url} sha={g.commit_sha} handle={g.developer_handle} author={sig.author} /></td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-zinc-200">{gen(g.escrow_amount)} GEN</td>
                    <td className="px-4 py-3"><CiBadge ci={sig.ci} /></td>
                    <td className="px-4 py-3"><ScoreMeter score={g.quality_score} threshold={g.threshold_score} evaluated={g.evaluated} /></td>
                    <td className="px-4 py-3"><StatusBadge status={g.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => onInspect(g)}>
                        {g.status === "DELIVERED" ? "Evaluate" : "Inspect"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
