import { Activity, Banknote, Gauge, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { gen } from "../lib/format";
import type { Metrics } from "../lib/types";

function TokenBadge() {
  return <span className="rounded border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">GEN</span>;
}

function Card({ icon, label, children, glow, delay }: { icon: React.ReactNode; label: string; children: React.ReactNode; glow: string; delay: number }) {
  return (
    <div className="card card-hover rise group relative overflow-hidden p-5" style={{ animationDelay: `${delay}ms` }}>
      <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl transition-opacity duration-300 group-hover:opacity-100 ${glow} opacity-70`} />
      <div className="relative flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
        {icon}
        {label}
      </div>
      <div className="relative mt-3">{children}</div>
    </div>
  );
}

// Radial progress for the mean quality score (0-100).
function Radial({ value }: { value: number | null }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" role="img" aria-label={value === null ? "No audits yet" : `Mean quality ${value.toFixed(1)} of 100`}>
      <defs>
        <linearGradient id="rg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <circle cx="34" cy="34" r={r} fill="none" stroke="#27272a" strokeWidth="6" />
      <circle cx="34" cy="34" r={r} fill="none" stroke="url(#rg)" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 34 34)"
        style={{ transition: "stroke-dashoffset .9s ease", filter: "drop-shadow(0 0 5px rgba(52,211,153,.5))" }} />
    </svg>
  );
}

export default function MetricsBar({ metrics }: { metrics: Metrics | null }) {
  const m = metrics;
  const mean = m && m.evaluated_count > 0 ? m.mean_quality_score_x100 / 100 : null;
  const big = "font-mono text-3xl font-bold tracking-tight text-white";
  return (
    <section aria-label="Protocol stats" className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card icon={<Lock className="h-4 w-4 text-emerald-300" />} label="Total Grant TVL Locked" glow="bg-emerald-500/25" delay={0}>
        <div className="flex items-baseline gap-2">
          <span className={big}>{m ? gen(m.locked_escrow) : "…"}</span>
          <TokenBadge />
        </div>
        <p className="mt-1 text-xs text-zinc-500">{m ? `${gen(m.total_funded)} GEN funded in total · ${m.total_grants} grant${m.total_grants === 1 ? "" : "s"}` : "reading chain…"}</p>
      </Card>

      <Card icon={<Banknote className="h-4 w-4 text-cyan-300" />} label="Autonomous Payouts Settled" glow="bg-cyan-500/25" delay={60}>
        <div className="flex items-baseline gap-2">
          <span className={big}>{m ? gen(m.total_disbursed) : "…"}</span>
          <TokenBadge />
        </div>
        <p className="mt-1 text-xs text-zinc-500">{m ? `${m.approved} milestone${m.approved === 1 ? "" : "s"} approved by validator consensus` : "reading chain…"}</p>
      </Card>

      <Card icon={<Gauge className="h-4 w-4 text-emerald-300" />} label="Avg Milestone Quality Score" glow="bg-emerald-500/20" delay={120}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className={big}>
              {mean === null ? "--" : mean.toFixed(1)}
              <span className="text-sm font-medium text-zinc-500">/100</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">{m ? `${m.evaluated_count} audit${m.evaluated_count === 1 ? "" : "s"} graded` : "reading chain…"}</p>
          </div>
          <Radial value={mean} />
        </div>
      </Card>

      <Card icon={<Activity className="h-4 w-4 text-amber-300" />} label="Active Quorum Arbitrations" glow="bg-amber-500/20" delay={180}>
        <div className="flex items-baseline gap-2">
          <span className={big}>{m ? m.active_arbitrations : "…"}</span>
          {m && m.active_arbitrations > 0 && <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] text-amber-300">awaiting quorum</span>}
        </div>
        <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
          {m ? (
            <>
              {m.solvent ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> : <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />}
              {m.solvent ? "escrow fully solvent" : "solvency check failing"}
            </>
          ) : (
            "reading chain…"
          )}
        </p>
      </Card>
    </section>
  );
}
