import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useLocation } from "react-router-dom";
import CataloguePage from "@/app/catalogue/page";
import ClientDetailsPage from "@/app/clients/[id]/page";
import ClientsPage from "@/app/clients/page";
import ContractPage from "@/app/contrats/[id]/page";
import ContractPrintPage from "@/app/contrats/[id]/imprimer/page";
import ContractsPage from "@/app/contrats/page";
import NewContractPage from "@/app/contrats/nouveau/page";
import DashboardPage from "@/app/dashboard/page";
import DocumentDetailsPage from "@/app/documents/[id]/page";
import DemoDocumentPage from "@/app/documents/demo/page";
import DocumentsPage from "@/app/documents/page";
import NewDocumentPage from "@/app/documents/nouveau/page";
import ElevatorDetailsPage from "@/app/parc/[id]/page";
import EditElevatorPage from "@/app/parc/[id]/modifier/page";
import NewElevatorPage from "@/app/parc/nouveau/page";
import ParkPage from "@/app/parc/page";
import InterventionPage from "@/app/interventions/[id]/page";
import InterventionPrintPage from "@/app/interventions/[id]/bon/page";
import InterventionsPage from "@/app/interventions/page";
import NewInterventionPage from "@/app/interventions/nouveau/page";
import LoginPage from "@/app/login/page";
import OfflinePage from "@/app/offline/page";
import SettingsPage from "@/app/parametres/page";
import ClientReceivablesPage from "@/app/recouvrement/clients/[id]/page";
import ChequesPage from "@/app/recouvrement/cheques/page";
import CreancesPage from "@/app/recouvrement/creances/page";
import ReceivablesPage from "@/app/recouvrement/page";
import StockArticlePage from "@/app/stock/[articleId]/page";
import StockInventoryPage from "@/app/stock/inventaire/page";
import StockPage from "@/app/stock/page";
import NotFoundPage from "@/app/not-found";

const titles: Record<string, string> = {
  "/login": "Connexion",
  "/dashboard": "Dashboard",
  "/clients": "Clients",
  "/catalogue": "Catalogue",
  "/documents": "Documents",
  "/documents/nouveau": "Nouveau document",
  "/documents/demo": "Démonstration de facture",
  "/contrats": "Contrats",
  "/contrats/nouveau": "Nouveau contrat",
  "/parc": "Parc d’ascenseurs",
  "/parc/nouveau": "Ajouter un ascenseur",
  "/interventions": "Interventions",
  "/interventions/nouveau": "Nouvelle intervention",
  "/recouvrement": "Recouvrement",
  "/recouvrement/creances": "Créances",
  "/recouvrement/cheques": "Chèques et effets",
  "/stock": "Stock",
  "/stock/inventaire": "Inventaire",
  "/parametres": "Paramètres",
  "/offline": "Hors connexion",
};

function RouteTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    const title =
      titles[pathname] ??
      (pathname.startsWith("/clients/")
        ? "Fiche client"
        : pathname.startsWith("/documents/")
          ? "Document"
          : pathname.startsWith("/contrats/") && pathname.endsWith("/imprimer")
            ? "Imprimer le contrat"
            : pathname.startsWith("/contrats/")
              ? "Fiche contrat"
              : pathname.startsWith("/parc/") && pathname.endsWith("/modifier")
                ? "Modifier un ascenseur"
                : pathname.startsWith("/parc/")
                  ? "Fiche ascenseur"
                  : pathname.startsWith("/interventions/") && pathname.endsWith("/bon")
                    ? "Bon d’intervention"
                    : pathname.startsWith("/interventions/")
                      ? "Fiche intervention"
                      : pathname.startsWith("/stock/")
                        ? "Fiche stock"
                        : pathname.startsWith("/recouvrement/clients/")
                          ? "Relevé de compte"
                          : "Page introuvable");
    document.title = `${title} | TGI Ascenseurs`;
  }, [pathname]);

  return null;
}

export function AppRoutes() {
  return (
    <>
      <RouteTitle />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/offline" element={<OfflinePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/:id" element={<ClientDetailsPage />} />
        <Route path="/catalogue" element={<CataloguePage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/nouveau" element={<NewDocumentPage />} />
        <Route path="/documents/demo" element={<DemoDocumentPage />} />
        <Route path="/documents/:id" element={<DocumentDetailsPage />} />
        <Route path="/contrats" element={<ContractsPage />} />
        <Route path="/contrats/nouveau" element={<NewContractPage />} />
        <Route path="/contrats/:id/imprimer" element={<ContractPrintPage />} />
        <Route path="/contrats/:id" element={<ContractPage />} />
        <Route path="/parc" element={<ParkPage />} />
        <Route path="/parc/nouveau" element={<NewElevatorPage />} />
        <Route path="/parc/:id/modifier" element={<EditElevatorPage />} />
        <Route path="/parc/:id" element={<ElevatorDetailsPage />} />
        <Route path="/interventions" element={<InterventionsPage />} />
        <Route path="/interventions/nouveau" element={<NewInterventionPage />} />
        <Route path="/interventions/:id/bon" element={<InterventionPrintPage />} />
        <Route path="/interventions/:id" element={<InterventionPage />} />
        <Route path="/recouvrement" element={<ReceivablesPage />} />
        <Route path="/recouvrement/creances" element={<CreancesPage />} />
        <Route path="/recouvrement/cheques" element={<ChequesPage />} />
        <Route path="/recouvrement/clients/:id" element={<ClientReceivablesPage />} />
        <Route path="/stock" element={<StockPage />} />
        <Route path="/stock/inventaire" element={<StockInventoryPage />} />
        <Route path="/stock/:articleId" element={<StockArticlePage />} />
        <Route path="/parametres" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
