"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUpRight, Boxes, Minus, Plus, SlidersHorizontal } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { Button, Field, Input, Textarea } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/overlays";
import { StockStatusBadge } from "@/components/stock/StockStatusBadge";
import { useAuth } from "@/context/AuthProvider";
import { useArticles } from "@/context/FirestoreDataProvider";
import { useStockMovements } from "@/context/StockDataProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { applyStockMovement } from "@/lib/stockTransactions";
import { formatSafeDate } from "@/lib/formatSafeDate";
import { can } from "@/lib/permissions";
import type { StockMovement, StockMovementType } from "@/types";

const movementLabels: Record<StockMovementType, string> = {
  entree: "Entrée",
  sortie: "Sortie",
  ajustement: "Ajustement",
};

const sourceLabels: Record<StockMovement["source"], string> = {
  manuel: "Manuel",
  document: "Document",
  intervention: "Intervention",
  inventaire: "Inventaire",
};

function StockEvolutionChart({
  movements,
  currentQuantity,
}: {
  movements: readonly StockMovement[];
  currentQuantity: number;
}) {
  const points = useMemo(() => {
    const ordered = [...movements].reverse();
    const values = ordered.length
      ? [ordered[0].qteAvant, ...ordered.map((movement) => movement.qteApres)]
      : [currentQuantity];
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = Math.max(1, max - min);
    return values.map((value, index) => ({
      value,
      x: values.length === 1 ? 300 : 24 + (index / (values.length - 1)) * 552,
      y: 145 - ((value - min) / range) * 112,
    }));
  }, [currentQuantity, movements]);
  const line = points.map(({ x, y }) => `${x},${y}`).join(" ");

  return (
    <figure className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <figcaption className="font-display text-sm font-bold text-slate-900">
        Évolution du stock
      </figcaption>
      <svg
        role="img"
        aria-label={`Évolution de la quantité en stock, quantité actuelle ${currentQuantity}`}
        viewBox="0 0 600 180"
        className="mt-4 h-44 w-full overflow-visible"
      >
        <title>Évolution de la quantité en stock</title>
        <desc>
          La courbe représente les quantités après chaque mouvement.
        </desc>
        <line x1="24" y1="145" x2="576" y2="145" stroke="#cbd5e1" />
        <polyline
          points={line}
          fill="none"
          stroke="#2563eb"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((point, index) => (
          <circle
            key={`${point.x}-${index}`}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="#2563eb"
          />
        ))}
        <text x="24" y="170" fill="#64748b" fontSize="11">
          {movements.length ? "Début de l’historique" : "Aucun mouvement"}
        </text>
        <text x="576" y="170" textAnchor="end" fill="#64748b" fontSize="11">
          Actuel : {currentQuantity}
        </text>
      </svg>
    </figure>
  );
}

