import { BookOpenCheck, Github, ScrollText } from "lucide-react";
import { CONTRACT_ADDRESS, EXPLORER, REPO_URL, addressUrl } from "../lib/config";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-zinc-800 bg-zinc-900/60">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <div className="text-lg font-bold text-white">CodeProof</div>
          <p className="mt-2 text-sm text-zinc-400">Autonomous software-engineering grant escrow and milestone verification oracle on GenLayer Studio Next (chain 61997).</p>
        </div>
        <div className="space-y-2 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Contract</div>
          {CONTRACT_ADDRESS ? (
            <a href={addressUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer" className="hash break-all hover:text-cyan-200">{CONTRACT_ADDRESS}</a>
          ) : (
            <span className="text-zinc-500">not deployed yet - run scripts/deploy.py</span>
          )}
          <a href={EXPLORER} target="_blank" rel="noreferrer" className="block text-zinc-400 hover:text-white">explorer-studio-next.genlayer.com</a>
        </div>
        <div className="space-y-2 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Project</div>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-zinc-300 hover:text-white"><Github className="h-4 w-4" /> GitHub repository</a>
          <a href={`${REPO_URL}/tree/main/tests`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-zinc-300 hover:text-white"><BookOpenCheck className="h-4 w-4" /> Test suite (pytest, 75+ cases)</a>
          <a href={`${REPO_URL}#steward-test-guide`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-zinc-300 hover:text-white"><ScrollText className="h-4 w-4" /> Steward test guide</a>
        </div>
      </div>
    </footer>
  );
}
