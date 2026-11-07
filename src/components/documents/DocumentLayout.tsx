"use client";

import { useCompanySettings } from "@/context/CompanySettingsProvider";
import { amountToFrenchWords } from "@/lib/amountToFrenchWords";
import { computeDiscountedTotals } from "@/lib/computeDiscountedTotals";
import { formatSafeDate } from "@/lib/formatSafeDate";
import { documentStatusLabels } from "@/lib/documentLabels";
import { catalogue } from "@/data/catalogue";
import type { CompanySettings } from "@/context/CompanySettingsProvider";
import type {
  Client,
  Document as TgiDocument,
  DocumentStatus,
  PaymentMethod,
} from "@/types";
import type { ReactNode } from "react";
import { PrintButton } from "./PrintButton";

type DocumentLayoutProps = {
  document: TgiDocument;
  client: Client;
  remisePct?: number;
  modePaiement?: PaymentMethod;
  titleOverride?: string;
  contentAfterTable?: ReactNode;
  showDefaultFooter?: boolean;
  showPrintButton?: boolean;
  showLineItems?: boolean;
  showTotals?: boolean;
};

const paymentLabels: Record<PaymentMethod, string> = {
  especes: "Espèces",
  virement: "Virement",
  cheque: "Chèque",
  effet: "Effet de commerce",
};

const documentTitles = {
  facture: "FACTURE",
  devis: "DEVIS",
  recu: "REÇU",
  bon_livraison: "BON DE LIVRAISON",
} as const;

const statusClasses: Record<DocumentStatus, string> = {
  en_attente:
    "bg-amber-100 text-amber-800 print:bg-amber-100 print:text-amber-800",
  paye: "bg-emerald-100 text-emerald-800 print:bg-emerald-100 print:text-emerald-800",
  annule: "bg-slate-100 text-slate-700 print:bg-slate-100 print:text-slate-700",
  partiel:
    "bg-blue-100 text-blue-800 print:bg-blue-100 print:text-blue-800",
};

const currencyFormatter = new Intl.NumberFormat("fr-MA", {
  style: "currency",
  currency: "MAD",
});

function Logo({ company }: { company: CompanySettings }) {
  return (
    <div
      aria-label={company.name}
      className="flex items-center gap-3 text-blue-700 print:text-blue-700"
    >
      <svg
        aria-hidden="true"
        className="h-12 w-12 shrink-0"
        viewBox="0 0 48 48"
        fill="none"
      >
        <rect
          x="2"
          y="2"
          width="44"
          height="44"
          rx="10"
          fill="currentColor"
          className="print:fill-blue-700"
        />
        <path
          d="M15 14h18v5H20v4h11v5H20v6h-5V14Z"
          fill="white"
          className="print:fill-white"
        />
        <path
          d="M34 14v20h-5V14h5Z"
          fill="white"
          className="print:fill-white"
        />
      </svg>
      <span className="text-xl font-extrabold tracking-tight text-slate-900 print:text-slate-900">
        TGI <span className="text-blue-600 print:text-blue-600">ASCENSEURS</span>
      </span>
    </div>
  );
}

