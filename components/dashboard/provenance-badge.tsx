import type { ReactNode } from "react";
import type { ProvenanceKind } from "@/types/dashboard";

interface ProvenanceBadgeProps {
  kind: ProvenanceKind;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  title?: string;
}

const BADGE_STYLES: Record<ProvenanceKind, string> = {
  src: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  drv: "bg-teal-100 text-teal-800 dark:bg-teal-400/15 dark:text-teal-300",
  hyp: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  unk: "border border-dashed border-zinc-400 text-zinc-600 dark:border-zinc-600 dark:text-zinc-400",
  ill: "border border-dotted border-sky-500/70 text-sky-600 dark:text-sky-300",
};

export const ProvenanceBadge = ({
  kind,
  children,
  className = "",
  onClick,
  title,
}: ProvenanceBadgeProps) => {
  const base =
    "inline-flex whitespace-nowrap items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none";
  const style = `${base} ${BADGE_STYLES[kind]} ${className}`;

  if (onClick) {
    return (
      <button
        type="button"
        className={`${style} cursor-pointer hover:opacity-80 transition-opacity`}
        onClick={onClick}
        title={title}
      >
        {children}
      </button>
    );
  }

  return (
    <span className={style} title={title}>
      {children}
    </span>
  );
};
