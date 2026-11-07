"use client";

import { formatSafeDate } from "@/lib/formatSafeDate";
import type { Ascenseur, Client, Intervention, Document } from "@/types";
import { DocumentLayout } from "./DocumentLayout";

export function BonIntervention({
  intervention,
  elevator,
  client,
}: {
  intervention: Intervention;
  elevator: Ascenseur;
  client: Client;
}) {
  const printableDocument: Document = {
    id: intervention.id,
    type: "bon_livraison",
    numero: intervention.numero,
    clientId: client.id,
    dateCreation: intervention.date,
    statut: "en_attente",
    lignes: intervention.piecesUtilisees.length
      ? intervention.piecesUtilisees.map((piece) => ({
          articleId: piece.articleId,
          reference: piece.articleId,
          designation: piece.designation,
          qte: piece.qte,
          prixUnitaireHT: 0,
        }))
      : [{
          articleId: intervention.id,
          reference: intervention.type.toLocaleUpperCase("fr"),
          designation: intervention.rapport || intervention.descriptionProbleme || "Intervention technique",
          qte: 1,
          prixUnitaireHT: 0,
        }],
  };

  return (
    <DocumentLayout
      document={printableDocument}
      client={client}
      titleOverride="BON D’INTERVENTION"
      showDefaultFooter={false}
      showPrintButton={false}
      contentAfterTable={
        <div className="mt-7 space-y-6">
          <section className="break-inside-avoid rounded-lg border border-slate-200 p-4 print:border-slate-200">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600 print:text-slate-600">Installation et intervention</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-slate-600 print:text-slate-600">Site</dt><dd className="mt-1 break-words font-medium text-slate-900 print:text-slate-900">{elevator.site}</dd></div>
              <div><dt className="text-xs text-slate-600 print:text-slate-600">Ascenseur</dt><dd className="mt-1 break-words font-medium text-slate-900 print:text-slate-900">{elevator.marque} {elevator.modele}</dd></div>
              <div><dt className="text-xs text-slate-600 print:text-slate-600">N° de série</dt><dd className="mt-1 break-all font-mono text-xs font-medium text-slate-900 print:text-slate-900">{elevator.numeroSerie}</dd></div>
              <div><dt className="text-xs text-slate-600 print:text-slate-600">Type</dt><dd className="mt-1 font-medium text-slate-900 print:text-slate-900">{intervention.type}</dd></div>
              <div><dt className="text-xs text-slate-600 print:text-slate-600">Technicien</dt><dd className="mt-1 break-words font-medium text-slate-900 print:text-slate-900">{intervention.technicien}</dd></div>
              <div><dt className="text-xs text-slate-600 print:text-slate-600">Durée</dt><dd className="mt-1 font-medium tabular-nums text-slate-900 print:text-slate-900">{intervention.duree} min</dd></div>
              <div><dt className="text-xs text-slate-600 print:text-slate-600">Date</dt><dd className="mt-1 font-medium text-slate-900 print:text-slate-900">{formatSafeDate(intervention.date)}</dd></div>
            </dl>
          </section>
          {intervention.descriptionProbleme ? (
            <section className="break-inside-avoid">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600 print:text-slate-600">Problème signalé</h2>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800 print:text-slate-800">{intervention.descriptionProbleme}</p>
            </section>
          ) : null}
          <section className="break-inside-avoid">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600 print:text-slate-600">Travaux réalisés</h2>
            <p className="min-h-24 whitespace-pre-wrap break-words rounded-lg border border-slate-200 p-4 text-sm leading-6 text-slate-800 print:border-slate-200 print:text-slate-800">{intervention.rapport}</p>
          </section>
          <section className="break-inside-avoid">
            <div className="grid grid-cols-2 gap-6">
              <div className="flex h-32 flex-col items-center justify-between border border-dashed border-slate-300 p-3 text-center print:border-slate-300">
                <span className="text-sm font-semibold text-slate-700 print:text-slate-700">Technicien</span>
                <span className="text-xs text-slate-600 print:text-slate-600">{intervention.technicien} · Signature</span>
              </div>
              <div className="flex h-32 flex-col items-center justify-between border border-dashed border-slate-300 p-3 text-center print:border-slate-300">
                <span className="text-sm font-semibold text-slate-700 print:text-slate-700">Client</span>
                <span className="text-xs text-slate-600 print:text-slate-600">{intervention.signatureClient ? `${intervention.nomSignataire} · Signé` : "Nom et signature"}</span>
              </div>
            </div>
          </section>
        </div>
      }
    />
  );
}