export function DocumentLayout({
  document,
  client,
  remisePct = document.remisePct ?? 0,
  modePaiement = document.modePaiement ?? "virement",
  titleOverride,
  contentAfterTable,
  showDefaultFooter = true,
  showPrintButton = true,
  showLineItems = true,
  showTotals = true,
}: DocumentLayoutProps) {
  const { company, error: companyError } = useCompanySettings();
  const totals = computeDiscountedTotals(document.lignes, remisePct);
  const isDelivery = document.type === "bon_livraison";
  const isReceipt = document.type === "recu";
  const displayPaymentStatus = document.type === "facture";

  return (
    <article
      className="w-full max-w-[210mm] mx-auto bg-white p-5 text-slate-900 shadow-sm sm:p-10 print:max-w-none print:p-0 print:text-slate-900 print:shadow-none"
      style={{
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {companyError ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 print:hidden"
        >
          Coordonnées société non synchronisées : {companyError}
        </p>
      ) : null}
      <header className="flex justify-between items-start border-b-2 border-blue-600 pb-6 mb-8 print:border-blue-600">
        <Logo company={company} />
        <address className="max-w-[52%] break-words text-right text-xs not-italic leading-5 text-slate-600 print:text-slate-600 sm:text-sm">
          <strong className="block text-sm text-slate-900 print:text-slate-900">
            {company.legalName}
          </strong>
          {company.address}
          <br />
          Tél. : {company.phone}
          <br />
          {company.email}
          <br />
          ICE : {company.ice} | RC : {company.rc}
          <br />
          IF : {company.taxId} | Patente : {company.patente}
          <br />
          RIB : {company.rib}
        </address>
      </header>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-[#F8FAFC] border-l-8 border-blue-600 p-4 sm:p-6 rounded-r-lg shadow-sm mb-8 overflow-hidden gap-4 print:bg-[#F8FAFC] print:border-blue-600">
        <h1 className="whitespace-nowrap text-2xl font-bold tracking-wide text-blue-700 print:text-blue-700 sm:text-3xl">
          {titleOverride ?? documentTitles[document.type]}
        </h1>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 print:text-slate-600">
              Référence
            </p>
            <p className="break-all font-semibold text-slate-900 print:text-slate-900">
              {document.numero}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 print:text-slate-600">
              Émis le
            </p>
            <p className="whitespace-nowrap font-medium text-slate-900 print:text-slate-900">
              {formatSafeDate(document.dateCreation)}
            </p>
          </div>
        </div>
      </div>

      <section
        aria-label="Informations du client"
        className="mb-8 break-inside-avoid"
      >
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600 print:text-slate-600">
          Client
        </h2>
        <div className="rounded-lg border border-gray-200 bg-white p-4 print:border-gray-200 print:bg-white">
          <p className="break-words font-semibold text-slate-900 print:text-slate-900">
            {client.nom}
          </p>
          <p className="break-words text-sm text-slate-600 print:text-slate-600">
            {client.adresse}
          </p>
          <p className="mt-1 text-sm text-slate-600 print:text-slate-600">
            Tél. : {client.telephone} <span aria-hidden="true">·</span> ICE :{" "}
            {client.ice}
          </p>
        </div>
      </section>

      {showLineItems ? <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[560px] border-collapse text-sm print:min-w-0">
          <thead className="table-header-group">
            <tr className="border-b border-slate-300 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600 print:border-slate-300 print:bg-slate-100 print:text-slate-600">
              {isDelivery ? (
                <th scope="col" className="px-3 py-3">
                  Référence
                </th>
              ) : null}
              <th scope="col" className="px-3 py-3">
                Désignation
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Qté
              </th>
              {!isDelivery && showTotals ? (
                <>
                  <th scope="col" className="px-3 py-3 text-right">
                    Prix unitaire HT
                  </th>
                  <th scope="col" className="px-3 py-3 text-right">
                    Total HT
                  </th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {document.lignes.map((ligne, index) => (
              <tr
                key={`${ligne.articleId}-${index}`}
                className="break-inside-avoid border-b border-slate-200 even:bg-slate-50 print:border-slate-200 print:even:bg-slate-50"
              >
                {isDelivery ? (
                  <td className="break-all px-3 py-3 font-mono text-xs text-slate-700 print:text-slate-700">
                    {ligne.reference ??
                      catalogue.find((article) => article.id === ligne.articleId)
                        ?.reference ??
                      ligne.articleId}
                  </td>
                ) : null}
                <td className="break-words px-3 py-3 text-slate-800 print:text-slate-800">
                  {ligne.designation}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-700 print:text-slate-700">
                  {ligne.qte}
                </td>
                {!isDelivery ? (
                  <>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700 print:text-slate-700">
                      {currencyFormatter.format(ligne.prixUnitaireHT)}
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-900 print:text-slate-900">
                      {currencyFormatter.format(ligne.qte * ligne.prixUnitaireHT)}
                    </td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div> : null}

      {contentAfterTable}

      {!isDelivery ? (
        <section
          aria-label="Totaux du document"
          className="ml-auto mt-6 w-full max-w-sm break-inside-avoid"
        >
          <dl className="space-y-2 border-b border-slate-200 pb-4 print:border-slate-200">
            <div className="flex justify-between gap-4 text-sm">
              <dt className="text-slate-600 print:text-slate-600">Sous-total HT</dt>
              <dd className="text-right font-medium tabular-nums text-slate-900 print:text-slate-900">
                {currencyFormatter.format(totals.sousTotalHT)}
              </dd>
            </div>
            {totals.remise > 0 ? (
              <div className="flex justify-between gap-4 text-sm">
                <dt className="text-slate-600 print:text-slate-600">
                  Remise ({remisePct} %)
                </dt>
                <dd className="text-right font-medium tabular-nums text-slate-900 print:text-slate-900">
                  −{currencyFormatter.format(totals.remise)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 text-sm">
              <dt className="text-slate-600 print:text-slate-600">Total HT</dt>
              <dd className="text-right font-medium tabular-nums text-slate-900 print:text-slate-900">
                {currencyFormatter.format(totals.totalHT)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <dt className="text-slate-600 print:text-slate-600">TVA (20 %)</dt>
              <dd className="text-right font-medium tabular-nums text-slate-900 print:text-slate-900">
                {currencyFormatter.format(totals.montantTVA)}
              </dd>
            </div>
          </dl>
          <div className="flex justify-between gap-4 pt-3 text-lg font-bold text-blue-700 print:text-blue-700">
            <span>{isReceipt ? "Montant reçu TTC" : "Total TTC"}</span>
            <span className="text-right tabular-nums">
              {currencyFormatter.format(totals.totalTTC)}
            </span>
          </div>
        </section>
      ) : null}

      {showDefaultFooter ? <footer className="mt-10 break-inside-avoid">
        {!isDelivery ? (
          <p className="break-words text-sm italic leading-6 text-slate-700 print:text-slate-700">
            {isReceipt
              ? `Reçu la somme de : ${amountToFrenchWords(totals.totalTTC).replace("Arrêtée la présente facture à la somme de : ", "")}.`
              : `${amountToFrenchWords(totals.totalTTC)}.`}
          </p>
        ) : null}
        {isReceipt ? (
          <p className="mt-3 text-sm text-slate-700 print:text-slate-700">
            Mode de paiement : <strong>{paymentLabels[modePaiement]}</strong>
          </p>
        ) : null}
        {document.type === "devis" ? (
          <p className="mt-3 text-sm font-semibold text-slate-700 print:text-slate-700">
            Validité : 30 jours à compter de la date d’émission.
          </p>
        ) : null}
        <p className="mt-4 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-600 print:border-slate-200 print:text-slate-600">
          {isDelivery
            ? `Livraison effectuée par ${company.legalName}.`
            : `Document émis par ${company.legalName}. Les prestations et fournitures sont soumises aux conditions générales de vente de la société.`}
        </p>
        <div className="mt-8 flex justify-end">
          <div className="flex h-32 w-64 flex-col items-center justify-between border border-dashed border-slate-300 p-3 text-center print:border-slate-300">
            <span className="text-sm font-semibold text-slate-700 print:text-slate-700">
              {isDelivery ? "Reçu par" : "Cachet et signature"}
            </span>
            <span className="text-xs text-slate-600 print:text-slate-600">
              Bon pour accord
            </span>
          </div>
        </div>
      </footer> : null}

      {showPrintButton ? (
        <div className="mt-8 flex justify-end print:hidden">
          <PrintButton />
        </div>
      ) : null}

      {displayPaymentStatus ? (
        <p className="mt-6 text-center text-xs text-slate-600 print:text-slate-600">
          Statut :{" "}
          <span
            className={`inline-flex rounded-full px-2.5 py-1 font-medium ${statusClasses[document.statut]}`}
          >
            {documentStatusLabels[document.statut]}
          </span>
        </p>
      ) : null}
    </article>
  );
}
