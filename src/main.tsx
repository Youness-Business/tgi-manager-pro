import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClientProviders } from "@/components/auth/ClientApplication";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";
import { AppRoutes } from "@/routes/AppRoutes";
import "@/app/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ClientProviders>
        <AppRoutes />
      </ClientProviders>
      <RegisterServiceWorker />
    </BrowserRouter>
  </React.StrictMode>,
);
