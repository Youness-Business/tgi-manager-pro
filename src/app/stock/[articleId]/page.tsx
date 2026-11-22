import { StockArticleDetails } from "@/components/stock/StockArticleDetails";
import { PageHeader } from "@/components/ui/PageHeader";
import { useParams } from "@/lib/router";

export default function StockArticlePage() {
  const { articleId = "" } = useParams<{ articleId: string }>();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Détail du stock"
        description="Quantité actuelle, évolution et historique complet des mouvements."
      />
      <StockArticleDetails articleId={articleId} />
    </div>
  );
}
