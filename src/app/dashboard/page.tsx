import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Indicateurs, chiffre d’affaires et derniers documents de TGI Ascenseurs.",
};

export const instant = false;

export default function DashboardPage() {
  return <DashboardView />;
}
