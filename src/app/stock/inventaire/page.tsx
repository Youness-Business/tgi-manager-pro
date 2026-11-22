import { StockInventory } from "@/components/stock/StockInventory";
import { PageHeader } from "@/components/ui/PageHeader";


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
