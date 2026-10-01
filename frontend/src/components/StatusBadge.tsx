import { CheckCircle2, CircleDashed, Gavel, Hourglass, XCircle } from "lucide-react";
import type { Status } from "../lib/types";

const MAP: Record<Status, { label: string; cls: string; Icon: typeof XCircle }> = {
  APPROVED: { label: "APPROVED", cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300 shadow-[0_0_18px_-4px_rgba(52,211,153,.55)]", Icon: CheckCircle2 },
  REJECTED: { label: "REJECTED", cls: "border-rose-400/40 bg-rose-400/10 text-rose-300 shadow-[0_0_18px_-4px_rgba(251,113,133,.5)]", Icon: XCircle },
  DELIVERED: { label: "PENDING", cls: "border-amber-400/40 bg-amber-400/10 text-amber-300 shadow-[0_0_18px_-4px_rgba(251,191,36,.5)]", Icon: Hourglass },
  OPEN: { label: "OPEN", cls: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300", Icon: CircleDashed },
  DISPUTED: { label: "DISPUTED", cls: "border-violet-400/40 bg-violet-400/10 text-violet-300 shadow-[0_0_18px_-4px_rgba(167,139,250,.5)]", Icon: Gavel },
  CANCELLED: { label: "CANCELLED", cls: "border-zinc-600/40 bg-zinc-600/10 text-zinc-400", Icon: XCircle },
};

export default function StatusBadge({ status }: { status: Status }) {
  const { label, cls, Icon } = MAP[status] ?? MAP.OPEN;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${cls}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}
