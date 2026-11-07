"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/ToastProvider";
import { useAuth } from "@/context/AuthProvider";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { formatMoney } from "@/lib/formatMoney";
import { enregistrerPaiement } from "@/lib/recouvrementTransactions";
import type { Client, Document, PaymentMethod } from "@/types";

type Props = {
  open: boolean;
  document: Document;
  client: Client;
  balance: number;
  onClose: () => void;
};

function localDate(): string {
  const today = new Date();
  return new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

export function PaymentDialog({ open, document, client, balance, onClose }: Props) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const online = useOnlineStatus();
  const [amount, setAmount] = useState(String(balance.toFixed(2)));
  const [mode, setMode] = useState<PaymentMethod>("virement");
  const [reference, setReference] = useState("");
  const [bank, setBank] = useState("");
  const [plannedDate, setPlannedDate] = useState(localDate);
  const [paymentId, setPaymentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      setError("Votre session a expiré. Reconnectez-vous avant d’enregistrer le paiement.");
      return;
    }
    if (!online) {
      setError("Le paiement ne peut pas être enregistré hors ligne.");
      return;
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Saisissez un montant supérieur à zéro.");
      return;
    }
    setSaving(true);
    setError("");
    const stableId = paymentId || crypto.randomUUID();
    setPaymentId(stableId);
    try {
      const result = await enregistrerPaiement(
        {
          paymentId: stableId,
          documentId: document.id,
          clientId: client.id,
          montant: numericAmount,
          mode,
          reference,
          ...(bank.trim() ? { banque: bank } : {}),
          ...(mode === "cheque" || mode === "effet"
            ? { dateEncaissementPrevue: new Date(`${plannedDate}T12:00:00`) }
            : {}),
        },
        user.uid,
      );
      showToast(
        result.alreadyRecorded ? "Paiement déjà enregistré" : "Paiement enregistré",
        result.receiptNumber
          ? `Reçu ${result.receiptNumber} disponible.`
          : "Le solde sera réduit à l’encaissement du chèque ou de l’effet.",
      );
      onClose();
      if (result.receiptId && window.confirm("Voulez-vous ouvrir le reçu pour l’imprimer ?")) {
        router.push(`/documents/${result.receiptId}`);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Le paiement n’a pas pu être enregistré.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={`Enregistrer un paiement · ${document.numero}`}
      description={`Solde restant : ${formatMoney(balance)}. Un paiement partiel est possible.`}
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <form className="space-y-4" onSubmit={submit}>
        {error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        <Field id="payment-amount" label="Montant à régler (MAD)" required>
          <Input
            id="payment-amount"
            type="number"
            min="0.01"
            max={balance}
            step="0.01"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field id="payment-mode" label="Mode de paiement" required>
          <Select
            id="payment-mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as PaymentMethod)}
          >
            <option value="especes">Espèces</option>
            <option value="virement">Virement</option>
            <option value="cheque">Chèque</option>
            <option value="effet">Effet de commerce</option>
          </Select>
        </Field>
        <Field id="payment-reference" label="Référence" required>
          <Input
            id="payment-reference"
            required
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="N° de virement, reçu de caisse, chèque…"
          />
        </Field>
        {mode === "cheque" ? (
          <Field id="payment-bank" label="Banque" required>
            <Input id="payment-bank" required value={bank} onChange={(event) => setBank(event.target.value)} />
          </Field>
        ) : null}
        {mode === "cheque" || mode === "effet" ? (
          <Field id="payment-planned-date" label="Date d’encaissement prévue" required>
            <Input
              id="payment-planned-date"
              type="date"
              required
              value={plannedDate}
              onChange={(event) => setPlannedDate(event.target.value)}
            />
          </Field>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={saving} disabled={!online}>
            {online ? "Enregistrer le paiement" : "Indisponible hors ligne"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
