"use client";

import { doc, onSnapshot, setDoc } from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { company as fallbackCompany } from "@/config/company";
import { useAuth } from "@/context/AuthProvider";
import { getFirebaseDb } from "@/lib/firebase";
import { firestoreErrorMessage } from "@/lib/firestoreErrors";

export type CompanySettings = {
  name: string;
  legalName: string;
  address: string;
  phone: string;
  email: string;
  ice: string;
  rc: string;
  taxId: string;
  patente: string;
  rib: string;
};

type CompanySettingsContextValue = {
  company: CompanySettings;
  loading: boolean;
  error: string | null;
  saveCompany: (settings: CompanySettings) => Promise<void>;
};

type CompanySettingsState = {
  uid: string | null;
  company: CompanySettings;
  loading: boolean;
  error: string | null;
};

const CompanySettingsContext =
  createContext<CompanySettingsContextValue | null>(null);

function isCompanySettings(value: unknown): value is CompanySettings {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.name === "string" &&
    typeof record.legalName === "string" &&
    typeof record.address === "string" &&
    typeof record.phone === "string" &&
    typeof record.email === "string" &&
    typeof record.ice === "string" &&
    typeof record.rc === "string" &&
    typeof record.taxId === "string" &&
    typeof record.patente === "string" &&
    typeof record.rib === "string"
  );
}

export function CompanySettingsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();
  const [state, setState] = useState<CompanySettingsState>({
    uid: null,
    company: fallbackCompany,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!user) return;
    let active = true;
    try {
      const unsubscribe = onSnapshot(
        doc(getFirebaseDb(), "settings", "company"),
        (snapshot) => {
          if (!active) return;
          if (!snapshot.exists()) {
            setState({
              uid: user.uid,
              company: fallbackCompany,
              loading: false,
              error: null,
            });
            return;
          }
          const data: unknown = snapshot.data();
          if (!isCompanySettings(data)) {
            setState({
              uid: user.uid,
              company: fallbackCompany,
              loading: false,
              error:
                "Les coordonnées de la société enregistrées dans Firestore sont invalides.",
            });
            return;
          }
          setState({
            uid: user.uid,
            company: data,
            loading: false,
            error: null,
          });
        },
        (snapshotError) => {
          if (!active) return;
          setState({
            uid: user.uid,
            company: fallbackCompany,
            loading: false,
            error: firestoreErrorMessage(snapshotError),
          });
        },
      );
      return () => {
        active = false;
        unsubscribe();
      };
    } catch (snapshotError) {
      const message = firestoreErrorMessage(snapshotError);
      window.setTimeout(() => {
        if (!active) return;
        setState({
          uid: user.uid,
          company: fallbackCompany,
          loading: false,
          error: message,
        });
      }, 0);
      return () => {
        active = false;
      };
    }
  }, [user]);

  const saveCompany = useCallback(async (nextSettings: CompanySettings) => {
    try {
      await setDoc(doc(getFirebaseDb(), "settings", "company"), nextSettings, {
        merge: true,
      });
    } catch (saveError) {
      const message = firestoreErrorMessage(saveError);
      setState((current) => ({ ...current, error: message }));
      throw new Error(message);
    }
  }, []);

  const isCurrentSession = Boolean(user && state.uid === user.uid);
  const company = isCurrentSession ? state.company : fallbackCompany;
  const loading = Boolean(user) && (!isCurrentSession || state.loading);
  const error = isCurrentSession ? state.error : null;
  const value = useMemo(
    () => ({ company, loading, error, saveCompany }),
    [company, loading, error, saveCompany],
  );
  return (
    <CompanySettingsContext.Provider value={value}>
      {children}
    </CompanySettingsContext.Provider>
  );
}

export function useCompanySettings(): CompanySettingsContextValue {
  const context = useContext(CompanySettingsContext);
  if (!context) {
    return {
      company: fallbackCompany,
      loading: false,
      error: null,
      saveCompany: async () => {
        throw new Error("Les paramètres société ne sont pas initialisés.");
      },
    };
  }
  return context;
}
