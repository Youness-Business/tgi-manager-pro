"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, PackageSearch } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button, Input } from "@/components/ui/primitives";
import { useAuth } from "@/context/AuthProvider";
import { useArticles } from "@/context/FirestoreDataProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { applyStockMovements, stockMovementId } from "@/lib/stockTransactions";
import { formatSafeDate } from "@/lib/formatSafeDate";
import { can } from "@/lib/permissions";
import type { StockMovementRequest } from "@/lib/stockTransactions";

export function StockInventory() {
  const { items: articles, loading, error } = useArticles();
  const { role, user, profile } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const productArticles = useMemo(
    () => articles.filter((article) => article.type === "produit"),
    [articles],
  );

  const differences = useMemo(
    () =>
      productArticles.flatMap((article) => {
        const rawCount = counts[article.id] ?? String(article.stockQte ?? 0);
        if (rawCount === "") return [];
        const counted = Number(rawCount);
        if (!Number.isFinite(counted) || counted < 0) return [];
        const difference = counted - (article.stockQte ?? 0);
        return difference === 0 ? [] : [{ article, counted, difference }];
      }),
    [counts, productArticles],
  );
  const mayManage = can(role, "create", "stock");

  async function validateInventory() {
    if (!user || !mayManage) return;
    if (
      productArticles.some((article) => {
        const raw = counts[article.id] ?? String(article.stockQte ?? 0);
        return raw === "" || !Number.isFinite(Number(raw)) || Number(raw) < 0;
      })
    ) {
      setFormError("Saisissez une quantité comptée valide pour chaque produit.");
      return;
    }
    if (!differences.length) {
      setFormError("Aucun écart à enregistrer : les quantités comptées sont identiques au stock.");
      return;
    }
    const confirmed = window.confirm(
      `Valider l’inventaire ? ${differences.length} ajustement(s) seront enregistrés en une seule opération.`,
    );
    if (!confirmed) return;
    const inventoryId = crypto.randomUUID();
    const dateLabel = formatSafeDate(new Date());
    const requests: StockMovementRequest[] = differences.map(
      ({ article, counted }) => ({
        articleId: article.id,
        type: "ajustement",
        qte: counted,
        motif: `Inventaire du ${dateLabel}`,
        source: "inventaire",
        movementId: stockMovementId("inventaire", inventoryId, article.id),
      }),
    );
    setSaving(true);
    setFormError("");
    try {
      await applyStockMovements(requests, user.uid, profile?.nom);
      showToast("Inventaire validé", `${requests.length} ajustement(s) enregistré(s).`);
      router.replace("/stock");
    } catch (saveError) {
      setFormError(
        saveError instanceof Error
          ? saveError.message
          : "L’inventaire n’a pas pu être validé.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!mayManage) {
    return <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">La saisie d’inventaire est réservée au propriétaire et au directeur général.</p>;
  }
  if (error) {
    return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>;
  }
  if (loading) {
    return <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Chargement des produits…</p>;
  }

  return (
    <div className="space-y-5">
      {formError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{formError}</p> : null}
      {!productArticles.length ? (
        <EmptyState icon={PackageSearch} title="Aucun produit à inventorier" message="Les services sont exclus de la gestion de stock." />
      ) : (
        <section aria-label="Quantités comptées" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="grid gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_11rem]">
            <span>Produit</span><span className="sm:text-right">Stock système</span><span className="sm:text-right">Compté</span><span className="sm:text-right">Écart</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {productArticles.map((article) => {
              const count = counts[article.id] ?? String(article.stockQte ?? 0);
              const difference =
                count === "" || !Number.isFinite(Number(count))
                  ? null
                  : Number(count) - (article.stockQte ?? 0);
              return (
                <li key={article.id} className="grid min-w-0 gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_11rem] sm:items-center">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-slate-900">{article.designation}</p>
                    <p className="mt-1 break-all font-mono text-xs text-slate-500">{article.reference} · {article.unite}</p>
                  </div>
                  <p className="text-sm tabular-nums text-slate-700 sm:text-right">{article.stockQte ?? 0}</p>
                  <label className="flex items-center gap-2 text-xs text-slate-500 sm:block sm:text-right">
                    <span className="sm:sr-only">Quantité comptée</span>
                    <Input aria-label={`Quantité comptée pour ${article.designation}`} type="number" min="0" step="any" value={count} onChange={(event) => setCounts((current) => ({ ...current, [article.id]: event.target.value }))} className="h-10 w-full sm:max-w-28 sm:text-right" />
                  </label>
                  <p className={`text-sm font-semibold tabular-nums sm:text-right ${difference === null || difference === 0 ? "text-slate-500" : difference > 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {difference === null || difference === 0 ? "—" : `${difference > 0 ? "+" : ""}${difference}`}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className="text-sm text-slate-600">{differences.length} écart(s) à ajuster</p>
        <Button loading={saving} disabled={!productArticles.length} onClick={() => void validateInventory()}>
          <ClipboardCheck size={17} aria-hidden="true" /> Valider l’inventaire
        </Button>
      </div>
    </div>
  );
}
