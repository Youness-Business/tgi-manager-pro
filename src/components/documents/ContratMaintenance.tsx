"use client";

import { amountToFrenchWords } from "@/lib/amountToFrenchWords";
import { contratClauses } from "@/config/contratClauses";
import { computeTotals } from "@/lib/computeTotals";
import { formatMoney } from "@/lib/formatMoney";
import { formatSafeDate } from "@/lib/formatSafeDate";
import type { Ascenseur, Client, Contrat, Document } from "@/types";
import { DocumentLayout } from "./DocumentLayout";

export function ContratMaintenance({
  contract,
  client,
  elevators,
}: {
  contract: Contrat;
  client: Client;
  elevators: readonly Ascenseur[];
}) {
  const lines = elevators.map((elevator) => ({
    articleId: elevator.id,
    reference: elevator.numeroSerie,
    designation: `${elevator.marque} ${elevator.modele} — ${elevator.site}`,
    qte: 1,
    prixUnitaireHT: 0,
  }));
  const printableDocument: Document = {
    id: contract.id,
    type: "bon_livraison",
    numero: contract.numero,
    clientId: contract.clientId,
    dateCreation: contract.dateDebut,
    statut: "en_attente",
    lignes: lines,
  };
  const totals = computeTotals([{
    articleId: contract.id,
    designation: "Redevance contractuelle",
    qte: 1,
    prixUnitaireHT: contract.montantHT,
  }]);

  return (
    <DocumentLayout
      document={printableDocument}
      client={client}
      titleOverride={contract.type === "maintenance" ? "CONTRAT DE MAINTENANCE" : "CONTRAT D’INSTALLATION"}
      showDefaultFooter={false}
      showPrintButton={false}
      contentAfterTable={
        <div className="mt-8 space-y-7">
          <section className="break-inside-avoid">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-600 print:text-slate-600">Objet et durée</h2>
            <div className="rounded-lg border border-slate-200 bg-white p-4 print:border-slate-200 print:bg-white">
              <p className="text-sm leading-6 text-slate-800 print:text-slate-800">
                Le présent contrat couvre {contract.type === "maintenance" ? "l’entretien et la maintenance" : "les prestations d’installation"} des équipements ci-dessus, du {formatSafeDate(contract.dateDebut)} au {formatSafeDate(contract.dateFin)}.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700 print:text-slate-700">
                Périodicité : {contract.periodicite} · Visites prévues : {contract.visitesParAn} par an · Reconduction automatique : {contract.reconductionAuto ? "oui" : "non"}.
              </p>
            </div>
          </section>
          <section className="break-inside-avoid">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-600 print:text-slate-600">Redevance</h2>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 print:border-slate-200 print:bg-slate-50">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-slate-600 print:text-slate-600">Montant HT par période</span>
                <strong className="tabular-nums text-slate-900 print:text-slate-900">{formatMoney(totals.totalHT)}</strong>
              </div>
              <div className="mt-2 flex justify-between gap-4 text-sm">
                <span className="text-slate-600 print:text-slate-600">TVA (20 %)</span>
                <span className="tabular-nums text-slate-900 print:text-slate-900">{formatMoney(totals.montantTVA)}</span>
              </div>
              <div className="mt-2 flex justify-between gap-4 border-t border-slate-200 pt-2 text-base font-bold text-blue-700 print:border-slate-200 print:text-blue-700">
                <span>Total TTC</span>
                <span className="tabular-nums">{formatMoney(totals.totalTTC)}</span>
              </div>
              <p className="mt-3 text-xs italic text-slate-700 print:text-slate-700">{amountToFrenchWords(totals.totalTTC)}.</p>
            </div>
          </section>
          {contract.conditionsParticulieres ? (
            <section className="break-inside-avoid">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600 print:text-slate-600">Conditions particulières</h2>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 print:text-slate-700">{contract.conditionsParticulieres}</p>
            </section>
          ) : null}
          <section className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 print:text-slate-600">Conditions générales</h2>
            {[
              ["Obligations du prestataire", contratClauses.prestataire],
              ["Obligations du client", contratClauses.client],
              ["Dépannage et pièces", contratClauses.depannage],
              ["Résiliation", contratClauses.resiliation],
            ].map(([title, clauses]) => (
              <div key={String(title)} className="break-inside-avoid">
                <h3 className="text-sm font-semibold text-slate-800 print:text-slate-800">{title}</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-700 print:text-slate-700">
                  {(clauses as readonly string[]).map((clause) => <li key={clause}>{clause}</li>)}
                </ul>
              </div>
            ))}
            <p className="break-inside-avoid text-xs leading-5 text-slate-700 print:text-slate-700">{contratClauses.juridiction}</p>
          </section>
          <section className="break-inside-avoid">
            <p className="mb-5 text-sm text-slate-700 print:text-slate-700">Fait à ____________________, le ____________________, en deux exemplaires.</p>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex h-32 flex-col items-center justify-between border border-dashed border-slate-300 p-3 text-center print:border-slate-300">
                <span className="text-sm font-semibold text-slate-700 print:text-slate-700">Le prestataire</span>
                <span className="text-xs text-slate-600 print:text-slate-600">Cachet et signature</span>
              </div>
              <div className="flex h-32 flex-col items-center justify-between border border-dashed border-slate-300 p-3 text-center print:border-slate-300">
                <span className="text-sm font-semibold text-slate-700 print:text-slate-700">Le client</span>
                <span className="text-xs text-slate-600 print:text-slate-600">Nom, cachet et signature</span>
              </div>
            </div>
          </section>
        </div>
      }
    />
  );
}
