import { FileCheck2, Loader2, Wallet } from "lucide-react";
import { short } from "../lib/format";

interface Props {
  account: string | null;
  connecting: boolean;
  onConnect: () => void;
}

export default function Navbar({ account, connecting, onConnect }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-ink-950/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl flex-nowrap items-center justify-between gap-3 whitespace-nowrap px-4 sm:px-6">
        <a href="#top" className="flex flex-nowrap items-center gap-2.5 whitespace-nowrap">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-400/40 shadow-glow">
            <FileCheck2 className="h-5 w-5 text-emerald-300" aria-hidden />
          </span>
          <span className="text-lg font-bold tracking-tight text-white">CodeProof</span>
        </a>

        <div className="flex flex-nowrap items-center gap-3 whitespace-nowrap">
          <span className="flex items-center gap-2 whitespace-nowrap rounded-full border border-cyan-400/30 bg-cyan-400/5 px-3 py-1 font-mono text-xs text-cyan-200">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,.9)]" />
            <span className="hidden sm:inline">Studio Next (61997)</span>
            <span className="sm:hidden">61997</span>
          </span>
          <button
            type="button"
            onClick={onConnect}
            disabled={connecting || account !== null}
            className="btn-primary !px-3.5 !py-2"
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Wallet className="h-4 w-4" aria-hidden />
            )}
            <span>{account ? short(account, 6, 4) : "Connect Wallet"}</span>
          </button>
        </div>
      </nav>
    </header>
  );
}
