import { Bot, Check, Minus, UserRound } from "lucide-react";

const ROWS: [string, string, string][] = [
  ["Decision basis", "Commit, diff and CI telemetry re-fetched by every validator", "A reviewer's reading of a PR link and a demo call"],
  ["Who can influence it", "Nobody: score is clamped into a corridor built from measurements", "Whoever the reviewer knows, trusts or is pressured by"],
  ["Time to settle", "One consensus round (minutes)", "Weeks of back-and-forth between foundation and team"],
  ["Payout", "Released from escrow by the contract, pulled by the developer", "Invoice, committee vote, manual transfer"],
  ["Spam & fraud", "0.05 GEN bond forfeited when score < 40 or commit is empty", "Reviewer time burned on every bad submission"],
  ["Missing evidence", "Fails closed: DISPUTED, bond refunded, escrow stays locked", "Often silently approved or silently stalled"],
  ["Audit trail", "Score, corridor and rationale stored on-chain, immutable", "Private notes and chat logs"],
];

export default function ComparisonCard() {
  return (
    <section aria-label="Autonomous arbitration versus manual review" className="card overflow-hidden">
      <div className="border-b border-zinc-800 p-5">
        <h2 className="text-xl font-bold text-white">Autonomous Grant Arbitration vs Manual Reviews</h2>
        <p className="mt-1 text-sm text-zinc-400">What changes when the milestone verdict is a consensus result instead of a meeting.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider">
            <tr className="border-b border-zinc-800">
              <th className="px-5 py-3 text-zinc-500" />
              <th className="px-5 py-3 text-emerald-300"><span className="inline-flex items-center gap-1.5"><Bot className="h-4 w-4" /> CodeProof (GenVM consensus)</span></th>
              <th className="px-5 py-3 text-zinc-400"><span className="inline-flex items-center gap-1.5"><UserRound className="h-4 w-4" /> Manual review</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {ROWS.map(([k, a, b]) => (
              <tr key={k}>
                <th scope="row" className="px-5 py-3 align-top font-medium text-zinc-300">{k}</th>
                <td className="px-5 py-3 align-top text-zinc-200"><Check className="mr-1.5 inline h-3.5 w-3.5 text-emerald-400" />{a}</td>
                <td className="px-5 py-3 align-top text-zinc-400"><Minus className="mr-1.5 inline h-3.5 w-3.5 text-zinc-600" />{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
