"use client";

import { ProvenanceBadge } from "../provenance-badge";

interface CommitmentTabProps {
  onSelectEntity: (id: string) => void;
}

export const CommitmentTab = ({ onSelectEntity }: CommitmentTabProps) => {
  return (
    <div className="space-y-3 p-3 text-xs">
      <section>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">Commitment C-88</span>
          <ProvenanceBadge kind="ill">illus→sim</ProvenanceBadge>
        </div>
        <div className="text-zinc-500 text-[11px]">
          Committed atomically · engine v3815 · 14:05:02
        </div>
      </section>

      {/* Metadata */}
      <dl className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1 text-xs border-y border-zinc-200 py-2 dark:border-zinc-800">
        <dt className="text-zinc-500">Task</dt>
        <dd className="text-zinc-800 dark:text-zinc-200">
          Relocate{" "}
          <button
            type="button"
            onClick={() => onSelectEntity("T-2291")}
            className="font-mono text-blue-600 underline"
          >
            T-2291
          </button>{" "}
          from{" "}
          <button
            type="button"
            onClick={() => onSelectEntity("D-108")}
            className="font-mono text-amber-600 underline"
          >
            D-108
          </button>{" "}
          →{" "}
          <button
            type="button"
            onClick={() => onSelectEntity("D-112")}
            className="font-mono text-blue-600 underline"
          >
            D-112
          </button>
          , resume unload (13 of 22 pallets left)
        </dd>

        <dt className="text-zinc-500">Expiry</dt>
        <dd className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
          Offer M-311 expires 14:12 · accepted 14:04:40
        </dd>

        <dt className="text-zinc-500">Outcome</dt>
        <dd className="text-emerald-700 dark:text-emerald-400 font-medium">
          In progress · A-902 move started 14:06:10 · arrival pending
        </dd>
      </dl>

      {/* Participants */}
      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
          Participating Agents
        </div>
        <table className="w-full text-xs border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            <tr className="bg-zinc-50/50 dark:bg-zinc-950/20">
              <td className="px-2 py-1 font-mono font-medium">DRV-047</td>
              <td className="px-2 py-1 text-zinc-500">driver</td>
              <td className="px-2 py-1 text-emerald-600">accepted M-312</td>
            </tr>
            <tr>
              <td className="px-2 py-1 font-mono font-medium">DOCK-C</td>
              <td className="px-2 py-1 text-zinc-500">dock lead</td>
              <td className="px-2 py-1 text-blue-600">offered M-311</td>
            </tr>
            <tr className="bg-zinc-50/50 dark:bg-zinc-950/20">
              <td className="px-2 py-1 font-mono font-medium">YARD-1</td>
              <td className="px-2 py-1 text-zinc-500">yard ctrl</td>
              <td className="px-2 py-1 text-emerald-600">accepted M-313</td>
            </tr>
            <tr>
              <td className="px-2 py-1 font-mono font-medium">CREW-3</td>
              <td className="px-2 py-1 text-zinc-500">crew lead</td>
              <td className="px-2 py-1 text-emerald-600">accepted M-314</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Reserved Resources */}
      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
          Resource Reservations
        </div>
        <table className="w-full text-xs border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            <tr className="bg-zinc-50/50 dark:bg-zinc-950/20">
              <td className="px-2 py-1 font-mono">
                <button
                  type="button"
                  onClick={() => onSelectEntity("D-112")}
                  className="text-blue-600 underline font-mono"
                >
                  D-112
                </button>
              </td>
              <td className="px-2 py-1 font-mono text-zinc-500">14:20–15:05</td>
              <td className="px-2 py-1 text-emerald-600 font-medium">
                reserved
              </td>
            </tr>
            <tr>
              <td className="px-2 py-1 font-mono">
                <button
                  type="button"
                  onClick={() => onSelectEntity("YT-2")}
                  className="text-blue-600 underline font-mono"
                >
                  YT-2
                </button>
              </td>
              <td className="px-2 py-1 font-mono text-zinc-500">14:06–14:20</td>
              <td className="px-2 py-1 text-blue-600 font-medium">
                in use (A-902)
              </td>
            </tr>
            <tr className="bg-zinc-50/50 dark:bg-zinc-950/20">
              <td className="px-2 py-1 font-mono">CR-3</td>
              <td className="px-2 py-1 font-mono text-zinc-500">14:20–15:05</td>
              <td className="px-2 py-1 text-emerald-600 font-medium">
                reserved
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Negotiation Rejections */}
      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
          Prior Rejections
        </div>
        <div className="rounded-md border border-red-200 bg-red-50/40 p-2 dark:border-red-950 dark:bg-red-950/20 text-zinc-700 dark:text-zinc-300">
          <div className="flex items-center gap-1.5 font-medium text-red-700 dark:text-red-400">
            <span className="rounded bg-red-100 px-1 font-mono text-[10px] dark:bg-red-900/60">
              REJECTED
            </span>
            <span>A-894 · STALE_VERSION</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
            YARD-1 requested D-109 at 14:01:30 with state v3809; engine rejected
            because D-109 was already committed to C-86 in v3811.
          </p>
        </div>
      </section>
    </div>
  );
};
