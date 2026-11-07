import type { Metadata } from "next";
import { StockArticleDetails } from "@/components/stock/StockArticleDetails";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Fiche stock",
  description: "Détail des quantités et mouvements d’un article.",
};

export default async function StockArticlePage({
  params,
}: PageProps<"/stock/[articleId]">) {
  const { articleId } = await params;
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
