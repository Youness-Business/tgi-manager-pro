"use client";

import {
  collection,
  onSnapshot,
  query,
  where,
  type Query,
} from "firebase/firestore";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthProvider";
import { useDocuments } from "@/context/DocumentsProvider";
import { getFirebaseDb } from "@/lib/firebase";
import { firestoreErrorMessage } from "@/lib/firestoreErrors";
import { validDate } from "@/lib/recouvrement";
import type {
  DateInput,
  Document,
  Paiement,
  PaiementEvenement,
  PaymentStatus,
  Relance,
} from "@/types";

export type LiveData<T> = {
  items: T[];
  loading: boolean;
  error: string | null;
};

type ReceivablesValue = {
  payments: LiveData<Paiement>["items"];
  reminders: LiveData<Relance>["items"];
  loading: boolean;
  error: string | null;
};

const empty: ReceivablesValue = {
  payments: [],
  reminders: [],
  loading: false,
  error: null,
};

const ReceivablesContext = createContext<ReceivablesValue>(empty);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseDate(value: unknown): DateInput | null {
  if (
    value instanceof Date ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  ) return value;
  if (isRecord(value) && typeof value.toDate === "function") {
    const parsed: unknown = value.toDate();
    return parsed instanceof Date ? parsed : null;
  }
  if (isRecord(value) && typeof value.seconds === "number") {
    return {
      seconds: value.seconds,
      ...(typeof value.nanoseconds === "number"
        ? { nanoseconds: value.nanoseconds }
        : {}),
    };
  }
  return null;
}

const paymentStatuses: readonly PaymentStatus[] = [
  "valide",
  "en_portefeuille",
  "remis_banque",
  "encaisse",
  "impaye",
  "annule",
];
const paymentModes = ["especes", "virement", "cheque", "effet"] as const;
const reminderChannels = ["appel", "whatsapp", "email", "courrier", "visite"] as const;

function parsePayment(id: string, value: unknown): Paiement | null {
  if (!isRecord(value)) return null;
  const date = parseDate(value.date);
  if (
    typeof value.documentId !== "string" ||
    typeof value.clientId !== "string" ||
    typeof value.montant !== "number" ||
    !Number.isFinite(value.montant) ||
    value.montant <= 0 ||
    !paymentModes.includes(value.mode as (typeof paymentModes)[number]) ||
    typeof value.reference !== "string" ||
    !paymentStatuses.includes(value.statut as PaymentStatus) ||
    typeof value.userId !== "string" ||
    !date ||
    (value.banque !== undefined && typeof value.banque !== "string")
  ) return null;
  const planned = parseDate(value.dateEncaissementPrevue);
  return {
    id,
    documentId: value.documentId,
    clientId: value.clientId,
    montant: value.montant,
    mode: value.mode as Paiement["mode"],
    reference: value.reference,
    ...(typeof value.banque === "string" ? { banque: value.banque } : {}),
    ...(planned ? { dateEncaissementPrevue: planned } : {}),
    statut: value.statut as PaymentStatus,
    ...(typeof value.recuDocumentId === "string"
      ? { recuDocumentId: value.recuDocumentId }
      : {}),
    ...(typeof value.invoiceCreatedBy === "string"
      ? { invoiceCreatedBy: value.invoiceCreatedBy }
      : {}),
    userId: value.userId,
    date,
  };
}

function parseEvent(id: string, value: unknown): PaiementEvenement | null {
  if (!isRecord(value)) return null;
  const date = parseDate(value.date);
  if (
    typeof value.paiementId !== "string" ||
    typeof value.documentId !== "string" ||
    !paymentStatuses.includes(value.statut as PaymentStatus) ||
    typeof value.userId !== "string" ||
    !date ||
    (value.motif !== undefined && typeof value.motif !== "string")
  ) return null;
  return {
    id,
    paiementId: value.paiementId,
    documentId: value.documentId,
    statut: value.statut as PaymentStatus,
    ...(typeof value.motif === "string" ? { motif: value.motif } : {}),
    ...(typeof value.recuDocumentId === "string"
      ? { recuDocumentId: value.recuDocumentId }
      : {}),
    ...(typeof value.invoiceCreatedBy === "string"
      ? { invoiceCreatedBy: value.invoiceCreatedBy }
      : {}),
    userId: value.userId,
    date,
  };
}

