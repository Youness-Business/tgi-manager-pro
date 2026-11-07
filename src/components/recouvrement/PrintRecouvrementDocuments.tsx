"use client";

import { DocumentLayout } from "@/components/documents/DocumentLayout";
import { formatMoney } from "@/lib/formatMoney";
import { formatSafeDate } from "@/lib/formatSafeDate";
import type { Client, Document, Paiement, Relance } from "@/types";

type Props = {
  client: Client;
  document: Document;
  message: string;
};

export function LettreRelance({ client, document, message }: Props) {
  return (
    <div className="hidden print:block">
      <DocumentLayout
        document={document}
        client={client}
        titleOverride="LETTRE DE RELANCE"
        showDefaultFooter={false}
        showPrintButton={false}
        showLineItems={false}
        showTotals={false}
        contentAfterTable={
          <section className="break-inside-avoid whitespace-pre-line text-sm leading-7 text-slate-800 print:text-slate-800">
            {message}
            <p className="mt-10">Fait à Casablanca, le {formatSafeDate(new Date())}</p>
            <div className="mt-12 flex justify-end">
              <div className="flex h-28 w-64 flex-col items-center justify-between border border-dashed border-slate-300 p-3 text-center print:border-slate-300">
                <span className="text-sm font-semibold text-slate-700 print:text-slate-700">Cachet et signature</span>
                <span className="text-xs text-slate-600 print:text-slate-600">TGI Ascenseurs</span>
              </div>
            </div>
          </section>
        }
      />
    </div>
  );
}

export function ReleveCompte({
  client,
  invoices,
  payments,
  reminders,
  balance,
}: {
  client: Client;
  invoices: readonly Document[];
  payments: readonly Paiement[];
  reminders: readonly Relance[];
  balance: number;
}) {
  const statement: Document = {
    id: `releve-${client.id}`,
    type: "recu",
    numero: `REL-${new Date().getFullYear()}-${client.id}`,
    clientId: client.id,
    dateCreation: new Date(),
    lignes: [],
    statut: "en_attente",
  };
  const relatedPayments = payments.filter((payment) => payment.clientId === client.id);
  const relatedReminders = reminders.filter((reminder) => reminder.clientId === client.id);
  return (
    <DocumentLayout
      document={statement}
      client={client}
      titleOverride="RELEVÉ DE COMPTE"
      showDefaultFooter={false}
      showPrintButton={false}
      showLineItems={false}
      showTotals={false}
      contentAfterTable={
        <div className="space-y-7">
          <section aria-label="Factures du client">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700 print:text-slate-700">Factures et soldes</h2>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[560px] border-collapse text-sm print:min-w-0">
                <thead className="table-header-group">
                  <tr className="border-b border-slate-300 bg-slate-100 text-left text-xs uppercase text-slate-600 print:border-slate-300 print:bg-slate-100 print:text-slate-600">
                    <th scope="col" className="px-3 py-2">Facture</th>
                    <th scope="col" className="px-3 py-2">Échéance</th>
                    <th scope="col" className="px-3 py-2 text-right">TTC</th>
                    <th scope="col" className="px-3 py-2 text-right">Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.filter((invoice) => invoice.clientId === client.id).map((invoice) => (
                    <tr key={invoice.id} className="break-inside-avoid border-b border-slate-200 even:bg-slate-50 print:border-slate-200 print:even:bg-slate-50">
                      <td className="break-all px-3 py-2 font-medium text-slate-900 print:text-slate-900">{invoice.numero}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700 print:text-slate-700">{formatSafeDate(invoice.dateEcheance)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700 print:text-slate-700">{formatMoney(invoice.montantTTC ?? 0)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-slate-900 print:text-slate-900">{formatMoney(invoice.montantPaye === undefined ? invoice.montantTTC ?? 0 : Math.max(0, (invoice.montantTTC ?? 0) - invoice.montantPaye))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="break-inside-avoid" aria-label="Historique des paiements">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700 print:text-slate-700">Paiements enregistrés</h2>
            {relatedPayments.length ? (
              <ul className="divide-y divide-slate-200 border-y border-slate-200">
                {relatedPayments.map((payment) => (
                  <li key={payment.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                    <span className="text-slate-700 print:text-slate-700">{payment.reference} · {formatSafeDate(payment.date)} · {payment.statut}</span>
                    <span className="font-semibold tabular-nums text-slate-900 print:text-slate-900">{formatMoney(payment.montant)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-600 print:text-slate-600">Aucun paiement enregistré.</p>}
          </section>
          <section className="break-inside-avoid border-t-2 border-blue-600 pt-4 print:border-blue-600">
            <p className="flex justify-between gap-4 text-lg font-bold text-blue-700 print:text-blue-700">
              <span>Solde total dû</span>
              <span className="whitespace-nowrap tabular-nums">{formatMoney(balance)}</span>
            </p>
          </section>
          {relatedReminders.length ? (
            <section aria-label="Historique des relances">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700 print:text-slate-700">Historique des relances et promesses</h2>
              <ul className="space-y-2">
                {relatedReminders.map((reminder) => (
                  <li key={reminder.id} className="break-inside-avoid rounded-lg border border-slate-200 p-3 print:border-slate-200">
                    <p className="text-xs font-semibold text-slate-600 print:text-slate-600">{formatSafeDate(reminder.date)} · Niveau {reminder.niveau} · {reminder.canal}</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-800 print:text-slate-800">{reminder.note}</p>
                    {reminder.promessePaiementDate ? <p className="mt-1 text-xs text-slate-600 print:text-slate-600">Promesse : {formatSafeDate(reminder.promessePaiementDate)}{reminder.promesseMontant ? ` · ${formatMoney(reminder.promesseMontant)}` : ""}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      }
    />
  );
}
