import { budgetMeter, type MeterText } from "@/lib/dashboard/model-call-format";
import type { RunBudget } from "@/types/run";

interface BudgetMeterProps {
  budget: RunBudget;
  /** Budgeted calls whose provider reported no usage; their tokens are not counted. */
  unreportedCalls?: number;
  compact?: boolean;
}

// A native meter, so the fill needs no inline width style.
const BAR =
  "block h-1.5 w-full appearance-none overflow-hidden rounded-full bg-zinc-500/25 [&::-webkit-meter-bar]:h-1.5 [&::-webkit-meter-bar]:rounded-full [&::-webkit-meter-bar]:border-0 [&::-webkit-meter-bar]:bg-zinc-500/25 [&::-webkit-meter-optimum-value]:bg-blue-500 [&::-webkit-meter-suboptimum-value]:bg-amber-500 [&::-webkit-meter-even-less-good-value]:bg-red-500 [&::-moz-meter-bar]:bg-blue-500";

interface BarProps {
  name: string;
  m: MeterText;
}

const Bar = ({ name, m }: BarProps) => (
  <div className="min-w-0 space-y-0.5">
    <span className="block whitespace-nowrap">{m.label}</span>
    <meter
      className={BAR}
      min={0}
      max={m.cap}
      low={m.cap * 0.75}
      high={m.cap * 0.9}
      optimum={0}
      value={Math.min(m.used, m.cap)}
      aria-label={`${name}: ${m.label}`}
    />
  </div>
);

/** Run budget from the run itself: calls/60 and tokens/150k, and whether it ran out. */
export const BudgetMeter = ({
  budget,
  unreportedCalls = 0,
  compact = false,
}: BudgetMeterProps) => {
  const { calls, tokens } = budgetMeter(budget, unreportedCalls);
  return (
    <div
      className={`font-mono text-[10px] text-zinc-600 dark:text-zinc-400 ${compact ? "grid grid-cols-[auto_auto] gap-x-2" : "space-y-1.5"}`}
      title="Run budget. Once either cap is reached, the remaining turns use the FCFS baseline."
    >
      <Bar name="Model calls" m={calls} />
      <Bar name="Tokens" m={tokens} />
      {budget.exhausted && (
        <span className="col-span-full font-semibold text-red-700 dark:text-red-400">
          Budget reached · baseline decides
        </span>
      )}
      {!compact && unreportedCalls > 0 && (
        <p className="text-zinc-500">
          {unreportedCalls} call{unreportedCalls === 1 ? "" : "s"} reported no
          usage: tokens unknown, not counted.
        </p>
      )}
    </div>
  );
};
