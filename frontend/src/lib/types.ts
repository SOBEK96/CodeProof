export type Status = "OPEN" | "DELIVERED" | "APPROVED" | "REJECTED" | "DISPUTED" | "CANCELLED";

export interface Spec {
  required_files: string[];
  required_methods: string[];
  min_coverage: number;
  forbidden_patterns: string[];
  security_invariants: string[];
  architecture: string;
}

export interface Grant {
  grant_id: number;
  funder: string;
  developer: string;
  developer_handle: string;
  title: string;
  escrow_amount: string;
  threshold_score: number;
  spec_criteria: string;
  repo_url: string;
  commit_sha: string;
  quality_score: number;
  audit_report: string;
  status: Status;
  developer_bond: string;
  created_at: number;
  delivered_at: number;
  attempts: number;
  evaluated: boolean;
}

export interface Metrics {
  total_grants: number;
  total_funded: string;
  total_disbursed: string;
  mean_quality_score_x100: number;
  evaluated_count: number;
  active_arbitrations: number;
  approved: number;
  rejected: number;
  disputed: number;
  locked_escrow: string;
  locked_bonds: string;
  total_claimable: string;
  treasury: string;
  balance: string;
  solvent: boolean;
}
