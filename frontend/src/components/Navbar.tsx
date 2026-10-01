import { ExternalLink, Loader2, SquareTerminal, Wallet } from "lucide-react";
import { CONTRACT_ADDRESS, EXPLORER, addressUrl } from "../lib/config";
import { short } from "../lib/format";

interface Props {
  account: string | null;
  connecting: boolean;
  onConnect: () => void;
}

export default function Navbar({ account, connecting, onConnect }: Props) {
  const explorer = CONTRACT_ADDRESS ? addressUrl(CONTRACT_ADDRESS) : EXPLORER;
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/70 bg-zinc-950/75 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl flex-nowrap items-center justify-between gap-3 whitespace-nowrap px-4 sm:px-6">
        <a href="#top" className="group flex flex-nowrap items-center gap-2.5 whitespace-nowrap">
          <span className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-400/30 bg-emerald-500/10 shadow-glow transition group-hover:bg-emerald-500/20">
            <SquareTerminal className="h-[18px] w-[18px] text-emerald-300" aria-hidden />
          </span>
          <span className="text-[17px] font-bold tracking-tight text-white">CodeProof</span>
        </a>

        <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap sm:gap-3">
          <span className="flex items-center gap-2 whitespace-nowrap rounded-full border border-emerald-400/25 bg-emerald-400/5 px-2.5 py-1 sm:px-3 font-mono text-xs text-emerald-200">
            <span className="pulse-dot h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            <span className="hidden sm:inline">Studio Next • 61997</span>
            <span className="sm:hidden">61997</span>
          </span>
          <a
            href={explorer}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800/70 hover:text-white md:inline-flex"
          >
            Contract Explorer <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
          <button
            type="button"
            onClick={onConnect}
            disabled={connecting || account !== null}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-emerald-400/40 bg-gradient-to-b from-emerald-400 to-emerald-500 px-3 py-2 sm:px-3.5 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-emerald-300 hover:to-emerald-400 active:scale-[.98] disabled:cursor-default disabled:opacity-90"
          >
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Wallet className="h-4 w-4" aria-hidden />}
            <span>{account ? short(account, 6, 4) : <><span className="sm:hidden">Connect</span><span className="hidden sm:inline">Connect Wallet</span></>}</span>
          </button>
        </div>
      </nav>
    </header>
  );
}
