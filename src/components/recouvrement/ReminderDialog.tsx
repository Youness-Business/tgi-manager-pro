"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Clipboard, Mail, MessageCircle, Printer } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/ToastProvider";
import { useAuth } from "@/context/AuthProvider";
import { relanceTemplates, buildRelanceMessage } from "@/config/relanceTemplates";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { formatMoney } from "@/lib/formatMoney";
import { formatSafeDate } from "@/lib/formatSafeDate";
import { enregistrerRelance } from "@/lib/recouvrementTransactions";
import type { Client, Document, RelanceCanal } from "@/types";

type Props = {
  open: boolean;
  client: Client;
  invoices: readonly Document[];
  initialInvoiceId?: string;
  suggestedLevel: 1 | 2 | 3;
  totalDue: number;
  onClose: () => void;
};

function localDate(): string {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function normalizeMoroccanPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("212")) return digits;
  if (digits.startsWith("0")) digits = digits.slice(1);
  return `212${digits}`;
}

export function ReminderDialog({
  open,
  client,
  invoices,
  initialInvoiceId,
  suggestedLevel,
  totalDue,
  onClose,
}: Props) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const online = useOnlineStatus();
  const openInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.clientId === client.id),
    [client.id, invoices],
  );
  const [invoiceId, setInvoiceId] = useState(initialInvoiceId ?? openInvoices[0]?.id ?? "");
  const [level, setLevel] = useState<1 | 2 | 3>(suggestedLevel);
  const [channel, setChannel] = useState<RelanceCanal>("appel");
  const [note, setNote] = useState("");
  const [promiseDate, setPromiseDate] = useState("");
  const [promiseAmount, setPromiseAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedInvoice = openInvoices.find((invoice) => invoice.id === invoiceId);
  const arrears = selectedInvoice?.dateEcheance
    ? Math.max(0, getDaysLate(selectedInvoice.dateEcheance))
    : 0;
  const message = buildRelanceMessage(level, {
    client: client.nom,
    numero: selectedInvoice?.numero ?? "—",
    montant: formatMoney(totalDue),
    echeance: formatSafeDate(selectedInvoice?.dateEcheance),
    retard: arrears,
  });
  const prefilledNote = note || message;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !online) {
      setError(!online ? "Une relance ne peut pas être enregistrée hors ligne." : "Session expirée.");
      return;
    }
    if (!selectedInvoice) {
      setError("Sélectionnez une facture échue ou présentant un solde.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await enregistrerRelance(
        {
          clientId: client.id,
          documentIds: [selectedInvoice.id],
          niveau: level,
          canal: channel,
          note: prefilledNote.trim(),
          ...(promiseDate
            ? { promessePaiementDate: new Date(`${promiseDate}T12:00:00`) }
            : {}),
          ...(promiseAmount ? { promesseMontant: Number(promiseAmount) } : {}),
        },
        user.uid,
      );
      showToast("Relance enregistrée", `Suivi ajouté au dossier de ${client.nom}.`);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "La relance n’a pas pu être enregistrée.");
    } finally {
      setSaving(false);
    }
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(prefilledNote);
      showToast("Message copié", "Le modèle est prêt à être envoyé.");
    } catch {
      setError("Impossible de copier le message. Sélectionnez-le puis copiez-le manuellement.");
    }
  }

  function openWhatsApp() {
    const phone = normalizeMoroccanPhone(client.telephone);
    if (!/^212[5-7]\d{8}$/.test(phone)) {
      setError("Le numéro du client n’est pas un numéro mobile marocain valide.");
      return;
    }
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(prefilledNote)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setChannel("whatsapp");
  }

  function openEmail() {
    if (!client.email) {
      setError("Ajoutez une adresse e-mail à la fiche client avant de préparer un courriel.");
      return;
    }
    window.location.href = `mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(`Relance facture ${selectedInvoice?.numero ?? ""}`)}&body=${encodeURIComponent(prefilledNote)}`;
    setChannel("email");
  }

  return (
    <Modal
      open={open}
      title={`Nouvelle relance · ${client.nom}`}
      description="Le suivi est ajouté à l’historique uniquement lorsque vous validez."
      onClose={() => {
        if (!saving) onClose();
      }}
      className="max-w-3xl print:hidden"
    >
      <form className="space-y-4" onSubmit={submit}>
        {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="reminder-invoice" label="Facture concernée" required>
            <Select id="reminder-invoice" value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} required>
              {openInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.numero}</option>)}
            </Select>
          </Field>
          <Field id="reminder-level" label="Niveau" required>
            <Select id="reminder-level" value={level} onChange={(event) => setLevel(Number(event.target.value) as 1 | 2 | 3)}>
              <option value={1}>1 · Rappel amiable</option>
              <option value={2}>2 · Relance ferme</option>
              <option value={3}>3 · Mise en demeure</option>
            </Select>
          </Field>
          <Field id="reminder-channel" label="Canal" required>
            <Select id="reminder-channel" value={channel} onChange={(event) => setChannel(event.target.value as RelanceCanal)}>
              <option value="appel">Appel</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">E-mail</option>
              <option value="courrier">Courrier</option>
              <option value="visite">Visite</option>
            </Select>
          </Field>
          <Field id="promise-date" label="Date de promesse de paiement">
            <Input id="promise-date" type="date" min={localDate()} value={promiseDate} onChange={(event) => setPromiseDate(event.target.value)} />
          </Field>
          <Field id="promise-amount" label="Montant promis (MAD)">
            <Input id="promise-amount" type="number" min="0.01" step="0.01" value={promiseAmount} onChange={(event) => setPromiseAmount(event.target.value)} />
          </Field>
        </div>
        <Field id="reminder-note" label="Message / compte rendu" required>
          <Textarea id="reminder-note" rows={8} required value={note || message} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={copyMessage}><Clipboard size={16} aria-hidden="true" /> Copier</Button>
          <Button type="button" variant="secondary" onClick={openWhatsApp}><MessageCircle size={16} aria-hidden="true" /> Ouvrir WhatsApp</Button>
          <Button type="button" variant="secondary" onClick={openEmail}><Mail size={16} aria-hidden="true" /> Ouvrir l’e-mail</Button>
          <Button type="button" variant="secondary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Imprimer le courrier</Button>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={saving} disabled={!online}>{online ? "Enregistrer la relance" : "Indisponible hors ligne"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function getDaysLate(date: Document["dateEcheance"]): number {
  if (!date) return 0;
  const parsed = new Date(
    typeof date === "object" && date !== null && "toDate" in date
      ? date.toDate()
      : typeof date === "object" && date !== null && "seconds" in date
        ? date.seconds * 1000
        : date,
  );
  if (!Number.isFinite(parsed.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - parsed.getTime()) / 86_400_000));
}

export function getTemplateForLevel(level: 1 | 2 | 3): string {
  return relanceTemplates[level];
}
