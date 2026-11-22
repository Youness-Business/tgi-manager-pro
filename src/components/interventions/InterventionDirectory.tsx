"use client";

import { useMemo, useState } from "react";
import Link from "@/lib/router";
import { ClipboardCheck, FilePlus2, Printer } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button, Field, Input, Select, Tabs, Textarea } from "@/components/ui/primitives";
import { Modal, ConfirmDialog } from "@/components/ui/overlays";
import { useAuth } from "@/context/AuthProvider";
import { useArticles } from "@/context/FirestoreDataProvider";
import { useClients } from "@/context/FirestoreDataProvider";
import { useAscenseurs, useInterventions } from "@/context/OperationsDataProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { closeIntervention, type CloseInterventionInput } from "@/lib/operations";
import { documentTimestamp } from "@/lib/documentTimestamp";
import { formatSafeDate } from "@/lib/formatSafeDate";
import { normalizeSearch } from "@/lib/normalizeSearch";
import { can } from "@/lib/permissions";
import { StockInsufficientError } from "@/lib/stock";
import type { Intervention, PieceIntervention } from "@/types";

type TabId = "a_planifier" | "planifiees" | "terminees";

function dayKey(value: Intervention["date"]): string {
  const date = new Date(documentTimestamp(value));
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function InterventionDirectory() {
  const { items: interventions, loading, error } = useInterventions();
  const { items: elevators } = useAscenseurs();
  const { items: clients } = useClients();
  const { items: articles } = useArticles();
  const { profile, role } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<TabId>("planifiees");
  const [typeFilter, setTypeFilter] = useState("");
  const [technicianFilter, setTechnicianFilter] = useState("");
  const [elevatorFilter, setElevatorFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [weekOnly, setWeekOnly] = useState(true);
  const [closing, setClosing] = useState<Intervention | null>(null);
  const [report, setReport] = useState("");
  const [duration, setDuration] = useState("");
  const [signer, setSigner] = useState("");
  const [signed, setSigned] = useState(false);
  const [resumeAfterBreakdown, setResumeAfterBreakdown] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [parts, setParts] = useState<PieceIntervention[]>([]);
  const [submitError, setSubmitError] = useState("");
  const [stockShortage, setStockShortage] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmResume, setConfirmResume] = useState(false);
  const canEdit = can(role, "update", "interventions");

  const byId = useMemo(() => new Map(elevators.map((item) => [item.id, item])), [elevators]);
  const filtered = useMemo(() => interventions
    .filter((item) => item.statut === tab)
    .filter((item) => !typeFilter || item.type === typeFilter)
    .filter((item) => !technicianFilter || normalizeSearch(item.technicien).includes(normalizeSearch(technicianFilter)))
    .filter((item) => !elevatorFilter || item.ascenseurId === elevatorFilter)
    .filter((item) => {
      const timestamp = documentTimestamp(item.date);
      const from = fromFilter ? new Date(`${fromFilter}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
      const to = toFilter ? new Date(`${toFilter}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
      if (timestamp < from || timestamp > to) return false;
      if (tab !== "planifiees" || !weekOnly) return true;
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return timestamp >= start.getTime() && timestamp < end.getTime();
    })
    .sort((left, right) => documentTimestamp(left.date) - documentTimestamp(right.date)),
  [elevatorFilter, fromFilter, interventions, tab, technicianFilter, toFilter, typeFilter, weekOnly]);
  const groupedByDay = useMemo(() => {
    const groups = new Map<string, Intervention[]>();
    filtered.forEach((item) => {
      const key = dayKey(item.date);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    });
    return [...groups.entries()];
  }, [filtered]);

  const columns: DataTableColumn<Intervention>[] = [
    { id: "number", header: "Intervention", render: (item) => <Link className="font-semibold text-blue-700 hover:text-blue-800" href={`/interventions/${item.id}`}>{item.numero}</Link> },
    { id: "scheduled", header: "Date prévue", render: (item) => <span className="whitespace-nowrap tabular-nums">{formatSafeDate(item.date)}</span> },
    { id: "elevator", header: "Ascenseur / site", render: (item) => {
      const elevator = byId.get(item.ascenseurId);
      return elevator ? <Link className="text-blue-700 hover:text-blue-800" href={`/parc/${elevator.id}`}>{elevator.marque} {elevator.modele} · {elevator.site}</Link> : "Ascenseur introuvable";
    } },
    { id: "client", header: "Client", render: (item) => {
      const elevator = byId.get(item.ascenseurId);
      return clients.find((client) => client.id === elevator?.clientId)?.nom ?? "—";
    } },
    { id: "type", header: "Type", render: (item) => item.type === "visite" ? "Visite" : item.type === "depannage" ? "Dépannage" : "Installation" },
    { id: "technician", header: "Technicien", render: (item) => item.technicien },
    { id: "actions", header: "Actions", render: (item) => <div className="flex items-center gap-1">
      {item.statut === "terminee" ? <Link aria-label={`Imprimer le bon ${item.numero}`} title="Imprimer le bon" href={`/interventions/${item.id}/bon`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"><Printer size={16} aria-hidden="true" /></Link> : null}
      {canEdit && item.statut !== "terminee" ? <Button size="sm" variant="secondary" onClick={() => openClose(item)}>Clôturer</Button> : null}
    </div> },
  ];

  function openClose(item: Intervention) {
    setClosing(item);
    setReport("");
    setDuration("");
    setSigner("");
    setSigned(false);
    setResumeAfterBreakdown(false);
    setParts([]);
    setSubmitError("");
    setStockShortage("");
  }

  function addPart() {
    const article = articles.find((item) => item.id === selectedArticle);
    const amount = Number(quantity);
    if (!article || !Number.isFinite(amount) || amount <= 0) return;
    setParts((current) => [...current, { articleId: article.id, designation: article.designation, qte: amount }]);
    setSelectedArticle("");
    setQuantity("1");
  }

  async function saveClose(deductStock = true) {
    if (!closing) return;
    const input: CloseInterventionInput = {
      rapport: report.trim(),
      duree: Number(duration),
      piecesUtilisees: parts,
      signatureClient: signed,
      nomSignataire: signed ? signer.trim() : "",
    };
    if (!input.rapport || !Number.isInteger(input.duree) || input.duree <= 0 || (signed && !input.nomSignataire)) {
      setSubmitError("Renseignez le rapport, une durée positive et le nom du signataire si le client a signé.");
      return;
    }
    if (!profile) {
      setSubmitError("Votre session n’est plus active. Reconnectez-vous.");
      return;
    }
    setSaving(true);
    setSubmitError("");
    try {
      await closeIntervention(
        closing,
        input,
        resumeAfterBreakdown,
        profile.uid,
        profile.nom,
        deductStock,
      );
      showToast("Intervention clôturée", closing.numero);
      setClosing(null);
    } catch (closeError) {
      if (closeError instanceof StockInsufficientError && deductStock) {
        setStockShortage(closeError.message);
      } else {
        setSubmitError(closeError instanceof Error ? closeError.message : "La clôture de l’intervention a échoué.");
      }
    } finally {
      setSaving(false);
      setConfirmResume(false);
    }
  }

  function requestSave() {
    if (closing?.type === "depannage" && resumeAfterBreakdown) setConfirmResume(true);
    else void saveClose();
  }

  const tabLabels = [
    { id: "a_planifier", label: "À planifier" },
    { id: "planifiees", label: "Planifiées" },
    { id: "terminees", label: "Terminées" },
  ];

  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
      {loading ? <p role="status" className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-card">Chargement des interventions…</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs tabs={tabLabels} selected={tab} onChange={(value) => setTab(value as TabId)} />
        {can(role, "create", "interventions") ? <Link href="/interventions/nouveau" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"><FilePlus2 size={17} aria-hidden="true" />Nouvelle intervention</Link> : null}
      </div>
      <section aria-label="Filtres des interventions" className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:grid-cols-2 xl:grid-cols-5">
        <Field id="filter-intervention-type" label="Type"><Select id="filter-intervention-type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">Tous</option><option value="visite">Visite</option><option value="depannage">Dépannage</option><option value="installation">Installation</option></Select></Field>
        <Field id="filter-intervention-tech" label="Technicien"><Input id="filter-intervention-tech" value={technicianFilter} onChange={(event) => setTechnicianFilter(event.target.value)} placeholder="Nom du technicien" /></Field>
        <Field id="filter-intervention-elevator" label="Ascenseur"><Select id="filter-intervention-elevator" value={elevatorFilter} onChange={(event) => setElevatorFilter(event.target.value)}><option value="">Tous</option>{elevators.map((item) => <option key={item.id} value={item.id}>{item.site} · {item.numeroSerie}</option>)}</Select></Field>
        <Field id="filter-intervention-from" label="Du"><Input id="filter-intervention-from" type="date" value={fromFilter} onChange={(event) => setFromFilter(event.target.value)} /></Field>
        <Field id="filter-intervention-to" label="Au"><Input id="filter-intervention-to" type="date" value={toFilter} onChange={(event) => setToFilter(event.target.value)} /></Field>
      </section>
      {tab === "planifiees" ? <label className="inline-flex min-h-9 items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={weekOnly} onChange={(event) => setWeekOnly(event.target.checked)} className="h-4 w-4 accent-blue-600" />Cette semaine uniquement</label> : null}
      {tab === "planifiees" && groupedByDay.length ? <div className="space-y-6">{groupedByDay.map(([day, items]) => <section key={day} aria-label={day} className="space-y-2"><h2 className="font-display text-sm font-bold capitalize text-slate-700">{day}</h2><Table rows={items} /></section>)}</div> : null}
      {tab !== "planifiees" || !groupedByDay.length ? (!loading && !error ? filtered.length ? <Table rows={filtered} /> : <EmptyState icon={ClipboardCheck} title="Aucune intervention" message="Aucune intervention ne correspond à cet onglet et à ces filtres." /> : null) : null}

      <Modal open={Boolean(closing)} title={`Clôturer ${closing?.numero ?? "l’intervention"}`} description="Saisissez le rapport technique, la durée et les pièces utilisées." onClose={() => { if (!saving) setClosing(null); }} className="max-w-2xl">
        {closing ? <div className="space-y-4">
          {submitError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{submitError}</p> : null}
          {stockShortage ? (
            <div role="alert" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <p>{stockShortage}</p>
              <p>Choisissez si vous souhaitez clôturer cette intervention sans décompter les pièces.</p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => setStockShortage("")}>
                  Annuler
                </Button>
                <Button loading={saving} onClick={() => void saveClose(false)}>
                  Clôturer sans décompter
                </Button>
              </div>
            </div>
          ) : null}
          <Field id="close-report" label="Rapport des travaux" required><Textarea id="close-report" value={report} onChange={(event) => setReport(event.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="close-duration" label="Durée (minutes)" required><Input id="close-duration" type="number" min="1" value={duration} onChange={(event) => setDuration(event.target.value)} /></Field>
            <Field id="close-signer" label="Nom du signataire"><Input id="close-signer" value={signer} disabled={!signed} onChange={(event) => setSigner(event.target.value)} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={signed} onChange={(event) => setSigned(event.target.checked)} className="h-4 w-4 accent-blue-600" />Le client a signé le bon d’intervention</label>
          {closing.type === "depannage" ? <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={resumeAfterBreakdown} onChange={(event) => setResumeAfterBreakdown(event.target.checked)} className="h-4 w-4 accent-blue-600" />Remettre l’ascenseur en service après le dépannage</label> : null}
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-800">Pièces utilisées</h3>
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto]">
              <Field id="close-part" label="Article"><Select id="close-part" value={selectedArticle} onChange={(event) => setSelectedArticle(event.target.value)}><option value="">Sélectionner une pièce</option>{articles.filter((item) => item.type !== "service").map((item) => <option key={item.id} value={item.id}>{item.reference} · {item.designation}</option>)}</Select></Field>
              <Field id="close-part-quantity" label="Quantité"><Input id="close-part-quantity" type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></Field>
              <Button type="button" variant="secondary" className="self-end" onClick={addPart}>Ajouter</Button>
            </div>
            {parts.length ? <ul className="space-y-1 text-sm text-slate-700">{parts.map((part, index) => <li key={`${part.articleId}-${index}`} className="flex justify-between gap-3"><span>{part.designation}</span><span className="tabular-nums">{part.qte}</span></li>)}</ul> : <p className="text-xs text-slate-500">Aucune pièce ajoutée.</p>}
          </div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setClosing(null)}>Annuler</Button><Button loading={saving} onClick={requestSave}>Clôturer</Button></div>
        </div> : null}
      </Modal>
      <ConfirmDialog open={confirmResume} title="Remettre l’ascenseur en service ?" message="Confirmez que les vérifications de sécurité après dépannage ont été effectuées." confirmLabel="Confirmer la remise en service" onClose={() => setConfirmResume(false)} onConfirm={() => { setConfirmResume(false); void saveClose(); }} />
    </div>
  );

  function Table({ rows }: { rows: Intervention[] }) {
    return <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card"><DataTable caption="Interventions techniques" rows={rows} columns={columns} getRowKey={(item) => item.id} minWidthClassName="min-w-[900px]" /></div>;
  }
}
