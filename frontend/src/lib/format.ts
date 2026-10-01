import { GEN } from "./config";
import type { Spec } from "./types";

export function gen(atto: string | bigint, digits = 2): string {
  const v = typeof atto === "bigint" ? atto : BigInt(atto || "0");
  const whole = v / GEN;
  const frac = ((v % GEN) * 10n ** BigInt(digits)) / GEN;
  return `${whole.toString()}.${frac.toString().padStart(digits, "0")}`;
}

export const short = (s: string, head = 8, tail = 6) =>
  s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;

export function repoSlug(url: string): string {
  return url.replace(/^https:\/\/github\.com\//, "");
}

export function commitUrl(repo: string, sha: string): string {
  return `${repo.replace(/\/$/, "")}/commit/${sha}`;
}

export function parseSpec(raw: string): Spec | null {
  try {
    return JSON.parse(raw) as Spec;
  } catch {
    return null;
  }
}

export function ago(ts: number): string {
  if (!ts) return "-";
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 90) return "just now";
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 129600) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
