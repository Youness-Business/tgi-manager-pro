"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDownToLine, ClipboardList, PackageSearch, Plus } from "lucide-react";
import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { StockStatusBadge } from "@/components/stock/StockStatusBadge";
import { useAuth } from "@/context/AuthProvider";
import { useArticles } from "@/context/FirestoreDataProvider";
import { useArticlesCouts } from "@/context/StockDataProvider";
import { formatMoney } from "@/lib/formatMoney";
import { normalizeSearch } from "@/lib/normalizeSearch";
import { getStockStatut, valeurStock } from "@/lib/stock";
import { can } from "@/lib/permissions";
import type { Article, ArticleCategory } from "@/types";

const categories: readonly ArticleCategory[] = [
  "Moteurs",
  "Câbles",
  "Portes",
  "Électronique",
  "Services",
];

type StockDirectoryProps = {
  initialQuery: string;
  initialCategory: string;
  initialStatus: string;
  initialLowOnly: boolean;
};

function csvCell(value: string | number): string {
  const text = String(value).replaceAll('"', '""');
  return `"${text}"`;
}

export function StockDirectory({
  initialQuery,
  initialCategory,
  initialStatus,
  initialLowOnly,
}: StockDirectoryProps) {
  const { items: articles, loading, error } = useArticles();
  const costs = useArticlesCouts();
  const { role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [status, setStatus] = useState(initialStatus);
  const [lowOnly, setLowOnly] = useState(initialLowOnly);
  const [sortKey, setSortKey] = useState<"reference" | "quantity">("reference");
  const [descending, setDescending] = useState(false);
  const productArticles = articles.filter((article) => article.type === "produit");
  const lowCount = productArticles.filter(
    (article) => getStockStatut(article) === "bas",
  ).length;
  const outCount = productArticles.filter(
    (article) => getStockStatut(article) === "rupture",
  ).length;
  const inStockCount = productArticles.filter(
    (article) => (article.stockQte ?? 0) > 0,
  ).length;
  const mayViewValue = can(role, "readPurchasePrice", "stock");

  function updateUrl(
    nextQuery: string,
    nextCategory: string,
    nextStatus: string,
    nextLowOnly: boolean,
  ) {
    const params = new URLSearchParams();
    if (nextQuery) params.set("q", nextQuery);
    if (nextCategory) params.set("cat", nextCategory);
    if (nextStatus) params.set("statut", nextStatus);
    if (nextLowOnly) params.set("bas", "1");
    const serialized = params.toString();
    router.replace(serialized ? `${pathname}?${serialized}` : pathname, {
      scroll: false,
    });
  }

  function updateFilter(
    values: Partial<{
      query: string;
      category: string;
      status: string;
      lowOnly: boolean;
    }>,
  ) {
    const next = {
      query: values.query ?? query,
      category: values.category ?? category,
      status: values.status ?? status,
      lowOnly: values.lowOnly ?? lowOnly,
    };
    setQuery(next.query);
    setCategory(next.category);
    setStatus(next.status);
    setLowOnly(next.lowOnly);
    updateUrl(next.query, next.category, next.status, next.lowOnly);
  }

  const filteredArticles = useMemo(() => {
    const needle = normalizeSearch(query);
    return productArticles
      .filter((article) => !category || article.categorie === category)
      .filter((article) => !status || getStockStatut(article) === status)
      .filter((article) => !lowOnly || getStockStatut(article) !== "ok")
      .filter((article) =>
        normalizeSearch(
          `${article.reference} ${article.designation} ${article.emplacement ?? ""} ${article.categorie}`,
        ).includes(needle),
      )
      .sort((left, right) => {
        const order =
          sortKey === "reference"
            ? left.reference.localeCompare(right.reference, "fr")
            : (left.stockQte ?? 0) - (right.stockQte ?? 0);
        return descending ? -order : order;
      });
  }, [category, lowOnly, productArticles, query, sortKey, status, descending]);

  const columns: DataTableColumn<Article>[] = [
    {
      id: "reference",
      header: "Référence",
      sortable: true,
      sortDirection:
        sortKey === "reference"
          ? descending
            ? "descending"
            : "ascending"
          : undefined,
      onSort: () => {
        if (sortKey === "reference") setDescending((value) => !value);
        else {
          setSortKey("reference");
          setDescending(false);
        }
      },
      render: (article) => (
        <Link
          href={`/stock/${article.id}`}
          className="break-all font-mono text-xs font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          {article.reference}
        </Link>
      ),
    },
    {
      id: "designation",
      header: "Désignation",
      render: (article) => (
        <Link
          href={`/stock/${article.id}`}
          className="font-medium text-slate-900 hover:text-blue-700"
        >
          {article.designation}
        </Link>
      ),
    },
    { id: "category", header: "Catégorie", render: (article) => article.categorie },
    {
      id: "location",
      header: "Emplacement",
      render: (article) => article.emplacement || "—",
    },
    {
      id: "quantity",
      header: "Quantité",
      align: "right",
      sortable: true,
      sortDirection:
        sortKey === "quantity"
          ? descending
            ? "descending"
            : "ascending"
          : undefined,
      onSort: () => {
        if (sortKey === "quantity") setDescending((value) => !value);
        else {
          setSortKey("quantity");
          setDescending(false);
        }
      },
      render: (article) => (
        <span className="font-semibold tabular-nums text-slate-900">
          {article.stockQte ?? 0} {article.unite}
        </span>
      ),
    },
    {
      id: "threshold",
      header: "Seuil",
      align: "right",
      render: (article) => (
        <span className="tabular-nums text-slate-700">
          {article.seuilAlerte ?? 0} {article.unite}
        </span>
      ),
    },
    {
      id: "status",
      header: "Statut",
      render: (article) => <StockStatusBadge article={article} />,
    },
    {
      id: "action",
      header: "Détail",
      render: (article) => (
        <Link
          href={`/stock/${article.id}`}
          aria-label={`Voir le stock de ${article.designation}`}
          className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          Ouvrir
        </Link>
      ),
    },
  ];

  function exportCsv() {
    const header = [
      "Référence",
      "Désignation",
      "Catégorie",
      "Emplacement",
      "Quantité",
      "Seuil d’alerte",
      "Statut",
    ];
    const rows = filteredArticles.map((article) => [
      article.reference,
      article.designation,
      article.categorie,
      article.emplacement ?? "",
      article.stockQte ?? 0,
      article.seuilAlerte ?? 0,
      getStockStatut(article) === "ok"
        ? "En stock"
        : getStockStatut(article) === "bas"
          ? "Stock bas"
          : "Rupture",
    ]);
    const content = [header, ...rows]
      .map((row) => row.map(csvCell).join(";"))
      .join("\r\n");
    const blob = new Blob(["\uFEFF", content], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = "stock-tgi.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {error || costs.error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error ?? costs.error}
        </p>
      ) : null}
      <section aria-label="Indicateurs de stock" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Références en stock" value={String(inStockCount)} detail="Produits avec une quantité disponible" icon={PackageSearch} iconClassName="bg-blue-50 text-blue-700" />
        <StatCard label="Sous le seuil" value={String(lowCount)} detail="À réapprovisionner" icon={ClipboardList} iconClassName="bg-amber-50 text-amber-700" />
        <StatCard label="Ruptures" value={String(outCount)} detail="Aucune quantité disponible" icon={PackageSearch} iconClassName="bg-red-50 text-red-700" />
        {mayViewValue ? (
          <StatCard
            label="Valeur du stock"
            value={formatMoney(valeurStock(productArticles, costs.items))}
            detail="Au prix d’achat HT"
            icon={PackageSearch}
            iconClassName="bg-emerald-50 text-emerald-700"
          />
        ) : null}
      </section>

      <section aria-label="Filtres du stock" className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_13rem_11rem_auto_auto] xl:items-end">
        <div className="min-w-0">
          <label htmlFor="stock-search" className="mb-1.5 block text-sm font-medium text-slate-700">Rechercher</label>
          <input id="stock-search" type="search" value={query} onChange={(event) => updateFilter({ query: event.target.value })} placeholder="Référence, désignation, emplacement…" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" />
        </div>
        <div>
          <label htmlFor="stock-category" className="mb-1.5 block text-sm font-medium text-slate-700">Catégorie</label>
          <select id="stock-category" value={category} onChange={(event) => updateFilter({ category: event.target.value })} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            <option value="">Toutes</option>
            {categories.filter((item) => item !== "Services").map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="stock-status" className="mb-1.5 block text-sm font-medium text-slate-700">Statut</label>
          <select id="stock-status" value={status} onChange={(event) => updateFilter({ status: event.target.value })} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            <option value="">Tous</option>
            <option value="ok">En stock</option>
            <option value="bas">Stock bas</option>
            <option value="rupture">Rupture</option>
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={lowOnly} onChange={(event) => updateFilter({ lowOnly: event.target.checked })} className="h-4 w-4 accent-blue-600" />
          Sous le seuil
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportCsv} disabled={loading || filteredArticles.length === 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50">
            <ArrowDownToLine size={16} aria-hidden="true" /> CSV
          </button>
          {can(role, "create", "stock") ? (
            <Link href="/stock/inventaire" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              <Plus size={16} aria-hidden="true" /> Inventaire
            </Link>
          ) : null}
        </div>
      </section>

      {loading ? (
        <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-card">Chargement du stock…</p>
      ) : !filteredArticles.length ? (
        <EmptyState icon={PackageSearch} title="Aucun article trouvé" message="Aucun produit ne correspond à la recherche et aux filtres sélectionnés." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <DataTable caption="État du stock par article" columns={columns} rows={filteredArticles} getRowKey={(article) => article.id} minWidthClassName="min-w-[900px]" />
        </div>
      )}
    </div>
  );
}
