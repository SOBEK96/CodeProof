import { repoSlug } from "./format";
import { parseSpec } from "./format";
import type { Grant } from "./types";

export interface Evidence {
  files: { filename: string; additions: number; deletions: number; patch?: string }[];
  message: string;
  authorLogin: string;
  committerLogin: string;
  authorDate: string;
  committerDate: string;
  checks: { passed: number; failed: number; total: number } | null;
}

const H = { Accept: "application/vnd.github+json" };

// Public GitHub data for one commit. Called only when a milestone is opened, never on
// page load: unauthenticated browsers share a small rate limit.
export async function fetchEvidence(g: Grant): Promise<Evidence> {
  const base = `https://api.github.com/repos/${repoSlug(g.repo_url)}`;
  const res = await fetch(`${base}/commits/${g.commit_sha}`, { headers: H });
  if (!res.ok) {
    throw new Error(res.status === 404 ? "Commit not found on GitHub: validators would fail closed." : `GitHub responded ${res.status} (browsers share a small unauthenticated rate limit).`);
  }
  const data = await res.json();
  let checks: Evidence["checks"] = null;
  try {
    const c = await fetch(`${base}/commits/${g.commit_sha}/check-runs?per_page=100`, { headers: H });
    if (c.ok) {
      const runs = ((await c.json()).check_runs ?? []) as { conclusion: string | null; app?: { slug?: string } }[];
      const actions = runs.filter((r) => r.app?.slug === "github-actions");
      checks = {
        passed: actions.filter((r) => r.conclusion === "success").length,
        failed: actions.filter((r) => ["failure", "timed_out", "cancelled", "action_required"].includes(r.conclusion ?? "")).length,
        total: actions.length,
      };
    }
  } catch {
    checks = null;
  }
  return {
    files: data.files ?? [],
    message: String(data.commit?.message ?? "").split("\n")[0],
    authorLogin: String(data.author?.login ?? ""),
    committerLogin: String(data.committer?.login ?? ""),
    authorDate: String(data.commit?.author?.date ?? ""),
    committerDate: String(data.commit?.committer?.date ?? ""),
    checks,
  };
}

