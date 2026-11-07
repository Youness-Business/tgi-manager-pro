import type { Metadata } from "next";
import { StockInventory } from "@/components/stock/StockInventory";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Inventaire",
  description: "Saisie des quantités physiques et ajustement atomique du stock.",
};

export default function StockInventoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventaire"
        description="Saisissez les quantités comptées. Seuls les écarts seront enregistrés."
      />
      <StockInventory />
    </div>
  );
}
