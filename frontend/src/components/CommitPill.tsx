import { BadgeCheck, ExternalLink, GitCommitHorizontal, ShieldAlert } from "lucide-react";
import { commitUrl } from "../lib/format";
import type { Tri } from "../lib/telemetry";
import CopyButton from "./CopyButton";

interface Props {
  repo: string;
  sha: string;
  handle: string;
  author: Tri;
  wide?: boolean;
}

export default function CommitPill({ repo, sha, handle, author, wide }: Props) {
  if (!repo || !sha) return <span className="font-mono text-xs text-zinc-500">awaiting deliverable</span>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950/70 py-0.5 pl-2 pr-0.5">
        <GitCommitHorizontal className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
        <a href={commitUrl(repo, sha)} target="_blank" rel="noreferrer" className="hash min-w-0 truncate hover:text-cyan-200" title={sha}>
          {wide ? sha : sha.slice(0, 7)}
        </a>
        <CopyButton value={sha} label="Copy commit SHA" />
        <a href={commitUrl(repo, sha)} target="_blank" rel="noreferrer" aria-label="Open commit on GitHub"
          className="rounded p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </span>
      {author === "ok" && (
        <span className="chip border-emerald-500/30 bg-emerald-500/10 text-emerald-300" title="Oracle checked: author is the registered handle">
          <BadgeCheck className="h-3.5 w-3.5" /> @{handle}
        </span>
      )}
      {author === "bad" && (
        <span className="chip border-rose-500/30 bg-rose-500/10 text-rose-300" title="Commit author is not the registered handle">
          <ShieldAlert className="h-3.5 w-3.5" /> author mismatch
        </span>
      )}
      {author === "unknown" && (
        <span className="chip border-zinc-700 bg-zinc-800/40 text-zinc-400" title="Authorship is checked when the milestone is evaluated">
          @{handle} · unverified
        </span>
      )}
    </div>
  );
}
