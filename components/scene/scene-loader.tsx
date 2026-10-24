"use client";

import dynamic from "next/dynamic";

// WebGL needs the browser, so the scene is never prerendered on the server.
export const SceneLoader = dynamic(
  () => import("./facility-scene").then((m) => m.FacilityScene),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center text-sm text-zinc-500 dark:text-zinc-400">
        Loading the 3D facility…
      </div>
    ),
  },
);
