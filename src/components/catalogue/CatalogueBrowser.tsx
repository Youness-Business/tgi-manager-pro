"use client";

import { BadgeCheck, Search as SearchIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { formatMoney } from "@/lib/formatMoney";
import { normalizeSearch } from "@/lib/normalizeSearch";
import type { Article, ArticleCategory } from "@/types";
import { useArticles } from "@/context/FirestoreDataProvider";

const categories: ArticleCategory[] = [
  "Moteurs",
  "Câbles",
  "Portes",
  "Électronique",
  "Services",
];

type CatalogueBrowserProps = {
  initialQuery: string;
  initialCategory: string;
};

export function CatalogueBrowser({
  initialQuery,
  initialCategory,
}: CatalogueBrowserProps) {
  const { items: articles, loading, error } = useArticles();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(
    categories.find((item) => item === initialCategory) ?? "",
  );
  const [priceDirection, setPriceDirection] = useState<
    "ascending" | "descending"
  >("ascending");
  const router = useRouter();
  const pathname = usePathname();

  function updateUrl(nextQuery: string, nextCategory: string) {
    const params = new URLSearchParams(window.location.search);
    if (nextQuery) params.set("q", nextQuery);
    else params.delete("q");
    if (nextCategory) params.set("cat", nextCategory);
    else params.delete("cat");
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  function updateQuery(value: string) {
    setQuery(value);
    updateUrl(value, category);
  }

  function updateCategory(value: string) {
    setCategory(value);
    updateUrl(query, value);
  }

  const normalizedQuery = normalizeSearch(query);
  const filteredArticles = articles
    .filter((article) => !category || article.categorie === category)
    .filter((article) =>
      normalizeSearch(`${article.reference} ${article.designation}`).includes(
        normalizedQuery,
      ),
    )
    .sort((left, right) =>
      priceDirection === "ascending"
        ? left.prixUnitaireHT - right.prixUnitaireHT
        : right.prixUnitaireHT - left.prixUnitaireHT,
    );

  const columns: DataTableColumn<Article>[] = [
    {
      id: "reference",
      header: "Référence",
      render: (article) => (
        <span className="break-all font-mono text-xs font-medium text-slate-700">
          {article.reference}
        </span>
      ),
    },
    {
      id: "designation",
      header: "Désignation",
      className: "max-w-72 break-words",
      render: (article) => (
        <span className="break-words font-medium text-slate-900">
          {article.designation}
          {article.categorie === "Services" ? (
            <span className="ml-2 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-blue-50 px-2 py-0.5 align-middle text-[11px] font-medium text-blue-700">
              <BadgeCheck aria-hidden="true" size={12} />
              Service
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "categorie",
      header: "Catégorie",
      render: (article) => article.categorie,
    },
    {
      id: "unite",
      header: "Unité",
      render: (article) => article.unite,
    },
    {
      id: "prix-ht",
      header: "Prix unitaire HT",
      align: "right",
      sortable: true,
      sortDirection: priceDirection,
      onSort: () =>
        setPriceDirection((direction) =>
          direction === "ascending" ? "descending" : "ascending",
        ),
      render: (article) => (
        <span className="whitespace-nowrap font-medium tabular-nums text-slate-900">
          {formatMoney(article.prixUnitaireHT)}
        </span>
      ),
    },
    {
      id: "prix-ttc",
      header: "Prix TTC indicatif",
      align: "right",
      render: (article) => (
        <span className="whitespace-nowrap tabular-nums text-slate-700">
          {formatMoney(
            Math.round(
              (article.prixUnitaireHT * 1.2 + Number.EPSILON) * 100,
            ) / 100,
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p role="status" className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          Chargement du catalogue…
        </p>
      ) : null}
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_15rem_auto] sm:items-end">
        <SearchInput
          id="catalogue-search"
          label="Rechercher par référence ou désignation"
          value={query}
          placeholder="Référence ou désignation…"
          onChange={updateQuery}
        />
        <div className="min-w-0">
          <label
            htmlFor="catalogue-category"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Catégorie
          </label>
          <select
            id="catalogue-category"
            value={category}
            onChange={(event) => updateCategory(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Toutes les catégories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <p
          aria-live="polite"
          className="text-sm text-slate-600 sm:pb-3 sm:text-right"
        >
          {filteredArticles.length} article
          {filteredArticles.length === 1 ? "" : "s"}
        </p>
      </div>
      <button
        type="button"
        onClick={() =>
          setPriceDirection((direction) =>
            direction === "ascending" ? "descending" : "ascending",
          )
        }
        aria-label={`Trier le prix unitaire HT par ordre ${
          priceDirection === "ascending" ? "décroissant" : "croissant"
        }`}
        className="inline-flex min-h-10 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:hidden"
      >
        Prix HT {priceDirection === "ascending" ? "croissant ↑" : "décroissant ↓"}
      </button>

      {!loading && !error && filteredArticles.length ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <DataTable
            caption="Catalogue des articles et tarifs"
            columns={columns}
            rows={filteredArticles}
            getRowKey={(article) => article.id}
            minWidthClassName="min-w-[900px]"
          />
        </div>
      ) : !loading && !error ? (
        <EmptyState
          icon={SearchIcon}
          title="Aucun article trouvé"
          message={
            query
              ? `Aucun article trouvé pour « ${query} ».`
              : "Aucun article ne correspond à la catégorie sélectionnée."
          }
          action={
            query || category ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("");
                  updateUrl("", "");
                }}
                className="inline-flex min-h-10 items-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Effacer les filtres
              </button>
            ) : undefined
          }
        />
      ) : null}
    </div>
  );
}