export type Kind = "cmd" | "info" | "ok" | "warn" | "err" | "chain" | "onchain";
export interface TLine {
  kind: Kind;
  text: string;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Approximate, client-side version of the contract's structural declaration check.
function declared(ev: Evidence, name: string): boolean {
  const n = esc(name);
  const rx = [new RegExp(`\\b(?:def|fn|func)\\s+${n}\\s*[(<]`), new RegExp(`\\bfunction\\s+${n}\\s*\\(`), new RegExp(`\\bmodifier\\s+${n}\\b`), new RegExp(`(?<![A-Za-z0-9_$])${n}\\s*[:=]\\s*(?:async\\s*)?(?:function\\b|\\()`)];
  return ev.files.some((f) => (f.patch ?? "").split("\n").filter((l) => l.startsWith("+")).some((l) => rx.some((r) => r.test(l.slice(1)))));
}

// Checks the validators will run, recomputed here from public GitHub data so a person can
// see what is about to be verified. Tagged [preview]: the committee re-fetches everything.
export function previewLines(g: Grant, ev: Evidence | null, error: string | null): TLine[] {
  const out: TLine[] = [{ kind: "cmd", text: `$ codeproof evaluate --grant ${g.grant_id} --commit ${g.commit_sha.slice(0, 7)}` }];
  if (!g.repo_url) return [...out, { kind: "warn", text: "[preview] no deliverable submitted yet" }];
  out.push({ kind: "info", text: `[preview] GET api.github.com/repos/${repoSlug(g.repo_url)}/commits/${g.commit_sha.slice(0, 7)}` });
  if (error || !ev) return [...out, { kind: "warn", text: `[preview] ${error ?? "fetching commit…"}` }];

  const want = g.developer_handle.toLowerCase();
  const aOk = ev.authorLogin.toLowerCase() === want;
  const cOk = [want, "web-flow"].includes(ev.committerLogin.toLowerCase());
  out.push({ kind: aOk ? "ok" : "err", text: `[preview] author      @${ev.authorLogin || "unlinked"}  expected @${g.developer_handle}  ${aOk ? "OK" : "MISMATCH"}` });
  out.push({ kind: cOk ? "ok" : "err", text: `[preview] committer   @${ev.committerLogin || "unlinked"}  allowed @${g.developer_handle} | web-flow  ${cOk ? "OK" : "MISMATCH"}` });

  const ts = (d: string) => Math.floor(Date.parse(d) / 1000);
  const first = Math.min(ts(ev.authorDate), ts(ev.committerDate));
  const fresh = Number.isFinite(first) && first >= g.created_at;
  out.push({ kind: fresh ? "ok" : "err", text: `[preview] freshness   commit ${ev.authorDate || "?"} ${fresh ? ">=" : "<"} grant created ${new Date(g.created_at * 1000).toISOString().slice(0, 19)}Z  ${fresh ? "OK" : "HISTORICAL"}` });

  const add = ev.files.reduce((a, f) => a + f.additions, 0);
  const del = ev.files.reduce((a, f) => a + f.deletions, 0);
  out.push({ kind: "info", text: `[preview] tree        ${ev.files.length} file${ev.files.length === 1 ? "" : "s"} changed (+${add}/-${del})` });

  const spec = parseSpec(g.spec_criteria);
  if (spec) {
    const names = new Set(ev.files.map((f) => f.filename));
    const reqFound = spec.required_files.filter((p) => names.has(p) || [...names].some((n) => n.endsWith("/" + p)));
    out.push({ kind: reqFound.length === spec.required_files.length ? "ok" : "warn", text: `[preview] files      ${reqFound.length}/${spec.required_files.length} required files present` });
    const found = spec.required_methods.filter((m) => declared(ev, m));
    out.push({ kind: found.length === spec.required_methods.length ? "ok" : "warn", text: `[preview] methods    ${found.length}/${spec.required_methods.length} declared (${spec.required_methods.map((m) => m + (found.includes(m) ? "✓" : "✗")).join(" ")}) · approximate` });
  }
  const wf = ev.files.some((f) => f.filename.startsWith(".github/workflows/"));
  out.push({ kind: wf ? "warn" : "ok", text: `[preview] workflows  ${wf ? "commit edits a workflow: its CI will be ignored" : "no workflow edits: CI can be trusted"}` });
  if (ev.checks) out.push({ kind: ev.checks.passed > 0 && ev.checks.failed === 0 && !wf ? "ok" : "warn", text: `[preview] CI         github-actions: ${ev.checks.passed} passed, ${ev.checks.failed} failed` });
  out.push({ kind: "info", text: "[preview] client-side approximation. Every validator re-fetches this independently." });
  return out;
}

// The stored audit report, line by line. Tagged [on-chain]: this is the authoritative record.
export function onchainLines(g: Grant, audit: import("./telemetry").Audit | null, reason: string | null): TLine[] {
  if (audit) {
    const wrap = (s: string) => s.match(/.{1,92}(\s|$)/g)?.map((x) => x.trim()) ?? [s];
    return [
      { kind: "onchain", text: `[on-chain] verdict ${g.status}  score ${audit.score}/100  corridor [${audit.lo},${audit.hi}]  tier ${audit.tier}` },
      { kind: "onchain", text: `[on-chain] files ${audit.files} (+${audit.additions}/-${audit.deletions})  req_files ${audit.reqFiles[0]}/${audit.reqFiles[1]}  methods ${audit.methods[0]}/${audit.methods[1]}` },
      { kind: "onchain", text: `[on-chain] ci ${audit.ciOk} ok / ${audit.ciFail} fail  forbidden ${audit.forbidden}  signatures ${audit.malicious}  workflow_edited ${audit.workflowEdited ? "yes" : "no"}` },
      ...wrap(audit.rationale).map((t) => ({ kind: "onchain" as Kind, text: `[on-chain] ${t}` })),
    ];
  }
  if (reason) return [{ kind: "err", text: `[on-chain] INCONCLUSIVE: ${reason}. Bond refunded, escrow stays locked.` }];
  return [];
}
