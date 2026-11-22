"use client";

import { useMemo } from "react";
import Link from "@/lib/router";
import { ArrowUpRight, CircleDollarSign, Clock3 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useCreances } from "@/context/RecouvrementDataProvider";
import { computeBalanceAgee, computeDSO, computeSolde, getRetardJours } from "@/lib/recouvrement";
import { formatMoney } from "@/lib/formatMoney";
import type { UserRole } from "@/types";

export function ReceivablesSummaryCard({ role }: { role: UserRole | null }) {
  const { documents, paiements, loading, error } = useCreances();
  const summary = useMemo(() => {
    const outstanding = documents.reduce((sum, document) => sum + computeSolde(document, paiements), 0);
    const overdue = documents.reduce((sum, document) =>
      (getRetardJours(document.dateEcheance) ?? 0) > 0
        ? sum + computeSolde(document, paiements)
        : sum, 0);
    const openCount = documents.filter((document) => computeSolde(document, paiements) > 0.005).length;
    return {
      outstanding,
      overdue,
      openCount,
      dso: computeDSO(documents, paiements),
      aged: computeBalanceAgee(documents, paiements),
    };
  }, [documents, paiements]);

  return (
    <Card className="min-w-0 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <CircleDollarSign size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display font-bold text-slate-900">Recouvrement</h2>
            <p className="text-xs text-slate-500">Suivi des factures et échéances</p>
          </div>
        </div>
        <Link href="/recouvrement" className="inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600">
          Ouvrir le suivi <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </header>
      {error ? <p role="alert" className="m-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {loading ? (
        <p role="status" className="p-5 text-sm text-slate-600">Chargement des créances…</p>
      ) : role === "commercial" ? (
        <div className="flex flex-wrap items-center gap-3 p-5 sm:p-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Clock3 size={18} aria-hidden="true" />
          </span>
          <p className="text-sm text-slate-700">
            <strong className="tabular-nums">{summary.openCount}</strong> facture(s) de votre portefeuille à suivre.
          </p>
          <Link href="/recouvrement/creances" className="ml-auto text-sm font-semibold text-blue-700 underline-offset-4 hover:underline">Voir mes créances</Link>
        </div>
      ) : (
        <div className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Solde ouvert" value={formatMoney(summary.outstanding)} />
            <Metric label="En retard" value={formatMoney(summary.overdue)} />
            <Metric label="Factures ouvertes" value={String(summary.openCount)} />
            <Metric label="DSO estimé" value={`${summary.dso} j`} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {([
              ["Non échues", summary.aged.non_echue.montant],
              ["1–30 jours", summary.aged["1-30"].montant],
              ["31–60 jours", summary.aged["31-60"].montant],
              ["61–90 jours", summary.aged["61-90"].montant],
              ["Plus de 90 jours", summary.aged["90+"].montant],
            ] as const).map(([label, amount]) => (
              <div key={label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{formatMoney(amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-display text-lg font-bold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}
