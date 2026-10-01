import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import ComparisonCard from "./components/ComparisonCard";
import EvaluationModal from "./components/EvaluationModal";
import Footer from "./components/Footer";
import MetricsBar from "./components/MetricsBar";
import MilestoneExplorer from "./components/MilestoneExplorer";
import Navbar from "./components/Navbar";
import { connectWallet, loadAll } from "./lib/chain";
import { CONTRACT_ADDRESS } from "./lib/config";
import type { Grant, Metrics } from "./lib/types";

export default function App() {
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!CONTRACT_ADDRESS) {
      setError("No contract address configured. Deploy with scripts/deploy.py or set VITE_CONTRACT_ADDRESS.");
      setGrants([]);
      return;
    }
    try {
      const data = await loadAll();
      // Dev-only (removed from production builds): `?fixture=pending` shows the most recent
      // grant as awaiting evaluation, to exercise the pending-state UI without a transaction.
      if (import.meta.env.DEV && new URLSearchParams(location.search).get("fixture") === "pending" && data.grants.length) {
        const last = data.grants[data.grants.length - 1];
        data.grants[data.grants.length - 1] = { ...last, status: "DELIVERED", evaluated: false, quality_score: 0, audit_report: "" };
      }
      setGrants(data.grants);
      setMetrics(data.metrics);
      setError(null);
    } catch (e) {
      setError(`Could not read the contract on Studio Next: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = async () => {
    setConnecting(true);
    setWalletError(null);
    try {
      setAccount(await connectWallet());
    } catch (e) {
      setWalletError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  };

  const selected = grants?.find((g) => g.grant_id === selectedId) ?? null;

  return (
    <div id="top" className="min-h-screen">
      <Navbar account={account} connecting={connecting} onConnect={connect} />
      {walletError && (
        <div role="alert" data-testid="wallet-error" className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-200">
          {walletError}{" "}
          <button type="button" className="ml-2 underline underline-offset-2 hover:text-white" onClick={() => setWalletError(null)}>Dismiss</button>
        </div>
      )}
      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6">
        <div>
          <p className="eyebrow !text-emerald-300">Autonomous grant escrow · GenLayer Studio Next</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
            Ship the commit. <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">Validators release the funds.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-zinc-400">
            Funders escrow GEN against machine-readable acceptance criteria. A committee of GenVM validators reads the GitHub evidence, grades the milestone under the Equivalence Principle, and settles the escrow at a score of 85 or more.
          </p>
        </div>

        {!CONTRACT_ADDRESS && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Contract not deployed yet.
          </div>
        )}

        <MetricsBar metrics={metrics} />
        <MilestoneExplorer grants={grants} error={error} onInspect={(g) => setSelectedId(g.grant_id)} />
        <ComparisonCard />
      </main>
      <Footer />
      {selected && (
        <EvaluationModal
          key={selected.grant_id}
          grant={selected}
          account={account}
          onConnect={connect}
          onClose={() => setSelectedId(null)}
          onSettled={refresh}
        />
      )}
    </div>
  );
}
