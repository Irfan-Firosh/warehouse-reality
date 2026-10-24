import type { Metadata } from "next";
import { SceneLoader } from "@/components/scene/scene-loader";

export const metadata: Metadata = {
  title: "Warehouse Sim",
  description:
    "Schematic 3D view of DFW Commerce Center Building I with an illustrative run state.",
};

export default function Home() {
  return (
    <main className="h-dvh w-full bg-zinc-100 dark:bg-zinc-950">
      <SceneLoader />
    </main>
  );
}
