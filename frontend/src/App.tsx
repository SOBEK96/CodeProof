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

  const refresh = useCallback(async () => {
    if (!CONTRACT_ADDRESS) {
      setError("No contract address configured. Deploy with scripts/deploy.py or set VITE_CONTRACT_ADDRESS.");
      setGrants([]);
      return;
    }
    try {
      const data = await loadAll();
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
    try {
      setAccount(await connectWallet());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  };

  const selected = grants?.find((g) => g.grant_id === selectedId) ?? null;

  return (
    <div id="top" className="min-h-screen">
      <Navbar account={account} connecting={connecting} onConnect={connect} />
      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-300">Autonomous grant escrow</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
            Ship the commit. <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">Validators release the funds.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-slate-400">
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
          key={selected.grant_id + selected.status}
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
