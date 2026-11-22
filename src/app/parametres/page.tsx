import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsPanel } from "@/components/settings/SettingsPanel";


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
