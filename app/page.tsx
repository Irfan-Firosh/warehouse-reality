import type { Metadata } from "next";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

export const metadata: Metadata = {
  title: "Warehouse Sim · Operational Rehearsal Dashboard",
  description:
    "Decision-rehearsal simulator for DFW Commerce Center Building I with autonomous agents, authoritative commitments, and schematic 3D view.",
};

export default function Home() {
  return <DashboardLayout />;
}
