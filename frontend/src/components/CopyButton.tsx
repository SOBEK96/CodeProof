import { Check, Copy } from "lucide-react";
import { useState } from "react";

export default function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    } catch {
      setDone(false); // clipboard blocked: stay silent rather than throw
    }
  };
  return (
    <button type="button" onClick={copy} aria-label={`${label}: ${value}`} title={done ? "Copied" : label}
      className="rounded p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200">
      {done ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