function parseReminder(id: string, value: unknown): Relance | null {
  if (!isRecord(value)) return null;
  const date = parseDate(value.date);
  if (
    typeof value.clientId !== "string" ||
    !Array.isArray(value.documentIds) ||
    !value.documentIds.every((documentId) => typeof documentId === "string") ||
    ![1, 2, 3].includes(value.niveau as number) ||
    !reminderChannels.includes(value.canal as (typeof reminderChannels)[number]) ||
    typeof value.note !== "string" ||
    typeof value.userId !== "string" ||
    !date ||
    (value.promesseMontant !== undefined &&
      (typeof value.promesseMontant !== "number" ||
        !Number.isFinite(value.promesseMontant) ||
        value.promesseMontant <= 0))
  ) return null;
  const promiseDate = parseDate(value.promessePaiementDate);
  return {
    id,
    clientId: value.clientId,
    documentIds: value.documentIds,
    niveau: value.niveau as Relance["niveau"],
    canal: value.canal as Relance["canal"],
    note: value.note,
    ...(promiseDate ? { promessePaiementDate: promiseDate } : {}),
    ...(typeof value.promesseMontant === "number"
      ? { promesseMontant: value.promesseMontant }
      : {}),
    userId: value.userId,
    date,
  };
}

function queryError(errors: readonly (string | null)[]): string | null {
  return errors.find((error) => error !== null) ?? null;
}

