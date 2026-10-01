export const CHAIN_ID = 61997;
export const CHAIN_HEX = "0xF22D";
export const RPC_URL = "https://studio-next.genlayer.com/api";
export const EXPLORER = "https://explorer-studio-next.genlayer.com";
export const REPO_URL = "https://github.com/Handik4/CodeProof";
export const GEN = 10n ** 18n;
export const BOND_ATTO = GEN / 20n;

interface DeploymentFile {
  contract_address?: string;
  deploy_tx?: string;
}

// The deployment record is written by scripts/deploy.py. Loaded tolerantly so
// the app still builds (and explains itself) before the first deployment.
const files = import.meta.glob("../../../deployments/studio-next.json", {
  eager: true,
  import: "default",
}) as Record<string, DeploymentFile>;
const recorded: DeploymentFile = Object.values(files)[0] ?? {};

export const CONTRACT_ADDRESS: string =
  (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined) ||
  recorded.contract_address ||
  "";

export const addressUrl = (a: string) => `${EXPLORER}/address/${a}`;
export const txUrl = (h: string) => `${EXPLORER}/tx/${h}`;
