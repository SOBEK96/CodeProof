import type { Grant } from "./types";

// The contract writes a fixed-format audit report. Everything the cards show about
// CI, methods, files and authorship is read back from it, never guessed.
export interface Audit {
  score: number;
  lo: number;
  hi: number;
  tier: string;
  files: number;
  additions: number;
  deletions: number;
  reqFiles: [number, number];
  methods: [number, number];
  ciOk: number;
  ciFail: number;
  forbidden: number;
  malicious: number;
  workflowEdited: boolean;
  rationale: string;
}

const AUDIT_RE =
  /^score=(\d+)\/100 corridor=\[(\d+),(\d+)\] tier=(\w+) files=(\d+) \+(\d+)\/-(\d+) req_files=(\d+)\/(\d+) methods=(\d+)\/(\d+) ci=(\d+)ok\/(\d+)fail forbidden=(\d+) malicious=(\d+) workflow_edited=(\d) \| ([\s\S]*)$/;

export function parseAudit(report: string): Audit | null {
  const m = AUDIT_RE.exec(report ?? "");
  if (!m) return null;
  const n = (i: number) => Number(m[i]);
  return {
    score: n(1), lo: n(2), hi: n(3), tier: m[4], files: n(5), additions: n(6), deletions: n(7),
    reqFiles: [n(8), n(9)], methods: [n(10), n(11)], ciOk: n(12), ciFail: n(13),
    forbidden: n(14), malicious: n(15), workflowEdited: n(16) === 1, rationale: m[17],
  };
}

export function inconclusiveReason(report: string): string | null {
  const m = /^INCONCLUSIVE: ([A-Z_]+)/.exec(report ?? "");
  return m ? m[1] : null;
}

export type Tri = "ok" | "bad" | "unknown";

export interface Signals {
  author: Tri; // commit author bound to the registered handle
  ci: "passed" | "failed" | "untrusted" | "none" | "unverified";
  methods: { state: Tri; label: string };
  files: { state: Tri; label: string };
}

// A grant that was graded necessarily passed the authorship and freshness gates:
// otherwise the contract would have settled it as DISPUTED instead.
export function signalsOf(g: Grant, a: Audit | null): Signals {
  const reason = inconclusiveReason(g.audit_report);
  const author: Tri = a ? "ok" : reason === "ERR_UNAUTHORIZED_AUTHOR" ? "bad" : "unknown";
  if (!a) {
    return {
      author,
      ci: "unverified",
      methods: { state: "unknown", label: "methods pending" },
      files: { state: "unknown", label: "files pending" },
    };
  }
  const ci: Signals["ci"] = a.workflowEdited ? "untrusted" : a.ciFail > 0 ? "failed" : a.ciOk > 0 ? "passed" : "none";
  return {
    author,
    ci,
    methods: { state: a.methods[0] === a.methods[1] ? "ok" : "bad", label: `methods ${a.methods[0]}/${a.methods[1]}` },
    files: { state: a.reqFiles[0] === a.reqFiles[1] ? "ok" : "bad", label: `files ${a.reqFiles[0]}/${a.reqFiles[1]}` },
  };
}
