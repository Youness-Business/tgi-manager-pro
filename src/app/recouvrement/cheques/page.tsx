import type { Metadata } from "next";
import { ChequePortfolio } from "@/components/recouvrement/ChequePortfolio";

export const metadata: Metadata = {
  title: "Chèques et effets",
  description: "Portefeuille de chèques et échéances d’encaissement.",
};

export default function ChequesPage() {
  return <ChequePortfolio />;
}
