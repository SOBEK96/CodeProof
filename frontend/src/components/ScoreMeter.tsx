interface Props {
  score: number;
  threshold: number;
  evaluated: boolean;
  size?: "sm" | "lg";
}

// Gradient gauge with the approval threshold drawn as a labelled tick.
export default function ScoreMeter({ score, threshold, evaluated, size = "sm" }: Props) {
  const pass = evaluated && score >= threshold;
  const fill = !evaluated
    ? "bg-zinc-700"
    : pass
      ? "bg-gradient-to-r from-emerald-500 to-cyan-400 shadow-[0_0_14px_rgba(52,211,153,.55)]"
      : score >= 40
        ? "bg-gradient-to-r from-amber-500 to-amber-300"
        : "bg-gradient-to-r from-rose-600 to-rose-400 shadow-[0_0_14px_rgba(251,113,133,.4)]";
  const h = size === "lg" ? "h-3" : "h-2";
  return (
    <div className="w-full min-w-[110px]" role="img" aria-label={evaluated ? `Score ${score} of 100, threshold ${threshold}` : "Not yet scored"}>
      <div className="mb-1.5 flex items-baseline justify-between font-mono">
        <span className={`${size === "lg" ? "text-2xl" : "text-base"} font-bold ${pass ? "text-emerald-300" : evaluated ? "text-zinc-100" : "text-zinc-600"}`}>
          {evaluated ? score : "--"}
          <span className="text-xs font-medium text-zinc-500">/100</span>
        </span>
        <span className="text-[11px] text-zinc-500">threshold {threshold}</span>
      </div>
      <div className={`relative ${h} rounded-full bg-zinc-800/90`}>
        <div className={`${h} rounded-full transition-all duration-700 ${fill}`} style={{ width: `${evaluated ? Math.max(score, 2) : 0}%` }} />
        <span className="absolute -bottom-1 -top-1 w-0.5 rounded bg-zinc-200/80" style={{ left: `calc(${threshold}% - 1px)` }} title={`Approval threshold ${threshold}`} />
      </div>
    </div>
  );
}
