interface Props {
  score: number;
  threshold: number;
  evaluated: boolean;
  size?: "sm" | "lg";
}

// A score bar with the approval threshold drawn as a tick, so "94 vs 85" reads at a glance.
export default function ScoreMeter({ score, threshold, evaluated, size = "sm" }: Props) {
  const pass = evaluated && score >= threshold;
  const tone = !evaluated ? "bg-slate-600" : pass ? "bg-emerald-400" : score >= 40 ? "bg-amber-400" : "bg-rose-500";
  const h = size === "lg" ? "h-3" : "h-1.5";
  return (
    <div className="w-full min-w-[96px]" aria-label={evaluated ? `Score ${score} of 100, threshold ${threshold}` : "Not yet scored"}>
      <div className={`relative ${h} overflow-visible rounded-full bg-slate-800`}>
        <div className={`${h} rounded-full ${tone} transition-all`} style={{ width: `${evaluated ? score : 0}%` }} />
        <span
          className="absolute -top-1 bottom-[-4px] w-px bg-slate-300/70"
          style={{ left: `${threshold}%` }}
          title={`Approval threshold ${threshold}`}
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[11px] text-slate-400">
        <span className={pass ? "text-emerald-300" : ""}>{evaluated ? `${score}/100` : "--/100"}</span>
        <span>min {threshold}</span>
      </div>
    </div>
  );
}