export function RecouvrementDataProvider({ children }: { children: ReactNode }) {
  const { user, role, status } = useAuth();
  const readyUid = status === "ready" ? user?.uid ?? null : null;
  const isManager = role === "owner" || role === "dg";
  const invoiceKey = isManager ? "all" : readyUid ?? "";
  const [paymentState, setPaymentState] = useState<{
    key: string;
    value: LiveData<Paiement>;
  }>({ key: "", value: { items: [], loading: true, error: null } });
  const [eventState, setEventState] = useState<{
    key: string;
    value: LiveData<PaiementEvenement>;
  }>({ key: "", value: { items: [], loading: true, error: null } });
  const [reminderState, setReminderState] = useState<{
    uid: string | null;
    value: LiveData<Relance>;
  }>({ uid: null, value: { items: [], loading: true, error: null } });

  useEffect(() => {
    if (!readyUid) return;
    let active = true;
    const paymentsCollection = collection(getFirebaseDb(), "paiements");
    const paymentQueries: Query[] = isManager
      ? [paymentsCollection]
      : [query(paymentsCollection, where("invoiceCreatedBy", "==", readyUid))];
    const itemsById = new Map<string, Paiement>();
    const errors: (string | null)[] = paymentQueries.map(() => null);
    const loaded = new Set<number>();
    const unsubscribes = paymentQueries.map((paymentQuery, index) =>
      onSnapshot(
        paymentQuery,
        (snapshot) => {
          if (!active) return;
          for (const payment of snapshot.docs) {
            const parsed = parsePayment(payment.id, payment.data());
            if (!parsed) {
              errors[index] = `Le paiement « ${payment.id} » contient des données invalides.`;
              setPaymentState({
                key: `${readyUid}:${invoiceKey}`,
                value: { items: [], loading: false, error: errors[index] },
              });
              return;
            }
            itemsById.set(parsed.id, parsed);
          }
          loaded.add(index);
          if (loaded.size === paymentQueries.length) {
            setPaymentState({
              key: `${readyUid}:${invoiceKey}`,
              value: {
                items: [...itemsById.values()],
                loading: false,
                error: queryError(errors),
              },
            });
          }
        },
        (error) => {
          if (!active) return;
          errors[index] = firestoreErrorMessage(error);
          loaded.add(index);
          setPaymentState({
            key: `${readyUid}:${invoiceKey}`,
            value: {
              items: [...itemsById.values()],
              loading: loaded.size !== paymentQueries.length,
              error: queryError(errors),
            },
          });
        },
      ),
    );
    return () => {
      active = false;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [invoiceKey, isManager, readyUid]);

  const paymentIds = useMemo(
    () => paymentState.value.items.map((payment) => payment.id),
    [paymentState.value.items],
  );
  const paymentIdsKey = isManager ? "all" : paymentIds.join("|");
  useEffect(() => {
    if (!readyUid || (!isManager && paymentIds.length === 0)) return;
    let active = true;
    const eventsCollection = collection(getFirebaseDb(), "paiementEvenements");
    const eventQueries: Query[] = isManager
      ? [eventsCollection]
      : [query(eventsCollection, where("invoiceCreatedBy", "==", readyUid))];
    const itemsById = new Map<string, PaiementEvenement>();
    const errors: (string | null)[] = eventQueries.map(() => null);
    const loaded = new Set<number>();
    const unsubscribes = eventQueries.map((eventQuery, index) =>
      onSnapshot(
        eventQuery,
        (snapshot) => {
          if (!active) return;
          for (const event of snapshot.docs) {
            const parsed = parseEvent(event.id, event.data());
            if (!parsed) {
              errors[index] = `L’événement de paiement « ${event.id} » est invalide.`;
              setEventState({
                key: `${readyUid}:${paymentIdsKey}`,
                value: { items: [], loading: false, error: errors[index] },
              });
              return;
            }
            itemsById.set(parsed.id, parsed);
          }
          loaded.add(index);
          if (loaded.size === eventQueries.length) {
            setEventState({
              key: `${readyUid}:${paymentIdsKey}`,
              value: { items: [...itemsById.values()], loading: false, error: queryError(errors) },
            });
          }
        },
        (error) => {
          if (!active) return;
          errors[index] = firestoreErrorMessage(error);
          loaded.add(index);
          setEventState({
            key: `${readyUid}:${paymentIdsKey}`,
            value: {
              items: [...itemsById.values()],
              loading: loaded.size !== eventQueries.length,
              error: queryError(errors),
            },
          });
        },
      ),
    );
    return () => {
      active = false;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [isManager, paymentIds, paymentIdsKey, readyUid]);

  useEffect(() => {
    if (!readyUid) return;
    let active = true;
    const reminders = collection(getFirebaseDb(), "relances");
    const reminderQuery = isManager
      ? reminders
      : query(reminders, where("userId", "==", readyUid));
    const unsubscribe = onSnapshot(
      reminderQuery,
      (snapshot) => {
        if (!active) return;
        const parsed = snapshot.docs.map((entry) =>
          parseReminder(entry.id, entry.data()),
        );
        if (parsed.some((item) => item === null)) {
          setReminderState({
            uid: readyUid,
            value: { items: [], loading: false, error: "Une relance contient des données invalides." },
          });
          return;
        }
        setReminderState({
          uid: readyUid,
          value: {
            items: parsed.filter((item): item is Relance => item !== null),
            loading: false,
            error: null,
          },
        });
      },
      (error) => {
        if (active) {
          setReminderState({
            uid: readyUid,
            value: { items: [], loading: false, error: firestoreErrorMessage(error) },
          });
        }
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [isManager, readyUid]);

  const payments = useMemo(
    () => paymentState.key === `${readyUid}:${invoiceKey}`
      ? paymentState.value
      : { items: [], loading: Boolean(readyUid), error: null },
    [invoiceKey, paymentState.key, paymentState.value, readyUid],
  );
  const events = useMemo(
    () => eventState.key === `${readyUid}:${paymentIdsKey}`
      ? eventState.value
      : {
          items: [],
          loading: Boolean(readyUid && (isManager || paymentIds.length > 0)),
          error: null,
        },
    [eventState.key, eventState.value, isManager, paymentIds.length, paymentIdsKey, readyUid],
  );
  const reminders = useMemo(
    () => reminderState.uid === readyUid
      ? reminderState.value
      : { items: [], loading: Boolean(readyUid), error: null },
    [readyUid, reminderState.uid, reminderState.value],
  );
  const effectivePayments = useMemo(() => {
    const latest = new Map<string, PaiementEvenement>();
    for (const event of events.items) {
      const current = latest.get(event.paiementId);
      if (
        !current ||
        (validDate(event.date)?.getTime() ?? 0) >
          (validDate(current.date)?.getTime() ?? 0)
      ) latest.set(event.paiementId, event);
    }
    return payments.items.map((payment) => {
      const event = latest.get(payment.id);
      return event
        ? {
            ...payment,
            statut: event.statut,
            ...(event.recuDocumentId ? { recuDocumentId: event.recuDocumentId } : {}),
          }
        : payment;
    });
  }, [events.items, payments.items]);
  const value = useMemo<ReceivablesValue>(
    () => ({
      payments: effectivePayments,
      reminders: reminders.items,
      loading: payments.loading || events.loading || reminders.loading,
      error: payments.error ?? events.error ?? reminders.error,
    }),
    [effectivePayments, events, payments, reminders],
  );
  return <ReceouvrementContext.Provider value={value}>{children}</ReceouvrementContext.Provider>;
}

const ReceouvrementContext = ReceivablesContext;

export function usePaiements(): LiveData<Paiement> {
  const context = useContext(ReceouvrementContext);
  return { items: context.payments, loading: context.loading, error: context.error };
}

export function useRelances(): LiveData<Relance> {
  const context = useContext(ReceouvrementContext);
  return { items: context.reminders, loading: context.loading, error: context.error };
}

export function useCreances(): {
  documents: Document[];
  paiements: Paiement[];
  relances: Relance[];
  loading: boolean;
  error: string | null;
} {
  const { documents, loading, error } = useDocuments();
  const data = useContext(ReceouvrementContext);
  return {
    documents: documents.filter((document) => document.type === "facture"),
    paiements: data.payments,
    relances: data.reminders,
    loading: loading || data.loading,
    error: error ?? data.error,
  };
}