export function StockArticleDetails({ articleId }: { articleId: string }) {
  const { items: articles, loading: articlesLoading, error: articlesError } = useArticles();
  const { items: movements, loading: movementsLoading, error: movementsError } =
    useStockMovements(articleId);
  const { role, user, profile } = useAuth();
  const { showToast } = useToast();
  const [movementType, setMovementType] = useState<StockMovementType | null>(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [supplier, setSupplier] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const article = articles.find((item) => item.id === articleId);
  const mayManage = can(role, "update", "stock");

  const columns: DataTableColumn<StockMovement>[] = [
    { id: "date", header: "Date", render: (movement) => formatSafeDate(movement.date) },
    { id: "type", header: "Mouvement", render: (movement) => movementLabels[movement.type] },
    { id: "quantity", header: "Quantité", align: "right", render: (movement) => <span className="tabular-nums">{movement.qte}</span> },
    { id: "state", header: "Avant → après", align: "right", render: (movement) => <span className="tabular-nums">{movement.qteAvant} → {movement.qteApres}</span> },
    { id: "reason", header: "Motif", render: (movement) => movement.motif },
    { id: "author", header: "Saisi par", render: (movement) => movement.userName ?? movement.userId },
    {
      id: "source",
      header: "Origine",
      render: (movement) => (
        <span className="inline-flex items-center gap-1">
          {movement.source === "document" && movement.documentId ? (
            <Link href={`/documents/${movement.documentId}`} className="inline-flex items-center gap-1 text-blue-700 hover:underline">
              {sourceLabels[movement.source]} <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          ) : movement.source === "intervention" && movement.interventionId ? (
            <Link href={`/interventions/${movement.interventionId}`} className="inline-flex items-center gap-1 text-blue-700 hover:underline">
              {sourceLabels[movement.source]} <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          ) : sourceLabels[movement.source]}
        </span>
      ),
    },
  ];

  async function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!article || !movementType || !user) return;
    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0 || !reason.trim()) {
      setFormError("Saisissez une quantité positive et un motif obligatoire.");
      return;
    }
    if (movementType === "entree" && !supplier.trim()) {
      setFormError("Le fournisseur est obligatoire pour une entrée.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await applyStockMovement(
        {
          articleId: article.id,
          type: movementType,
          qte: parsedQuantity,
          motif: reason.trim(),
          source: "manuel",
          ...(movementType === "entree" ? { fournisseur: supplier.trim() } : {}),
        },
        user.uid,
        profile?.nom,
      );
      showToast(`${movementLabels[movementType]} enregistrée`, article.reference);
      setMovementType(null);
      setQuantity("");
      setReason("");
      setSupplier("");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Le mouvement n’a pas pu être enregistré.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (articlesLoading) {
    return <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Chargement de l’article…</p>;
  }
  if (articlesError) {
    return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{articlesError}</p>;
  }
  if (!article || article.type !== "produit") {
    return <EmptyState icon={Boxes} title="Produit introuvable" message="Cet article n’existe pas ou ne gère pas de stock." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/stock" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-white focus-visible:outline-2 focus-visible:outline-blue-600">
          <ArrowLeft size={17} aria-hidden="true" /> Retour au stock
        </Link>
        {mayManage ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setMovementType("entree")}><Plus size={16} aria-hidden="true" /> Entrée</Button>
            <Button variant="secondary" onClick={() => setMovementType("sortie")}><Minus size={16} aria-hidden="true" /> Sortie</Button>
            <Button variant="secondary" onClick={() => setMovementType("ajustement")}><SlidersHorizontal size={16} aria-hidden="true" /> Ajustement</Button>
          </div>
        ) : null}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="break-all font-mono text-xs font-semibold text-blue-700">{article.reference}</p>
            <h1 className="mt-2 break-words font-display text-2xl font-bold text-slate-950 sm:text-3xl">{article.designation}</h1>
            <p className="mt-2 text-sm text-slate-600">{article.categorie} · {article.emplacement || "Emplacement non renseigné"}</p>
          </div>
          <StockStatusBadge article={article} />
        </div>
        <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
          <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Stock actuel</dt><dd className="mt-1 text-xl font-bold tabular-nums text-slate-950">{article.stockQte ?? 0} <span className="text-sm font-medium">{article.unite}</span></dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Seuil d’alerte</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-slate-800">{article.seuilAlerte ?? 0} {article.unite}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Mouvements enregistrés</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-slate-800">{movements.length}</dd></div>
        </dl>
      </section>

      {movementsError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{movementsError}</p> : null}
      {!movementsLoading ? <StockEvolutionChart movements={movements} currentQuantity={article.stockQte ?? 0} /> : <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Chargement de l’historique…</p>}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-slate-900">Historique des mouvements</h2>
        {movementsLoading ? <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Chargement des mouvements…</p> : movements.length ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <DataTable caption={`Mouvements de stock pour ${article.designation}`} columns={columns} rows={movements} getRowKey={(movement) => movement.id} minWidthClassName="min-w-[900px]" />
          </div>
        ) : (
          <EmptyState icon={Boxes} title="Aucun mouvement" message="Les entrées, sorties et ajustements apparaîtront ici." />
        )}
      </section>

      <Modal open={Boolean(movementType)} title={`${movementType ? movementLabels[movementType] : "Mouvement"} de stock`} description={movementType === "ajustement" ? "La quantité saisie correspond au stock physique constaté." : "Le stock et son historique seront modifiés dans une transaction atomique."} onClose={() => { if (!saving) setMovementType(null); }}>
        <form onSubmit={saveMovement} className="space-y-4">
          {formError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{formError}</p> : null}
          {movementType === "ajustement" ? (
            <Field id="stock-adjustment-quantity" label={`Quantité constatée (${article.unite})`} required>
              <Input id="stock-adjustment-quantity" required type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </Field>
          ) : (
            <Field id="stock-movement-quantity" label={`Quantité (${article.unite})`} required>
              <Input id="stock-movement-quantity" required type="number" min="0.000001" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </Field>
          )}
          {movementType === "entree" ? (
            <Field id="stock-movement-supplier" label="Fournisseur" required>
              <Input id="stock-movement-supplier" required value={supplier} onChange={(event) => setSupplier(event.target.value)} />
            </Field>
          ) : null}
          <Field id="stock-movement-reason" label="Motif" required>
            <Textarea id="stock-movement-reason" required value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setMovementType(null)}>Annuler</Button>
            <Button type="submit" loading={saving}>Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
