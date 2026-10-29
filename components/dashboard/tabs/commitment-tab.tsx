"use client";

import {
  formatClock,
  type RunTimelineEvent,
  rejectedMoves,
} from "@/lib/dashboard/project-run";
import type { CommitmentEntity } from "@/lib/engine/types";
import { ProvenanceBadge, RunProvenanceBadge } from "../provenance-badge";

interface CommitmentTabProps {
  /** The run's commitments and timeline; null shows the illustrative example. */
  run: {
    commitments: readonly CommitmentEntity[];
    timeline: readonly RunTimelineEvent[];
  } | null;
  onSelectEntity: (id: string) => void;
}

const SECTION =
  "text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1";

const STATUS_STYLE: Partial<Record<CommitmentEntity["status"], string>> = {
  committed: "text-blue-700 dark:text-blue-400",
  executing: "text-blue-700 dark:text-blue-400",
  completed: "text-emerald-700 dark:text-emerald-400",
  rejected: "text-red-700 dark:text-red-400",
  cancelled: "text-zinc-500",
  expired: "text-zinc-500",
};

interface EntityLinkProps {
  id: string;
  onSelectEntity: (id: string) => void;
}

const EntityLink = ({ id, onSelectEntity }: EntityLinkProps) => (
  <button
    type="button"
    onClick={() => onSelectEntity(id)}
    className="font-mono text-blue-600 underline dark:text-blue-400"
  >
    {id}
  </button>
);

interface RunCommitmentProps {
  c: CommitmentEntity;
  onSelectEntity: (id: string) => void;
}

const RunCommitment = ({ c, onSelectEntity }: RunCommitmentProps) => (
  <section className="space-y-1.5 rounded-md border border-zinc-200 p-2.5 dark:border-zinc-800">
    <div className="flex items-center justify-between gap-2">
      <span className="font-semibold text-sm">{c.id}</span>
      <span className={`font-mono text-[11px] ${STATUS_STYLE[c.status] ?? ""}`}>
        {c.status}
      </span>
    </div>
    <div className="text-zinc-800 dark:text-zinc-200">{c.task}</div>
    <div className="font-mono text-[10px] text-zinc-500">
      engine v{c.stateVersion} · created {formatClock(c.createdAt)} · expires{" "}
      {formatClock(c.expiresAt)}
      {c.committedAt !== undefined &&
        ` · committed ${formatClock(c.committedAt)}`}
    </div>
    {c.rejectionReason && (
      <div className="font-mono text-[11px] text-red-700 dark:text-red-400">
        rejected · {c.rejectionReason}
      </div>
    )}
    <table className="w-full text-[11px]">
      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {c.participants.map((p) => (
          <tr key={p.agentId}>
            <td className="py-0.5 font-mono font-medium">{p.agentId}</td>
            <td className="py-0.5 text-zinc-500">{p.role}</td>
            <td
              className={`py-0.5 ${p.accepted ? "text-emerald-600" : "text-zinc-500"}`}
            >
              {p.accepted ? "accepted" : "pending"}
            </td>
          </tr>
        ))}
        {c.requiredResources.map((r) => (
          <tr key={`${r.type}-${r.resourceId}`}>
            <td className="py-0.5">
              <EntityLink id={r.resourceId} onSelectEntity={onSelectEntity} />
            </td>
            <td className="py-0.5 text-zinc-500">{r.type}</td>
            <td className="py-0.5 font-mono text-zinc-500">
              {formatClock(r.startWindow)}–{formatClock(r.endWindow)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);

interface RunCommitmentsProps {
  commitments: readonly CommitmentEntity[];
  timeline: readonly RunTimelineEvent[];
  onSelectEntity: (id: string) => void;
}

/** The run's commitments and every rejected or refused move, with its reason. */
const RunCommitments = ({
  commitments,
  timeline,
  onSelectEntity,
}: RunCommitmentsProps) => {
  const rejections = rejectedMoves(timeline);
  return (
    <div className="space-y-3 p-3 text-xs">
      <div className={SECTION}>Commitments · engine</div>
      {commitments.length === 0 ? (
        <p className="rounded-md border border-zinc-200 p-2 italic text-zinc-400 dark:border-zinc-800">
          No commitments in the engine yet
        </p>
      ) : (
        commitments.map((c) => (
          <RunCommitment key={c.id} c={c} onSelectEntity={onSelectEntity} />
        ))
      )}
      <div className={SECTION}>Rejections</div>
      {rejections.length === 0 ? (
        <p className="rounded-md border border-zinc-200 p-2 italic text-zinc-400 dark:border-zinc-800">
          No rejected moves
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rejections.map((e) => (
            <li
              key={e.id}
              className="rounded-md border border-red-200 bg-red-50/40 p-2 dark:border-red-950 dark:bg-red-950/20"
            >
              <div className="flex flex-wrap items-center gap-1.5 font-medium text-red-700 dark:text-red-400">
                <span className="rounded bg-red-100 px-1 font-mono text-[10px] dark:bg-red-900/60">
                  {e.tag === "refused" ? "REFUSED" : "REJECTED"}
                </span>
                <span className="font-mono">{e.reasonCode}</span>
                <RunProvenanceBadge provenance={e.provenance} />
              </div>
              <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                {e.time} · {e.source} · {e.title}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface IllustrativeCommitmentProps {
  onSelectEntity: (id: string) => void;
}

/** The example shown before any run exists; every value is illustrative. */
const IllustrativeCommitment = ({
  onSelectEntity,
}: IllustrativeCommitmentProps) => {
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

export const CommitmentTab = ({ run, onSelectEntity }: CommitmentTabProps) =>
  run ? (
    <RunCommitments
      commitments={run.commitments}
      timeline={run.timeline}
      onSelectEntity={onSelectEntity}
    />
  ) : (
    <IllustrativeCommitment onSelectEntity={onSelectEntity} />
  );
