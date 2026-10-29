"use client";

import {
  Aperture,
  Box,
  Crosshair,
  House,
  MapIcon,
  Move,
  RotateCcw,
  Settings,
  SunMedium,
} from "lucide-react";
import { type ReactNode, useCallback, useRef, useState } from "react";
import {
  MESH_LABEL,
  MESH_TITLE,
  type MeshMode,
} from "@/components/scene/scene-overlay";
import {
  TextureButton,
  type TextureButtonProps,
} from "@/components/ui/texture-button";
import type { ViewSettings } from "@/lib/scene/view-settings";
import { cn } from "@/lib/utils";
import { useDismiss } from "./use-dismiss";

const ICON = "size-3.5";

interface ToggleProps extends Omit<TextureButtonProps, "variant" | "size"> {
  on: boolean;
}

/** A switch: the dark "primary" face while on, "minimal" while off. */
const Toggle = ({ on, className, ...props }: ToggleProps) => (
  <TextureButton
    variant={on ? "primary" : "minimal"}
    size="sm"
    className={cn("justify-start", className)}
    aria-pressed={on}
    {...props}
  />
);

interface SectionProps {
  title: string;
  disabled?: boolean;
  children: ReactNode;
}

const Section = ({ title, disabled = false, children }: SectionProps) => (
  <fieldset disabled={disabled} className="flex flex-col gap-1">
    <legend className="mb-1 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
      {title}
    </legend>
    {children}
  </fieldset>
);

interface SettingsPaneProps {
  view: ViewSettings;
  /** Load state of the free models, for the Models switch label. */
  meshes: MeshMode;
  canFollow: boolean;
  /** WebGL context lost: the view and camera controls would do nothing. */
  graphicsLost: boolean;
  following: boolean;
  onChange: (next: ViewSettings) => void;
  onResetView: () => void;
  onToggleFollow: () => void;
}

/** The ⚙ button and its panel: what the scene shows, the camera, and ambient motion. */
export const SettingsPane = ({
  view,
  meshes,
  canFollow,
  graphicsLost,
  following,
  onChange,
  onResetView,
  onToggleFollow,
}: SettingsPaneProps) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, root, trigger);
  const flip = (key: keyof Omit<ViewSettings, "lensStrength">) => () =>
    onChange({ ...view, [key]: !view[key] });

  return (
    <div ref={root} className="relative">
      <TextureButton
        ref={trigger}
        variant={open ? "primary" : "icon"}
        size="icon"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="scene-settings"
        aria-label="Scene settings"
        title="Scene settings"
      >
        <Settings className="size-5 p-0.5" />
      </TextureButton>
      {open && (
        <div
          id="scene-settings"
          role="dialog"
          aria-label="Scene settings"
          className="absolute top-full right-0 z-30 mt-2 flex w-60 flex-col gap-3 rounded-lg border border-zinc-200 bg-white/95 p-3 text-zinc-950 shadow-lg backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95 dark:text-zinc-50"
        >
          {graphicsLost && (
            <p className="px-0.5 text-[11px] leading-snug text-amber-600 dark:text-amber-400">
              Graphics stopped, so the 3D view is paused.
            </p>
          )}
          <Section title="View" disabled={graphicsLost}>
            <div className="grid grid-cols-2 gap-1">
              <Toggle on={view.roof} onClick={flip("roof")}>
                <House className={ICON} />
                Roof
              </Toggle>
              <Toggle
                on={view.models}
                onClick={flip("models")}
                title={MESH_TITLE[meshes]}
              >
                <Box className={ICON} />
                {MESH_LABEL[meshes]}
              </Toggle>
              <Toggle on={view.lens} onClick={flip("lens")}>
                <Aperture className={ICON} />
                Lens
              </Toggle>
              <Toggle on={view.shadows} onClick={flip("shadows")}>
                <SunMedium className={ICON} />
                Shadows
              </Toggle>
            </div>
            <label className="mt-1 flex items-center gap-2 px-0.5 text-xs text-zinc-600 dark:text-zinc-300">
              Blur
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={view.lensStrength}
                disabled={!view.lens}
                onChange={(e) =>
                  onChange({ ...view, lensStrength: Number(e.target.value) })
                }
                className="h-1 flex-1 accent-indigo-500 disabled:opacity-40"
                aria-label="Tilt-shift blur strength"
              />
            </label>
          </Section>
          <Section title="Camera" disabled={graphicsLost}>
            <div className="grid grid-cols-2 gap-1">
              <TextureButton
                variant="minimal"
                size="sm"
                className="justify-start"
                onClick={onResetView}
              >
                <RotateCcw className={ICON} />
                Reset
              </TextureButton>
              <Toggle on={view.topDown} onClick={flip("topDown")}>
                <MapIcon className={ICON} />
                Top-down
              </Toggle>
              <Toggle
                on={following}
                onClick={onToggleFollow}
                disabled={!following && !canFollow}
                title={
                  canFollow || following
                    ? "Chase the selected truck (F)"
                    : "Select a truck to follow"
                }
                className="col-span-2"
              >
                <Crosshair className={ICON} />
                {following ? "Following" : "Follow selected"}
              </Toggle>
            </div>
          </Section>
          <Section title="Motion">
            <Toggle on={view.ambient} onClick={flip("ambient")}>
              <Move className={ICON} />
              Ambient motion
            </Toggle>
            <p className="px-0.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
              Illustrative decoration on a display clock; not engine output.
            </p>
          </Section>
        </div>
      )}
    </div>
  );
};
