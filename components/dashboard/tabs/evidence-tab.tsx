"use client";

import { EVIDENCE_RECORDS } from "@/lib/dashboard/data";
import { ProvenanceBadge } from "../provenance-badge";

export const EvidenceTab = () => {
  return (
    <div className="space-y-3 p-3 text-xs overflow-y-auto">
      <div className="text-zinc-500 text-[11px] leading-relaxed">
        Every operational number in the system carries an immutable provenance
        record. Unknown values stay explicitly unknown through save, reload, and
        export.
      </div>

      <div className="space-y-3">
        {EVIDENCE_RECORDS.map((rec) => (
          <section
            key={rec.id}
            className="rounded-md border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-950/40 space-y-1.5 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {rec.title}
              </span>
              <ProvenanceBadge kind={rec.kind}>
                {rec.kind === "src"
                  ? "published spec"
                  : rec.kind === "drv"
                    ? "derived conversion"
                    : rec.kind === "hyp"
                      ? "hypothetical"
                      : "unknown"}
              </ProvenanceBadge>
            </div>

            <dl className="grid grid-cols-[72px_1fr] gap-x-2 gap-y-1 text-[11px]">
              <dt className="text-zinc-500">Scope</dt>
              <dd className="text-zinc-700 dark:text-zinc-300">{rec.scope}</dd>

              <dt className="text-zinc-500">Source</dt>
              <dd className="text-zinc-700 dark:text-zinc-300 font-medium">
                {rec.source}
              </dd>

              {rec.url && (
                <>
                  <dt className="text-zinc-500">URL</dt>
                  <dd className="break-all font-mono text-[10px] text-blue-600 dark:text-blue-400">
                    <a
                      href={rec.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {rec.url}
                    </a>
                  </dd>
                </>
              )}

              {rec.dates && (
                <>
                  <dt className="text-zinc-500">Dates</dt>
                  <dd className="text-zinc-600 dark:text-zinc-400">
                    {rec.dates}
                  </dd>
                </>
              )}

              {rec.table && (
                <>
                  <dt className="text-zinc-500">Reference</dt>
                  <dd className="text-zinc-600 dark:text-zinc-400">
                    {rec.table}
                  </dd>
                </>
              )}

              {rec.original && (
                <>
                  <dt className="text-zinc-500">Original</dt>
                  <dd className="font-mono text-zinc-700 dark:text-zinc-300">
                    {rec.original}
                  </dd>
                </>
              )}

              {rec.formula && (
                <>
                  <dt className="text-zinc-500">Formula</dt>
                  <dd className="font-mono text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded">
                    {rec.formula}
                  </dd>
                </>
              )}

              {rec.qualifier && (
                <>
                  <dt className="text-zinc-500">Qualifier</dt>
                  <dd className="text-zinc-600 dark:text-zinc-400 italic">
                    {rec.qualifier}
                  </dd>
                </>
              )}

              {rec.crossCheck && (
                <>
                  <dt className="text-zinc-500">Cross-check</dt>
                  <dd className="font-mono text-zinc-600 dark:text-zinc-400">
                    {rec.crossCheck}
                  </dd>
                </>
              )}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
};
