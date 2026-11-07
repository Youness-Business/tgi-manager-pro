import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsPanel } from "@/components/settings/SettingsPanel";

export const metadata: Metadata = {
  title: "Paramètres",
  description: "Paramètres de société, comptes autorisés et import de données.",
};

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres"
        description="Configuration de l’espace TGI Ascenseurs."
      />
      <SettingsPanel />
    </div>
  );
}
