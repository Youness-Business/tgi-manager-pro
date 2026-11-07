"use client";

import {
  ArrowUpRight,
  FileClock,
  FileQuestion,
  ReceiptText,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useDocuments } from "@/context/DocumentsProvider";
import { useClients } from "@/context/FirestoreDataProvider";
import { DashboardInsights } from "@/components/dashboard/DashboardInsights";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getDashboardStats } from "@/lib/stats";
import { formatMoney } from "@/lib/formatMoney";
import { formatSafeDate } from "@/lib/formatSafeDate";
import { documentTypeLabels } from "@/lib/documentLabels";
import { documentTimestamp } from "@/lib/documentTimestamp";
import type { Document } from "@/types";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
}

function DashboardContent() {
  const { documents, loading: documentsLoading, error: documentsError } = useDocuments();
  const { items: clients, loading: clientsLoading, error: clientsError } = useClients();
  const { profile, role, user } = useAuth();
  const stats = useMemo(() => getDashboardStats(clients, documents), [clients, documents]);
  const revenueNow = stats.monthlyRevenue[stats.monthlyRevenue.length - 1]?.amount ?? 0;
  const revenuePrevious = stats.monthlyRevenue[stats.monthlyRevenue.length - 2]?.amount ?? 0;
  const revenueTrend =
    revenueNow === 0 && revenuePrevious === 0
      ? undefined
      : {
          label:
            revenuePrevious === 0
              ? "Nouveau"
              : `${Math.round(((revenueNow - revenuePrevious) / revenuePrevious) * 100)} %`,
          positive: revenueNow >= revenuePrevious,
        };
  const latestDocuments = useMemo(
    () =>
      [...documents]
        .sort(
          (left, right) =>
            documentTimestamp(right.dateCreation) -
            documentTimestamp(left.dateCreation),
        )
        .slice(0, 5),
    [documents],
  );
  const recentDocumentColumns: DataTableColumn<Document>[] = [
    {
      id: "document",
      header: "Document",
      render: (document) => (
        <Link
          href={`/documents/${document.id}`}
          className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <span className="block break-all font-semibold text-blue-700 hover:text-blue-800">
            {document.numero}
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">
            {documentTypeLabels[document.type]}
          </span>
        </Link>
      ),
    },
    {
      id: "client",
      header: "Client",
      className: "max-w-40 break-words",
      render: (document) =>
        clients.find((client) => client.id === document.clientId)?.nom ??
        "Client non renseigné",
    },
    {
      id: "date",
      header: "Date",
      render: (document) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatSafeDate(document.dateCreation)}
        </span>
      ),
    },
    {
      id: "statut",
      header: "Statut",
      render: (document) => <StatusBadge status={document.statut} />,
    },
  ];

  const firstName = profile?.nom.trim().split(/\s+/)[0] ?? "";
  const currentDate = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const isCommercial = role === "commercial";

  return (
    <div className="space-y-7">
      {documentsError || clientsError ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {documentsError ?? clientsError}
        </p>
      ) : null}
      {documentsLoading || clientsLoading ? (
        <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-card">
          Chargement des indicateurs…
        </p>
      ) : null}
      {!documentsLoading && !clientsLoading && !documents.length && !clients.length ? (
        <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Les collections Firestore sont vides. Un propriétaire peut importer
          les données de démonstration depuis les paramètres.
        </p>
      ) : null}
      <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-blue-700">{currentDate}</p>
          <h1 className="mt-1 break-words font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {greetingForHour(new Date().getHours())}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {isCommercial
              ? "Voici le suivi de vos clients et de vos documents."
              : "Voici la synthèse de l’activité de TGI Ascenseurs."}
          </p>
        </div>
        <Link
          href="/documents"
          className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:self-auto"
        >
          Tous les documents
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </header>

      <section
        aria-label="Indicateurs clés"
        className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label={isCommercial ? "Mes factures" : "CA du mois (HT)"}
          value={isCommercial ? String(documents.filter((item) => item.type === "facture").length) : formatMoney(stats.revenueThisMonth)}
          detail={isCommercial ? "Factures de votre portefeuille" : "Factures payées ce mois-ci"}
          icon={ReceiptText}
          iconClassName="bg-blue-50 text-blue-700"
          trend={isCommercial ? undefined : revenueTrend}
        />
        <StatCard
          label="Factures en attente"
          value={String(stats.pendingInvoicesCount)}
          detail={isCommercial ? "À suivre dans votre portefeuille" : `${formatMoney(stats.pendingInvoicesAmount)} TTC à encaisser`}
          icon={FileClock}
          iconClassName="bg-amber-50 text-amber-700"
        />
        <StatCard
          label="Clients"
          value={String(stats.clientCount)}
          detail="Clients enregistrés"
          icon={UsersRound}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          label="Devis en cours"
          value={String(stats.openQuotesCount)}
          detail={isCommercial ? "À relancer" : "En attente de réponse"}
          icon={FileQuestion}
          iconClassName="bg-violet-50 text-violet-700"
        />
      </section>

      <DashboardInsights
        clients={clients}
        documents={documents}
        role={role ?? "commercial"}
        currentUid={user?.uid}
      />

      <Card className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
          <div>
            <h2 className="font-display font-bold tracking-tight text-slate-900">
              Documents récents
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Les cinq dernières émissions
            </p>
          </div>
          <Link
            href="/documents"
            className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Tous les documents <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
        {latestDocuments.length > 0 ? (
          <DataTable
            caption="Les cinq documents les plus récents"
            columns={recentDocumentColumns}
            rows={latestDocuments}
            getRowKey={(document) => document.id}
            minWidthClassName="min-w-[560px]"
          />
        ) : (
          <p className="px-5 py-10 text-center text-sm text-slate-600">
            Aucun document à afficher pour le moment.
          </p>
        )}
      </Card>
    </div>
  );
}

export function DashboardView() {
  return (
    <Suspense
      fallback={
        <div role="status" className="min-h-48 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-card">
          Chargement du tableau de bord…
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
