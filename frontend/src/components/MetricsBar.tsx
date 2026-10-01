import { Activity, Banknote, Coins, Gauge, ShieldCheck, ShieldAlert } from "lucide-react";
import { gen } from "../lib/format";
import type { Metrics } from "../lib/types";

function Tile({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: React.ReactNode; tone: string }) {
  return (
    <div className="card relative overflow-hidden p-5">
      <div className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl ${tone}`} />
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-3 font-mono text-3xl font-bold tracking-tight text-white">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export default function MetricsBar({ metrics }: { metrics: Metrics | null }) {
  const m = metrics;
  const mean = m && m.evaluated_count > 0 ? (m.mean_quality_score_x100 / 100).toFixed(1) : "--";
  return (
    <section aria-label="Escrow metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Tile
        icon={<Coins className="h-4 w-4 text-emerald-300" />}
        label="Total Grants Funded"
        value={m ? `${gen(m.total_funded)} GEN` : "…"}
        sub={m ? `${m.total_grants} grant${m.total_grants === 1 ? "" : "s"} escrowed` : undefined}
        tone="bg-emerald-500/20"
      />
      <Tile
        icon={<Banknote className="h-4 w-4 text-cyan-300" />}
        label="Capital Autonomously Disbursed"
        value={m ? `${gen(m.total_disbursed)} GEN` : "…"}
        sub={m ? `${m.approved} milestone${m.approved === 1 ? "" : "s"} approved by consensus` : undefined}
        tone="bg-cyan-500/20"
      />
      <Tile
        icon={<Gauge className="h-4 w-4 text-emerald-300" />}
        label="Mean Audit Quality Score"
        value={mean === "--" ? "--" : `${mean}/100`}
        sub={m ? `${m.evaluated_count} audit${m.evaluated_count === 1 ? "" : "s"} graded` : undefined}
        tone="bg-emerald-500/15"
      />
      <Tile
        icon={<Activity className="h-4 w-4 text-amber-300" />}
        label="Active Arbitrations"
        value={m ? String(m.active_arbitrations) : "…"}
        sub={
          m ? (
            <span className="inline-flex items-center gap-1">
              {m.solvent ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> : <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />}
              {m.solvent ? "escrow fully solvent" : "solvency check failing"}
            </span>
          ) : undefined
        }
        tone="bg-amber-500/15"
      />
    </section>
  );
}
