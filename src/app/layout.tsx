import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import { ClientProviders } from "@/components/auth/ClientApplication";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TGI Ascenseurs",
    template: "%s | TGI Ascenseurs",
  },
  description: "Outil interne de gestion de TGI Ascenseurs.",
  manifest: "/manifest.webmanifest",
  formatDetection: { telephone: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TGI",
  },
  icons: {
    icon: [
      { url: "/icons/favicon.png", type: "image/png", sizes: "64x64" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0F19",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${inter.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 font-sans text-slate-900">
        <a
          href="#main-content"
          className="sr-only z-50 rounded-lg bg-white px-4 py-3 font-medium text-blue-700 shadow-sm focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Aller au contenu
        </a>
        <Suspense
          fallback={
            <div
              role="status"
              className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600"
            >
              Chargement de l’application…
            </div>
          }
        >
          <ClientProviders>{children}</ClientProviders>
        </Suspense>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
