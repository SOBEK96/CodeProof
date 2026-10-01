import { createClient, chains } from "genlayer-js";
import { BOND_ATTO, CHAIN_HEX, CHAIN_ID, CONTRACT_ADDRESS, EXPLORER, RPC_URL } from "./config";
import type { Grant, Metrics } from "./types";

type Hex = `0x${string}`;
interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

const chain = {
  ...chains.studioDevnet,
  rpcUrls: { default: { http: [RPC_URL] } },
};

// Account-less client: GenLayer answers views over gen_call, so the HUD shows
// live protocol state before any wallet is connected.
const reader = createClient({ chain });

const ethereum = (): Eip1193 | undefined =>
  (globalThis as unknown as { ethereum?: Eip1193 }).ethereum;

export const hasWallet = () => ethereum() !== undefined;

async function view<T>(fn: string, args: unknown[] = []): Promise<T> {
  const out = await reader.readContract({
    address: CONTRACT_ADDRESS as Hex,
    functionName: fn,
    args: args as never,
    jsonSafeReturn: true,
  });
  return out as T;
}

export async function loadAll(): Promise<{ grants: Grant[]; metrics: Metrics }> {
  const [grants, metrics] = await Promise.all([
    view<Grant[]>("get_all_grants"),
    view<Metrics>("get_protocol_metrics"),
  ]);
  return { grants, metrics };
}

export async function connectWallet(): Promise<string> {
  const eth = ethereum();
  if (!eth) throw new Error("No injected wallet found. Install MetaMask or a compatible wallet.");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
  } catch {
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: CHAIN_HEX,
          chainName: "GenLayer Studio Next",
          nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
          rpcUrls: [RPC_URL],
          blockExplorerUrls: [EXPLORER],
        },
      ],
    });
  }
  if (!accounts[0]) throw new Error("Wallet returned no account.");
  return accounts[0];
}

export interface TxProgress {
  phase: "signing" | "consensus" | "done";
  hash?: string;
}

// Trigger the on-chain milestone evaluation. Every write carries the Studio
// Next fee distribution estimated from the live fee policy.
export async function evaluateMilestone(
  account: string,
  grantId: number,
  onProgress: (p: TxProgress) => void,
): Promise<{ hash: string; status: string }> {
  const eth = ethereum();
  if (!eth) throw new Error("No injected wallet found.");
  const client = createClient({ chain, account: account as Hex, provider: eth as never });
  onProgress({ phase: "signing" });
  const fees = await client.estimateTransactionFees({});
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS as Hex,
    functionName: "evaluate_milestone_consensus",
    args: [grantId],
    value: 0n,
    fees,
  });
  onProgress({ phase: "consensus", hash: String(hash) });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    waitUntil: "decided",
    interval: 4000,
    retries: 150,
  } as never);
  onProgress({ phase: "done", hash: String(hash) });
  const r = receipt as unknown as { txExecutionResultName?: string; result_name?: string };
  if (r.txExecutionResultName && r.txExecutionResultName !== "FINISHED_WITH_RETURN") {
    throw new Error(`Execution ${r.txExecutionResultName}`);
  }
  return { hash: String(hash), status: r.result_name ?? "DECIDED" };
}

export async function claimPayout(account: string, grantId: number): Promise<string> {
  const eth = ethereum();
  if (!eth) throw new Error("No injected wallet found.");
  const client = createClient({ chain, account: account as Hex, provider: eth as never });
  const fees = await client.estimateTransactionFees({});
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS as Hex,
    functionName: "claim_payout",
    args: [grantId],
    value: 0n,
    fees,
  });
  return String(hash);
}

export { BOND_ATTO, CHAIN_ID };
