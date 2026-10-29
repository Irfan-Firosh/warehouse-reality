import { callBadgeText } from "@/lib/dashboard/model-call-format";
import type { ModelCall, Provenance } from "@/types/run";
import { RunProvenanceBadge } from "./provenance-badge";

interface ModelCallBadgeProps {
  call: ModelCall;
  provenance: Provenance;
}

const OUTCOME_STYLE: Readonly<Record<ModelCall["outcome"], string>> = {
  accepted: "text-emerald-700 dark:text-emerald-400",
  rejected: "text-red-700 dark:text-red-400",
  no_tool: "text-zinc-500",
};

/** One model call: who decided, which model and tier, latency, tokens, and FALLBACK when it applies. */
export const ModelCallBadge = ({ call, provenance }: ModelCallBadgeProps) => {
  const text = callBadgeText(call);
  return (
    <div
      className={`space-y-1 rounded-md border p-2 text-[11px] ${
        text.fallback
          ? "border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20"
          : "border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/30"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1">
        <span className="font-mono font-semibold">{call.agentId}</span>
        <RunProvenanceBadge provenance={provenance} />
        {text.fallback && (
          <span
            className="rounded bg-red-600 px-1 font-mono text-[10px] font-bold text-white"
            title={`Fallback reason: ${text.fallback}`}
          >
            FALLBACK · {text.fallback}
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-zinc-400">
          {call.id}
        </span>
      </div>
      <div className="truncate font-mono" title={text.model}>
        {text.model}
      </div>
      <div className="flex flex-wrap gap-x-2 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
        <span>tier {text.tier}</span>
        <span>{text.latency}</span>
        <span>{text.tokens}</span>
      </div>
      <div className="font-mono text-[10px]">
        <span className="text-zinc-500">{call.toolName ?? "no tool"} → </span>
        <span className={OUTCOME_STYLE[call.outcome]}>{call.outcome}</span>
        {call.reasonCode && (
          <span className="text-red-700 dark:text-red-400">
            {" "}
            · {call.reasonCode}
          </span>
        )}
      </div>
    </div>
  );
};
