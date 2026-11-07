"use client";

import { useState, type FormEvent } from "react";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/ToastProvider";
import { saveCatalogueArticle } from "@/lib/articles";
import type { Article, ArticleCategory, ArticleCout } from "@/types";

const categories: readonly ArticleCategory[] = [
  "Moteurs",
  "Câbles",
  "Portes",
  "Électronique",
  "Services",
];

type ArticleEditorDialogProps = {
  open: boolean;
  article: Article | null;
  costs: readonly ArticleCout[];
  articles: readonly Article[];
  onClose: () => void;
};

function blankArticle(): Article {
  return {
    id: "",
    reference: "",
    designation: "",
    categorie: "Moteurs",
    prixUnitaireHT: 0,
    unite: "unité",
    type: "produit",
    actif: true,
    stockQte: 0,
    seuilAlerte: 0,
    emplacement: "",
  };
}

function articleIdForReference(reference: string): string {
  const slug = reference
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `article-${slug}`;
}

export function ArticleEditorDialog({
  open,
  article,
  costs,
  articles,
  onClose,
}: ArticleEditorDialogProps) {
  const { showToast } = useToast();
  const [values, setValues] = useState<Article>(() => article ?? blankArticle());
  const initialCost = article
    ? costs.find((item) => item.articleId === article.id)
    : undefined;
  const [purchasePrice, setPurchasePrice] = useState(
    initialCost ? String(initialCost.prixAchatHT) : "",
  );
  const [supplier, setSupplier] = useState(
    initialCost?.fournisseurPrincipal ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isNew = article === null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reference = values.reference.trim();
    const duplicate = articles.some(
      (item) =>
        item.id !== article?.id &&
        item.reference.trim().toLocaleLowerCase("fr") ===
          reference.toLocaleLowerCase("fr"),
    );
    if (!reference || !values.designation.trim() || !values.unite.trim()) {
      setError("Renseignez la référence, la désignation et l’unité.");
      return;
    }
    if (duplicate) {
      setError("Cette référence existe déjà dans le catalogue.");
      return;
    }
    if (
      !Number.isFinite(values.prixUnitaireHT) ||
      values.prixUnitaireHT < 0 ||
      (values.type === "produit" &&
        (!Number.isFinite(values.seuilAlerte) ||
          (values.seuilAlerte ?? -1) < 0))
    ) {
      setError("Les prix et seuils doivent être des nombres positifs ou nuls.");
      return;
    }
    const id = isNew ? articleIdForReference(reference) : values.id;
    if (isNew && articles.some((item) => item.id === id)) {
      setError("Cette référence produit un identifiant déjà utilisé.");
      return;
    }
    const nextArticle: Article =
      values.type === "service"
        ? {
            id,
            reference,
            designation: values.designation.trim(),
            unite: values.unite.trim(),
            type: "service",
            actif: values.actif,
            categorie: "Services",
            prixUnitaireHT: values.prixUnitaireHT,
          }
        : {
            ...values,
            id,
            reference,
            designation: values.designation.trim(),
            unite: values.unite.trim(),
            type: "produit",
            stockQte: isNew ? 0 : values.stockQte,
            seuilAlerte: values.seuilAlerte ?? 0,
            emplacement: values.emplacement?.trim() ?? "",
          };
    const cost =
      values.type === "produit" && purchasePrice !== ""
        ? {
            prixAchatHT: Number(purchasePrice),
            fournisseurPrincipal: supplier,
          }
        : undefined;
    if (
      cost &&
      (!Number.isFinite(cost.prixAchatHT) || cost.prixAchatHT < 0)
    ) {
      setError("Le prix d’achat doit être un nombre positif ou nul.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveCatalogueArticle(nextArticle, isNew, cost);
      showToast(isNew ? "Article ajouté" : "Article modifié", reference);
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "L’article n’a pas pu être enregistré.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={isNew ? "Nouvel article" : "Modifier l’article"}
      description="Les coûts d’achat sont enregistrés séparément des données accessibles au commercial."
      onClose={() => {
        if (!saving) onClose();
      }}
      className="max-w-2xl"
    >
      <form onSubmit={submit} className="space-y-4">
        {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="article-reference" label="Référence" required>
            <Input id="article-reference" required value={values.reference} onChange={(event) => setValues((current) => ({ ...current, reference: event.target.value }))} />
          </Field>
          <Field id="article-designation" label="Désignation" required>
            <Input id="article-designation" required value={values.designation} onChange={(event) => setValues((current) => ({ ...current, designation: event.target.value }))} />
          </Field>
          <Field id="article-type" label="Type" required>
            <Select id="article-type" value={values.type} disabled={!isNew} onChange={(event) => {
              const type = event.target.value as Article["type"];
              setValues((current) => ({
                ...current,
                type,
                categorie: type === "service" ? "Services" : "Moteurs",
              }));
            }}>
              <option value="produit">Produit</option>
              <option value="service">Service</option>
            </Select>
          </Field>
          <Field id="article-category" label="Catégorie" required>
            <Select id="article-category" value={values.categorie} disabled={values.type === "service"} onChange={(event) => setValues((current) => ({ ...current, categorie: event.target.value as ArticleCategory }))}>
              {categories.filter((item) => item !== "Services").map((category) => <option key={category} value={category}>{category}</option>)}
              {values.type === "service" ? <option value="Services">Services</option> : null}
            </Select>
          </Field>
          <Field id="article-unit" label="Unité" required>
            <Input id="article-unit" required value={values.unite} onChange={(event) => setValues((current) => ({ ...current, unite: event.target.value }))} />
          </Field>
          <Field id="article-price" label="Prix de vente HT" required>
            <Input id="article-price" required type="number" min="0" step="0.01" value={values.prixUnitaireHT} onChange={(event) => setValues((current) => ({ ...current, prixUnitaireHT: Number(event.target.value) }))} />
          </Field>
          {values.type === "produit" ? (
            <>
              <Field id="article-threshold" label="Seuil d’alerte">
                <Input id="article-threshold" type="number" min="0" step="any" value={values.seuilAlerte ?? 0} onChange={(event) => setValues((current) => ({ ...current, seuilAlerte: Number(event.target.value) }))} />
              </Field>
              <Field id="article-location" label="Emplacement">
                <Input id="article-location" value={values.emplacement ?? ""} onChange={(event) => setValues((current) => ({ ...current, emplacement: event.target.value }))} />
              </Field>
              <div className="sm:col-span-2 grid gap-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4 sm:grid-cols-2">
                <Field id="article-purchase-price" label="Prix d’achat HT (confidentiel)">
                  <Input id="article-purchase-price" type="number" min="0" step="0.01" value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} />
                </Field>
                <Field id="article-supplier" label="Fournisseur principal">
                  <Input id="article-supplier" value={supplier} onChange={(event) => setSupplier(event.target.value)} />
                </Field>
              </div>
            </>
          ) : null}
        </div>
        <label className="flex min-h-9 items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={values.actif} onChange={(event) => setValues((current) => ({ ...current, actif: event.target.checked }))} className="h-4 w-4 accent-blue-600" />
          Article actif
        </label>
        {isNew && values.type === "produit" ? <p className="text-xs leading-5 text-slate-600">Le stock initial est à zéro. Utilisez une entrée ou l’inventaire pour enregistrer une quantité et son mouvement.</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={saving}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}
