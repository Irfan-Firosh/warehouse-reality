"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

const outerVariants = cva("", {
  variants: {
    variant: {
      primary:
        "w-full border border-[1px] dark:border-[2px] border-black/10 dark:border-black bg-gradient-to-b from-black/70 to-black dark:from-white dark:to-white/80 p-[1px] transition duration-300 ease-in-out",
      accent:
        "w-full border-[1px] dark:border-[2px] border-black/10 dark:border-neutral-950 bg-gradient-to-b from-indigo-300/90 to-indigo-500 dark:from-indigo-200/70 dark:to-indigo-500 p-[1px] transition duration-300 ease-in-out",
      destructive:
        "w-full border-[1px] dark:border-[2px] border-black/10 dark:border-neutral-950 bg-gradient-to-b from-red-300/90 to-red-500 dark:from-red-300/90 dark:to-red-500 p-[1px] transition duration-300 ease-in-out",
      secondary:
        "w-full border-[1px] dark:border-[2px] border-black/20 bg-white/50 dark:border-neutral-950 dark:bg-neutral-600/50 p-[1px] transition duration-300 ease-in-out",
      minimal:
        "group w-full border-[1px] dark:border-[2px] border-black/20 bg-white/50 dark:border-neutral-950 dark:bg-neutral-600/80 p-[1px] active:bg-neutral-200 dark:active:bg-neutral-800 hover:bg-gradient-to-t hover:from-neutral-100 to-white dark:hover:from-neutral-600/50 dark:hover:to-neutral-600/70",
      icon: "group rounded-full border dark:border-neutral-950 border-black/10 dark:bg-neutral-600/50 bg-white/50 p-[1px] active:bg-neutral-200 dark:active:bg-neutral-800 hover:bg-gradient-to-t hover:from-neutral-100 to-white dark:hover:from-neutral-700 dark:hover:to-neutral-600",
    },
    size: {
      sm: "rounded-[6px]",
      default: "rounded-[12px]",
      lg: "rounded-[12px]",
      icon: "rounded-full",
    },
  },
  defaultVariants: { variant: "primary", size: "default" },
});

const innerVariants = cva("flex h-full w-full items-center justify-center", {
  variants: {
    variant: {
      primary:
        "gap-2 bg-gradient-to-b from-neutral-800 to-black dark:from-neutral-200 dark:to-neutral-50 text-sm text-white/90 dark:text-black/80 transition duration-300 ease-in-out hover:from-stone-800 hover:to-neutral-800/70 dark:hover:from-stone-200 dark:hover:to-neutral-200 dark:active:from-stone-300 dark:active:to-neutral-300 active:bg-gradient-to-b active:from-black active:to-black",
      accent:
        "gap-2 bg-gradient-to-b from-indigo-600 to-indigo-700 text-sm text-white transition duration-300 ease-in-out hover:from-indigo-700 hover:to-indigo-800 active:from-indigo-800 active:to-indigo-800",
      destructive:
        "gap-2 bg-gradient-to-b from-red-600 to-red-700 text-sm text-white transition duration-300 ease-in-out hover:from-red-700 hover:to-red-800 active:from-red-800 active:to-red-800",
      secondary:
        "gap-2 bg-gradient-to-b from-neutral-100/80 to-neutral-200/50 dark:from-neutral-800 dark:to-neutral-700/50 text-sm text-neutral-900 dark:text-neutral-100 transition duration-300 ease-in-out hover:bg-gradient-to-b hover:from-neutral-200/40 hover:to-neutral-300/60 dark:hover:from-neutral-700 dark:hover:to-neutral-700/60 active:bg-gradient-to-b active:from-neutral-200/60 active:to-neutral-300/70 dark:active:from-neutral-800 dark:active:to-neutral-700",
      minimal:
        "gap-2 bg-gradient-to-b from-white to-neutral-50/50 dark:from-neutral-800 dark:to-neutral-700/50 text-sm text-neutral-700 dark:text-neutral-200 transition duration-300 ease-in-out group-hover:bg-gradient-to-b group-hover:from-neutral-50/50 group-hover:to-neutral-100/60 dark:group-hover:from-neutral-700 dark:group-hover:to-neutral-700/60 group-active:bg-gradient-to-b group-active:from-neutral-100/60 group-active:to-neutral-100/90 dark:group-active:from-neutral-800 dark:group-active:to-neutral-700",
      icon: "bg-gradient-to-b from-white to-neutral-50/50 dark:from-neutral-800 dark:to-neutral-700/50 text-neutral-700 dark:text-neutral-200 group-active:bg-neutral-200 dark:group-active:bg-neutral-800 rounded-full",
    },
    size: {
      sm: "text-xs rounded-[4px] px-3 py-1",
      default: "text-sm rounded-[10px] px-4 py-2",
      lg: "text-base rounded-[10px] px-4 py-2",
      icon: "rounded-full p-1",
    },
  },
  defaultVariants: { variant: "primary", size: "default" },
});

export type TextureButtonVariant = NonNullable<
  VariantProps<typeof outerVariants>["variant"]
>;

export interface TextureButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: TextureButtonVariant;
  size?: NonNullable<VariantProps<typeof outerVariants>["size"]>;
  ref?: Ref<HTMLButtonElement>;
}

/** A two-layer gradient button: a 1px bevel around a softly lit face. */
export const TextureButton = ({
  children,
  variant = "primary",
  size = "default",
  className,
  type = "button",
  ref,
  ...props
}: TextureButtonProps) => (
  <button
    ref={ref}
    type={type}
    className={cn(
      outerVariants({ variant, size }),
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <span className={innerVariants({ variant, size })}>{children}</span>
  </button>
);
