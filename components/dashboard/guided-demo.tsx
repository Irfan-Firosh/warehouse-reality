"use client";

import { Play, Square } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { TextureButton } from "@/components/ui/texture-button";
import {
  type GuidedApi,
  type GuidedLine,
  type GuidedTone,
  runGuidedDemo,
} from "@/lib/dashboard/guided-demo";

interface GuidedDemoProps {
  run: GuidedApi;
  /** Another request (e.g. a manual Step) holds the run. */
  busy: boolean;
  onRunningChange?: (running: boolean) => void;
  /** Shown beside the status, e.g. the budget meter. */
  children?: ReactNode;
}

const TONE: Readonly<Record<GuidedTone, string>> = {
  progress: "text-zinc-600 dark:text-zinc-300",
  done: "text-emerald-700 dark:text-emerald-400",
  error: "text-red-700 dark:text-red-400",
};

const PILL =
  "pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white/90 p-1 pr-2 text-xs shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90";

/**
 * One button that runs the whole D-108 rehearsal, with a status line per step.
 * The step log opens as its own item of the parent flex-wrap row, so no
 * drawer covers it and it never overflows a narrow screen.
 */
export const GuidedDemo = ({
  run,
  busy,
  onRunningChange,
  children,
}: GuidedDemoProps) => {
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [lines, setLines] = useState<readonly GuidedLine[]>([]);
  // Set while a flow runs; also blocks a second click in the same tick.
  const controller = useRef<AbortController | null>(null);

  // Leaving the page stops the flow at its next check.
  useEffect(() => () => controller.current?.abort(), []);

  const go = useCallback(async () => {
    if (controller.current) return;
    const ctl = new AbortController();
    controller.current = ctl;
    setRunning(true);
    onRunningChange?.(true);
    setLines([]);
    try {
      await runGuidedDemo(run, {
        report: (line) => setLines((prev) => [...prev, line]),
        signal: ctl.signal,
      });
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setLines((prev) => [...prev, { tone: "error", text }]);
    } finally {
      controller.current = null;
      setRunning(false);
      setStopping(false);
      onRunningChange?.(false);
    }
  }, [run, onRunningChange]);

  const stop = useCallback(() => {
    controller.current?.abort();
    setStopping(true);
  }, []);

  const latest = lines.at(-1);

  return (
    <>
      <section className={PILL} aria-label="Guided D-108 scenario">
        {running ? (
          <TextureButton
            variant="secondary"
            size="sm"
            className="w-auto"
            onClick={stop}
            disabled={stopping}
            aria-label="Stop the guided scenario"
            title="Stops after the request in flight; the run keeps its state"
          >
            <Square className="size-3" />
            {stopping ? "Stopping…" : "Stop"}
          </TextureButton>
        ) : (
          <TextureButton
            variant="accent"
            size="sm"
            className="w-auto"
            onClick={go}
            disabled={busy}
          >
            <Play className="size-3.5" />
            Run the D-108 scenario
          </TextureButton>
        )}
        {running && (
          <span
            className="size-3 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent"
            aria-hidden
          />
        )}
        {latest && (
          <button
            type="button"
            onClick={() => setLogOpen((o) => !o)}
            aria-expanded={logOpen}
            aria-controls="guided-log"
            className={`flex min-w-0 max-w-72 items-center gap-1 ${TONE[latest.tone]}`}
            title="Show every step"
          >
            <span className="text-[10px] text-zinc-400">
              {logOpen ? "▾" : "▸"}
            </span>
            <output aria-live="polite" className="truncate">
              {latest.text}
            </output>
          </button>
        )}
        {children}
      </section>
      {logOpen && latest && (
        <ol
          id="guided-log"
          aria-label="Guided scenario steps"
          className="pointer-events-auto order-last max-h-48 min-w-0 basis-full space-y-0.5 overflow-y-auto rounded-lg border border-zinc-200 bg-white/95 p-2 font-mono text-[10px] shadow-lg backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95"
        >
          {lines.map((l, i) => (
            // Lines only append, so the index is a stable key.
            // biome-ignore lint/suspicious/noArrayIndexKey: append-only log
            <li key={i} className={TONE[l.tone]}>
              {l.text}
            </li>
          ))}
        </ol>
      )}
    </>
  );
};
