"use client";

import {
  doc,
  onSnapshot,
} from "firebase/firestore";
import { useEffect, useState, type FormEvent } from "react";
import { Download, Save, UsersRound } from "lucide-react";
import { accessWhitelist } from "@/config/access";
import {
  useCompanySettings,
  type CompanySettings,
} from "@/context/CompanySettingsProvider";
import { useAuth } from "@/context/AuthProvider";
import { getFirebaseDb } from "@/lib/firebase";
import { firestoreErrorMessage } from "@/lib/firestoreErrors";
import { importDemoData } from "@/lib/importDemoData";

const companyFields: {
  name: keyof CompanySettings;
  label: string;
  type?: "email" | "tel" | "text";
}[] = [
  { name: "name", label: "Nom commercial" },
  { name: "legalName", label: "Raison sociale" },
  { name: "address", label: "Adresse complète" },
  { name: "phone", label: "Téléphone", type: "tel" },
  { name: "email", label: "Adresse e-mail", type: "email" },
  { name: "ice", label: "ICE" },
  { name: "rc", label: "Registre du commerce (RC)" },
  { name: "taxId", label: "Identifiant fiscal (IF)" },
  { name: "patente", label: "Patente" },
  { name: "rib", label: "RIB" },
];

type ImportState = {
  status?: string;
  lastError?: string | null;
};

function isImportState(value: unknown): value is ImportState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.status === "importing" ||
    candidate.status === "completed" ||
    candidate.status === "failed"
  );
}

export function SettingsPanel() {
  const { profile } = useAuth();
  const {
    company,
    loading: companyLoading,
    error: companyError,
    saveCompany,
  } = useCompanySettings();
  const [form, setForm] = useState<CompanySettings | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importState, setImportState] = useState<ImportState>({});
  const [importing, setImporting] = useState(false);

  const formValues = form ?? company;

  useEffect(() => {
    if (!profile) return;
    try {
      return onSnapshot(
        doc(getFirebaseDb(), "settings", "demoImport"),
        (snapshot) => {
          if (!snapshot.exists()) {
            setImportState({});
            return;
          }
          const value: unknown = snapshot.data();
          setImportState(
            isImportState(value)
              ? {
                  status: value.status,
                  lastError:
                    typeof value.lastError === "string" ? value.lastError : null,
                }
              : { status: "failed" },
          );
        },
        (snapshotError) => {
          setErrorMessage(firestoreErrorMessage(snapshotError));
        },
      );
    } catch (snapshotError) {
      const message = firestoreErrorMessage(snapshotError);
      window.setTimeout(() => setErrorMessage(message), 0);
      return;
    }
  }, [profile]);

  async function submitCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveMessage("");
    setErrorMessage(null);
    try {
      await saveCompany(formValues);
      setForm(null);
      setSaveMessage("Les coordonnées de la société ont été enregistrées.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "La sauvegarde a échoué.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function runImport() {
    if (!profile || importState.status === "completed" || importing) return;
    if (
      !window.confirm(
        "Importer les clients, les articles et les documents de démonstration ? Cette opération ne peut être effectuée qu’une seule fois.",
      )
    ) {
      return;
    }
    setImporting(true);
    setErrorMessage(null);
    setSaveMessage("");
    try {
      await importDemoData(profile.uid);
      setSaveMessage("Les données de démonstration ont été importées.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "L’import des données a échoué.",
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {companyError || errorMessage ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {companyError ?? errorMessage}
        </p>
      ) : null}
      {saveMessage ? (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {saveMessage}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">
          Coordonnées de la société
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Ces informations sont utilisées dans les documents imprimés.
        </p>
        <form onSubmit={submitCompany} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {companyFields.map((field) => (
              <label
                key={field.name}
                className={`block min-w-0 ${field.name === "address" ? "sm:col-span-2" : ""}`}
              >
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  {field.label}
                </span>
                <input
                  type={field.type ?? "text"}
                  required
                  value={formValues[field.name]}
                  onChange={(event) => {
                    setForm({
                      ...formValues,
                      [field.name]: event.target.value,
                    });
                  }}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                />
              </label>
            ))}
          </div>
          <button
            type="submit"
            disabled={saving || companyLoading}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-70"
          >
            <Save aria-hidden="true" size={17} />
            {saving ? "Enregistrement…" : "Enregistrer les coordonnées"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <UsersRound aria-hidden="true" size={20} />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Comptes autorisés
            </h2>
            <p className="text-sm text-slate-600">Rôles attribués par la liste blanche.</p>
          </div>
        </div>
        <ul className="mt-5 divide-y divide-gray-100">
          {accessWhitelist.map((account) => (
            <li
              key={account.email}
              className="flex min-w-0 flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="break-all text-sm font-medium text-slate-900">
                {account.nom} · {account.email}
              </span>
              <span className="text-sm text-slate-600">{account.roleLabel}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Données de démonstration
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
          Importe les clients, le catalogue et les documents d’exemple fournis
          avec l’application. Les documents reçoivent des compteurs cohérents
          et ne remplacent pas les entrées déjà présentes.
        </p>
        {importState.status === "completed" ? (
          <p className="mt-4 text-sm font-medium text-emerald-700">
            Import terminé. L’import ne peut être relancé.
          </p>
        ) : importState.status === "importing" ? (
          <p role="status" className="mt-4 text-sm text-amber-800">
            Un import est actuellement en cours.
          </p>
        ) : null}
        <button
          type="button"
          disabled={
            importing ||
            importState.status === "completed" ||
            importState.status === "importing"
          }
          onClick={runImport}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download aria-hidden="true" size={17} />
          {importing ? "Importation…" : "Importer les données de démo"}
        </button>
      </section>
    </div>
  );
}
