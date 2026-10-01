import { useEffect, useRef, useState } from "react";
import type { Kind, TLine } from "../lib/evidence";

const COLOR: Record<Kind, string> = {
  cmd: "text-zinc-100",
  info: "text-zinc-400",
  ok: "text-emerald-300",
  warn: "text-amber-300",
  err: "text-rose-300",
  chain: "text-cyan-300",
  onchain: "text-violet-300",
};

// Types lines out one after another. Lines appended later keep typing from where it stopped;
// `runKey` restarts from the top. Reduced-motion users get everything at once.
export default function Terminal({ lines, runKey }: { lines: TLine[]; runKey: number }) {
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const [pos, setPos] = useState({ line: 0, chars: 0 });
  const box = useRef<HTMLDivElement>(null);
  const instant = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => setPos({ line: 0, chars: 0 }), [runKey]);
  useEffect(() => {
    const id = setInterval(() => {
      setPos((p) => {
        const cur = linesRef.current;
        if (p.line >= cur.length) return p;
        const step = instant ? 10_000 : 3;
        if (p.chars + step >= cur[p.line].text.length) return { line: p.line + 1, chars: 0 };
        return { line: p.line, chars: p.chars + step };
      });
    }, 14);
    return () => clearInterval(id);
  }, [instant]);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [pos]);

  const shown = lines.slice(0, Math.min(pos.line + 1, lines.length));
  const typing = pos.line < lines.length;
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/90 shadow-inner">
      <div className="flex items-center gap-1.5 border-b border-zinc-800 bg-zinc-900/80 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-2 font-mono text-[11px] text-zinc-500">verification log</span>
        <span className="ml-auto flex gap-3 font-mono text-[10px] text-zinc-500">
          <span className="text-zinc-400">[preview] local</span>
          <span className="text-cyan-400">[chain] live tx</span>
          <span className="text-violet-400">[on-chain] stored</span>
        </span>
      </div>
      <div ref={box} className="h-64 overflow-y-auto p-3 font-mono text-[12px] leading-relaxed" role="log" aria-live="polite">
        {shown.map((l, i) => {
          const isCur = i === pos.line && typing;
          const text = isCur ? l.text.slice(0, pos.chars) : l.text;
          return (
            <div key={i} className={`${COLOR[l.kind]} whitespace-pre-wrap break-words ${isCur || (i === shown.length - 1 && !typing) ? "caret" : ""}`}>
              {text}
            </div>
          );
        })}
        {lines.length === 0 && <div className="caret text-zinc-500">waiting…</div>}
      </div>
    </div>
  );
}
