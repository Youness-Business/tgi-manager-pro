"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Minus, Plus, Printer, Search, Trash2 } from "lucide-react";
import { DocumentRenderer } from "@/components/documents/DocumentRenderer";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/ToastProvider";
import { useDocuments } from "@/context/DocumentsProvider";
import { useArticles, useClients } from "@/context/FirestoreDataProvider";
import { useAuth } from "@/context/AuthProvider";
import { computeDiscountedTotals } from "@/lib/computeDiscountedTotals";
import { documentNumberPrefix } from "@/lib/documentNumber";
import { formatMoney } from "@/lib/formatMoney";
import {
  documentStatusLabels,
  documentTypeLabels,
} from "@/lib/documentLabels";
import type {
  Document,
  DocumentStatus,
  DocumentType,
  LigneDocument,
  PaymentMethod,
} from "@/types";

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: "especes", label: "Espèces" },
  { value: "virement", label: "Virement" },
  { value: "cheque", label: "Chèque" },
];

type FieldErrors = {
  clientId?: string;
  lignes?: string;
  remisePct?: string;
  dateCreation?: string;
  qte: Record<number, string | undefined>;
  prix: Record<number, string | undefined>;
};

function todayIso(): string {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function blankErrors(): FieldErrors {
  return { qte: {}, prix: {} };
}

export function DocumentGenerator() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const {
    addDocument,
    error: documentError,
    loading: documentsLoading,
  } = useDocuments();
  const {
    items: clients,
    loading: clientsLoading,
    error: clientsError,
  } = useClients();
  const {
    items: catalogue,
    loading: articlesLoading,
    error: articlesError,
  } = useArticles();
  const { role } = useAuth();
  const requestedType = searchParams.get("type");
  const allowedTypes: readonly DocumentType[] =
    role === "commercial"
      ? ["facture", "devis"]
      : ["facture", "devis", "recu", "bon_livraison"];
  const initialType = allowedTypes.find((documentType) => documentType === requestedType);
  const [type, setType] = useState<DocumentType>(initialType ?? "facture");
  const [clientId, setClientId] = useState("");
  const [dateCreation, setDateCreation] = useState(todayIso);
  const [statut, setStatut] = useState<DocumentStatus>("en_attente");
  const [modePaiement, setModePaiement] =
    useState<PaymentMethod>("virement");
  const [remisePct, setRemisePct] = useState(0);
  const [lignes, setLignes] = useState<LigneDocument[]>([]);
  const [articleQuery, setArticleQuery] = useState("");
  const [activeArticleIndex, setActiveArticleIndex] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>(blankErrors);
  const [activeTab, setActiveTab] = useState<"edition" | "apercu">("edition");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const selectedClient = clients.find((client) => client.id === clientId);
  const totals = useMemo(
    () => computeDiscountedTotals(lignes, remisePct),
    [lignes, remisePct],
  );
  const matchingArticles = useMemo(() => {
    const query = articleQuery.trim().toLocaleLowerCase("fr");
    if (!query) return catalogue;
    return catalogue.filter((article) =>
      `${article.reference} ${article.designation}`
        .toLocaleLowerCase("fr")
        .includes(query),
    );
  }, [articleQuery, catalogue]);

  const previewDocument: Document = {
    id: "document-apercu",
    type,
    numero: `${documentNumberPrefix(type)}-APERÇU`,
    clientId,
    dateCreation,
    lignes,
    statut,
    remisePct,
    ...(type === "recu" ? { modePaiement } : {}),
  };

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function confirmLinkNavigation(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank") return;
      const destination = new URL(link.href, window.location.href);
      if (destination.pathname === window.location.pathname) return;

      if (!window.confirm("Quitter sans enregistrer les modifications ?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", warnBeforeLeaving);
    document.addEventListener("click", confirmLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeLeaving);
      document.removeEventListener("click", confirmLinkNavigation, true);
    };
  }, [hasUnsavedChanges]);

  function addArticle(articleId: string) {
    const article = catalogue.find((item) => item.id === articleId);
    if (!article) return;
    setLignes((current) => [
      ...current,
      {
        articleId: article.id,
        reference: article.reference,
        designation: article.designation,
        qte: 1,
        prixUnitaireHT: article.prixUnitaireHT,
      },
    ]);
    setHasUnsavedChanges(true);
    setErrors((current) => ({ ...current, lignes: undefined }));
    setArticleQuery("");
  }

  function updateLine(
    index: number,
    field: "qte" | "prixUnitaireHT",
    value: number,
  ) {
    setLignes((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line,
      ),
    );
    setHasUnsavedChanges(true);
    if (field === "qte") {
      setErrors((current) => ({
        ...current,
        qte: { ...current.qte, [index]: undefined },
      }));
    } else {
      setErrors((current) => ({
        ...current,
        prix: { ...current.prix, [index]: undefined },
      }));
    }
  }

  function removeLine(index: number) {
    setLignes((current) => current.filter((_, lineIndex) => lineIndex !== index));
    setHasUnsavedChanges(true);
    setErrors((current) => ({ ...current, lignes: undefined }));
  }

  async function saveDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = blankErrors();
    if (!clientId) nextErrors.clientId = "Veuillez sélectionner un client.";
    if (!lignes.length) {
      nextErrors.lignes = "Ajoutez au moins une ligne au document.";
    }
    if (!dateCreation || Number.isNaN(Date.parse(dateCreation))) {
      nextErrors.dateCreation = "Veuillez saisir une date valide.";
    }
    if (!Number.isFinite(remisePct) || remisePct < 0 || remisePct > 100) {
      nextErrors.remisePct = "La remise doit être comprise entre 0 et 100 %.";
    }
    lignes.forEach((line, index) => {
      if (!Number.isFinite(line.qte) || line.qte <= 0) {
        nextErrors.qte[index] = "La quantité doit être supérieure à 0.";
      }
      if (
        !Number.isFinite(line.prixUnitaireHT) ||
        line.prixUnitaireHT < 0
      ) {
        nextErrors.prix[index] = "Le prix doit être un nombre positif ou nul.";
      }
    });
    setErrors(nextErrors);
    if (
      nextErrors.clientId ||
      nextErrors.lignes ||
      nextErrors.dateCreation ||
      nextErrors.remisePct ||
      Object.keys(nextErrors.qte).length > 0 ||
      Object.keys(nextErrors.prix).length > 0
    ) {
      setActiveTab("edition");
      return;
    }

    const newDocument: Document = {
      id: crypto.randomUUID(),
      type,
      numero: "",
      clientId,
      dateCreation,
      lignes,
      statut,
      remisePct,
      ...(type === "recu" ? { modePaiement } : {}),
    };
    setIsSaving(true);
    try {
      const savedDocument = await addDocument(newDocument);
      setHasUnsavedChanges(false);
      showToast(
        `Document ${savedDocument.numero} enregistré avec succès.`,
      );
      window.setTimeout(
        () => router.push(`/documents/${savedDocument.id}`),
        900,
      );
    } catch (saveError) {
      setErrors((current) => ({
        ...current,
        lignes:
          saveError instanceof Error
            ? saveError.message
            : "Le document n’a pas pu être enregistré dans Firestore.",
      }));
      setActiveTab("edition");
    } finally {
      setIsSaving(false);
    }
  }

  const errorId = (name: string) => `document-${name}-error`;

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const tabs = Array.from(
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]',
      ) ?? [],
    );
    if (tabs.length < 2) return;

    let nextIndex = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      const currentIndex = tabs.indexOf(event.currentTarget);
      nextIndex =
        (currentIndex + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) %
        tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    }
    if (nextIndex < 0) return;

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    setActiveTab(nextTab.dataset.panel === "preview" ? "apercu" : "edition");
    nextTab.focus();
  }

  function handleArticleSearchKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Escape") {
      setArticleQuery("");
      setActiveArticleIndex(0);
    } else if (event.key === "ArrowDown" && matchingArticles.length) {
      event.preventDefault();
      setActiveArticleIndex((index) =>
        Math.min(index + 1, matchingArticles.length - 1),
      );
    } else if (event.key === "ArrowUp" && matchingArticles.length) {
      event.preventDefault();
      setActiveArticleIndex((index) => Math.max(index - 1, 0));
    } else if (
      event.key === "Enter" &&
      articleQuery &&
      matchingArticles[activeArticleIndex]
    ) {
      event.preventDefault();
      addArticle(matchingArticles[activeArticleIndex].id);
    }
  }

  return (
    <div className="space-y-5 print:block">
      {clientsError || articlesError || documentError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 print:hidden"
        >
          {clientsError ?? articlesError ?? documentError}
        </p>
      ) : null}
      {clientsLoading || articlesLoading || documentsLoading ? (
        <p
          role="status"
          className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-slate-600 print:hidden"
        >
          Chargement des clients, du catalogue et des documents…
        </p>
      ) : null}
      <div
        className="flex flex-wrap gap-2 xl:hidden print:hidden"
        role="tablist"
        aria-label="Mode du générateur"
      >
        <button
          type="button"
          role="tab"
          id="document-editor-tab"
          aria-selected={activeTab === "edition"}
          aria-controls="document-editor-panel"
          data-panel="editor"
          tabIndex={activeTab === "edition" ? 0 : -1}
          onKeyDown={handleTabKeyDown}
          onClick={() => setActiveTab("edition")}
          className={`min-h-10 rounded-lg px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
            activeTab === "edition"
              ? "bg-blue-600 text-white"
              : "border border-gray-300 bg-white text-slate-700"
          }`}
        >
          Édition
        </button>
        <button
          type="button"
          role="tab"
          id="document-preview-tab"
          aria-selected={activeTab === "apercu"}
          aria-controls="document-preview-panel"
          data-panel="preview"
          tabIndex={activeTab === "apercu" ? 0 : -1}
          onKeyDown={handleTabKeyDown}
          onClick={() => setActiveTab("apercu")}
          className={`min-h-10 rounded-lg px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
            activeTab === "apercu"
              ? "bg-blue-600 text-white"
              : "border border-gray-300 bg-white text-slate-700"
          }`}
        >
          Aperçu
        </button>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
        <form
          id="document-editor-panel"
          role="tabpanel"
          aria-labelledby="document-editor-tab"
          onSubmit={saveDocument}
          noValidate
          className={`min-w-0 space-y-5 pb-20 print:hidden xl:pb-0 ${
            activeTab === "edition" ? "" : "hidden xl:block"
          }`}
        >
          <Card className="space-y-5 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Informations du document
            </h2>
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="document-type"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Type de document
                </label>
                <select
                  id="document-type"
                  value={type}
                  onChange={(event) => {
                    setType(event.target.value as DocumentType);
                    setHasUnsavedChanges(true);
                  }}
                  className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  {Object.entries(documentTypeLabels)
                    .filter(
                      ([value]) =>
                        role !== "commercial" ||
                        value === "facture" ||
                        value === "devis",
                    )
                    .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="document-status"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Statut
                </label>
                <select
                  id="document-status"
                  value={statut}
                  onChange={(event) => {
                    setStatut(event.target.value as DocumentStatus);
                    setHasUnsavedChanges(true);
                  }}
                  className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  {Object.entries(documentStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="document-client"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Client <span aria-hidden="true" className="text-red-600">*</span>
                </label>
                <select
                  id="document-client"
                  required
                  value={clientId}
                  aria-invalid={Boolean(errors.clientId)}
                  aria-describedby={errors.clientId ? errorId("client") : undefined}
                  onChange={(event) => {
                    setClientId(event.target.value);
                    setHasUnsavedChanges(true);
                    setErrors((current) => ({
                      ...current,
                      clientId: undefined,
                    }));
                  }}
                  className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <option value="">Sélectionner un client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.nom}
                    </option>
                  ))}
                </select>
                {errors.clientId ? (
                  <p id={errorId("client")} role="alert" className="mt-1 text-sm text-red-700">
                    {errors.clientId}
                  </p>
                ) : null}
                {selectedClient ? (
                  <p className="mt-2 break-words text-xs leading-5 text-slate-600">
                    ICE : {selectedClient.ice} · {selectedClient.adresse}
                  </p>
                ) : null}
              </div>
              <div>
                <label
                  htmlFor="document-date"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Date d’émission
                </label>
                <input
                  id="document-date"
                  type="date"
                  required
                  value={dateCreation}
                  aria-invalid={Boolean(errors.dateCreation)}
                  aria-describedby={
                    errors.dateCreation ? errorId("date") : undefined
                  }
                  onChange={(event) => {
                    setDateCreation(event.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                />
                {errors.dateCreation ? (
                  <p id={errorId("date")} role="alert" className="mt-1 text-sm text-red-700">
                    {errors.dateCreation}
                  </p>
                ) : null}
              </div>
              {type === "recu" ? (
                <div>
                  <label
                    htmlFor="document-payment"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Mode de paiement
                  </label>
                  <select
                    id="document-payment"
                    value={modePaiement}
                    onChange={(event) =>
                      {
                        setModePaiement(event.target.value as PaymentMethod);
                        setHasUnsavedChanges(true);
                      }
                    }
                    className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="space-y-4 p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Lignes du document
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Recherchez un article du catalogue pour l’ajouter.
              </p>
            </div>
            <div>
              <label
                htmlFor="catalogue-search"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Rechercher un article
              </label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  size={18}
                  className="pointer-events-none absolute left-3 top-3 text-slate-600"
                />
                <input
                  id="catalogue-search"
                  type="search"
                  value={articleQuery}
                  aria-invalid={Boolean(errors.lignes)}
                  aria-describedby={
                    errors.lignes ? errorId("lines") : undefined
                  }
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={Boolean(articleQuery)}
                  aria-controls="catalogue-options"
                  aria-activedescendant={
                    articleQuery && matchingArticles[activeArticleIndex]
                      ? `catalogue-option-${matchingArticles[activeArticleIndex].id}`
                      : undefined
                  }
                  onKeyDown={handleArticleSearchKeyDown}
                  onChange={(event) => {
                    setArticleQuery(event.target.value);
                    setActiveArticleIndex(0);
                  }}
                  placeholder="Référence ou désignation…"
                  className="min-h-11 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                />
              </div>
              <ul
                id="catalogue-options"
                role="listbox"
                aria-label="Articles disponibles"
                hidden={!articleQuery}
                className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-white"
              >
                {matchingArticles.length ? (
                  matchingArticles.map((article) => (
                    <li key={article.id} className="border-b border-gray-100 last:border-0">
                      <button
                        id={`catalogue-option-${article.id}`}
                        type="button"
                        role="option"
                        aria-selected={
                          matchingArticles[activeArticleIndex]?.id === article.id
                        }
                        tabIndex={-1}
                        onClick={() => addArticle(article.id)}
                        className={`flex min-h-12 w-full min-w-0 items-center justify-between gap-3 px-3 py-2 text-left hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600 ${
                          matchingArticles[activeArticleIndex]?.id === article.id
                            ? "bg-blue-50"
                            : ""
                        }`}
                      >
                        <span className="min-w-0 break-words">
                          <span className="block text-sm font-medium text-slate-800">
                            {article.designation}
                          </span>
                          <span className="block break-all text-xs text-slate-600">
                            {article.reference} · {article.unite}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-medium tabular-nums text-slate-800">
                          {formatMoney(article.prixUnitaireHT)}
                        </span>
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="p-3 text-sm text-slate-600">
                    Aucun article ne correspond à cette recherche.
                  </li>
                )}
              </ul>
              {errors.lignes ? (
                <p id={errorId("lines")} role="alert" className="mt-2 text-sm text-red-700">
                  {errors.lignes}
                </p>
              ) : null}
            </div>

            {lignes.length ? (
              <div className="space-y-3">
                {lignes.map((line, index) => (
                  <div
                    key={`${line.articleId}-${index}`}
                    className="min-w-0 rounded-lg border border-gray-200 bg-slate-50 p-3"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-slate-900">
                          {line.designation}
                        </p>
                        <p className="mt-1 break-all font-mono text-xs text-slate-600">
                          {line.reference ?? line.articleId}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Supprimer ${line.designation}`}
                        onClick={() => removeLine(index)}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </div>
                    <div className="mt-3 grid min-w-0 grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor={`line-quantity-${index}`}
                          className="mb-1 block text-xs font-medium text-slate-600"
                        >
                          Quantité
                        </label>
                        <div className="flex min-w-0 items-center">
                          <button
                            type="button"
                            aria-label={`Diminuer la quantité de ${line.designation}`}
                            onClick={() =>
                              updateLine(index, "qte", Math.max(1, line.qte - 1))
                            }
                            className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-l-lg border border-r-0 border-gray-300 bg-white text-slate-700 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-blue-600"
                          >
                            <Minus size={15} aria-hidden="true" />
                          </button>
                          <input
                            id={`line-quantity-${index}`}
                            type="number"
                            min="1"
                            step="any"
                            value={line.qte}
                            aria-invalid={Boolean(errors.qte[index])}
                            aria-describedby={
                              errors.qte[index]
                                ? errorId(`quantity-${index}`)
                                : undefined
                            }
                            onChange={(event) =>
                              updateLine(index, "qte", Number(event.target.value))
                            }
                            className="h-10 min-w-0 w-full border border-gray-300 bg-white px-2 text-center text-sm tabular-nums focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-blue-600"
                          />
                          <button
                            type="button"
                            aria-label={`Augmenter la quantité de ${line.designation}`}
                            onClick={() =>
                              updateLine(index, "qte", line.qte + 1)
                            }
                            className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-r-lg border border-l-0 border-gray-300 bg-white text-slate-700 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-blue-600"
                          >
                            <Plus size={15} aria-hidden="true" />
                          </button>
                        </div>
                        {errors.qte[index] ? (
                          <p
                            id={errorId(`quantity-${index}`)}
                            role="alert"
                            className="mt-1 text-xs text-red-700"
                          >
                            {errors.qte[index]}
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <label
                          htmlFor={`line-price-${index}`}
                          className="mb-1 block text-xs font-medium text-slate-600"
                        >
                          Prix unitaire HT
                        </label>
                        <input
                          id={`line-price-${index}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.prixUnitaireHT}
                          aria-invalid={Boolean(errors.prix[index])}
                          aria-describedby={
                            errors.prix[index]
                              ? errorId(`price-${index}`)
                              : undefined
                          }
                          onChange={(event) =>
                            updateLine(
                              index,
                              "prixUnitaireHT",
                              Number(event.target.value),
                            )
                          }
                          className="h-10 min-w-0 w-full rounded-lg border border-gray-300 bg-white px-2 text-right text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-blue-600"
                        />
                        {errors.prix[index] ? (
                          <p
                            id={errorId(`price-${index}`)}
                            role="alert"
                            className="mt-1 text-xs text-red-700"
                          >
                            {errors.prix[index]}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-slate-600">
                Aucune ligne ajoutée.
              </p>
            )}

            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="document-discount"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Remise (%)
                </label>
                <input
                  id="document-discount"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={remisePct}
                  aria-invalid={Boolean(errors.remisePct)}
                  aria-describedby={
                    errors.remisePct ? errorId("discount") : undefined
                  }
                  onChange={(event) =>
                    {
                      setRemisePct(Number(event.target.value));
                      setHasUnsavedChanges(true);
                    }
                  }
                  className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                />
                {errors.remisePct ? (
                  <p id={errorId("discount")} role="alert" className="mt-1 text-sm text-red-700">
                    {errors.remisePct}
                  </p>
                ) : null}
              </div>
              <dl className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm shadow-sm lg:sticky lg:top-24">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-600">Sous-total HT</dt>
                  <dd className="font-medium tabular-nums">
                    {formatMoney(totals.sousTotalHT)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-600">Remise</dt>
                  <dd className="font-medium tabular-nums">
                    −{formatMoney(totals.remise)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-600">Total HT</dt>
                  <dd className="font-medium tabular-nums">
                    {formatMoney(totals.totalHT)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-600">TVA (20 %)</dt>
                  <dd className="font-medium tabular-nums">
                    {formatMoney(totals.montantTVA)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-gray-200 pt-1.5 font-semibold text-blue-700">
                  <dt>Total TTC</dt>
                  <dd className="tabular-nums">{formatMoney(totals.totalTTC)}</dd>
                </div>
              </dl>
            </div>
            <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur print:hidden sm:px-6 xl:static xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none xl:backdrop-blur-none">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-70 xl:flex-none xl:min-w-36"
              >
                {isSaving ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:px-4 sm:text-sm"
              >
                <Printer size={17} aria-hidden="true" />
                Imprimer / PDF
              </button>
            </div>
          </Card>
        </form>

        <section
          id="document-preview-panel"
          role="tabpanel"
          aria-labelledby="document-preview-tab"
          aria-label="Aperçu du document"
          className={`min-w-0 print:block ${
            activeTab === "apercu" ? "" : "hidden xl:block"
          }`}
        >
          <div className="mb-3 hidden items-center justify-between xl:flex print:hidden">
            <h2 className="font-semibold text-slate-800">Aperçu</h2>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <Printer size={16} aria-hidden="true" />
              Imprimer
            </button>
          </div>
          {selectedClient ? (
            <div className="min-w-0 overflow-x-auto rounded-xl print:overflow-visible print:rounded-none">
              <DocumentRenderer document={previewDocument} client={selectedClient} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-slate-600">
              Sélectionnez un client pour afficher l’aperçu du document.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
