import { ExternalLink, GitCommitHorizontal, LayoutGrid, Rows3 } from "lucide-react";
import { useMemo, useState } from "react";
import { commitUrl, gen, repoSlug, short } from "../lib/format";
import type { Grant } from "../lib/types";
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
  const [view, setView] = useState<"table" | "cards">("table");
  const [filter, setFilter] = useState<Filter>("ALL");
  const rows = useMemo(() => (grants ?? []).filter((g) => matches(g, filter)).slice().reverse(), [grants, filter]);

  return (
    <section id="milestones" aria-label="Live milestone explorer" data-testid={grants ? "grants-loaded" : "grants-loading"}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Live Milestone Explorer</h2>
          <p className="text-sm text-slate-400">Every row is read straight from the CodeProof contract on Studio Next.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-800 bg-ink-900 p-0.5 text-xs">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-md px-2.5 py-1 font-medium transition ${filter === f ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-slate-800 bg-ink-900 p-0.5">
            <button type="button" aria-label="Table view" onClick={() => setView("table")} className={`rounded-md p-1.5 ${view === "table" ? "bg-slate-700 text-white" : "text-slate-400"}`}>
              <Rows3 className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Card view" onClick={() => setView("cards")} className={`rounded-md p-1.5 ${view === "cards" ? "bg-slate-700 text-white" : "text-slate-400"}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {error && <div className="card border-rose-500/30 p-4 text-sm text-rose-300">{error}</div>}
      {!error && grants === null && <div className="card animate-pulse p-10 text-center text-sm text-slate-400">Reading grants from chain…</div>}
      {!error && grants !== null && rows.length === 0 && (
        <div className="card p-10 text-center text-sm text-slate-400">No milestones match this filter yet.</div>
      )}

      {rows.length > 0 && view === "table" && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Milestone</th>
                <th className="px-4 py-3">Repository / Commit</th>
                <th className="px-4 py-3">Escrow</th>
                <th className="w-44 px-4 py-3">Quality vs threshold</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {rows.map((g) => (
                <tr key={g.grant_id} className="transition hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white">{g.title}</div>
                    <div className="font-mono text-xs text-slate-500">grant #{g.grant_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    {g.repo_url ? (
                      <>
                        <a href={g.repo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-slate-200 hover:text-emerald-300">
                          {repoSlug(g.repo_url)} <ExternalLink className="h-3 w-3" />
                        </a>
                        <a href={commitUrl(g.repo_url, g.commit_sha)} target="_blank" rel="noreferrer" className="hash mt-0.5 flex items-center gap-1">
                          <GitCommitHorizontal className="h-3.5 w-3.5" /> {short(g.commit_sha, 7, 4)}
                        </a>
                      </>
                    ) : (
                      <span className="text-slate-500">awaiting deliverable</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-200">{gen(g.escrow_amount)} GEN</td>
                  <td className="px-4 py-3">
                    <ScoreMeter score={g.quality_score} threshold={g.threshold_score} evaluated={g.evaluated} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={g.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => onInspect(g)}>
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && view === "cards" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((g) => (
            <article key={g.grant_id} className="card flex flex-col gap-4 p-5 transition hover:border-emerald-500/40 hover:shadow-glow">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold leading-snug text-white">{g.title}</h3>
                  <p className="font-mono text-xs text-slate-500">grant #{g.grant_id}</p>
                </div>
                <StatusBadge status={g.status} />
              </div>
              <div className="font-mono text-2xl font-bold text-white">
                {gen(g.escrow_amount)} <span className="text-sm font-medium text-slate-400">GEN in escrow</span>
              </div>
              <ScoreMeter score={g.quality_score} threshold={g.threshold_score} evaluated={g.evaluated} />
              <div className="space-y-1 text-sm">
                {g.repo_url ? (
                  <>
                    <a href={g.repo_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-slate-300 hover:text-emerald-300">
                      {repoSlug(g.repo_url)} <ExternalLink className="h-3 w-3" />
                    </a>
                    <a href={commitUrl(g.repo_url, g.commit_sha)} target="_blank" rel="noreferrer" className="hash flex items-center gap-1">
                      <GitCommitHorizontal className="h-3.5 w-3.5" /> {short(g.commit_sha, 10, 6)}
                    </a>
                  </>
                ) : (
                  <span className="text-slate-500">awaiting deliverable</span>
                )}
              </div>
              <button type="button" className="btn-ghost mt-auto" onClick={() => onInspect(g)}>
                Inspect milestone
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
