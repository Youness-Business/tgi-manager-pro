import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TGI Ascenseurs – Manager Pro",
    short_name: "TGI",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    theme_color: "#0B0F19",
    background_color: "#0B0F19",
    lang: "fr",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Nouvelle facture",
        short_name: "Facture",
        url: "/documents/nouveau?type=facture",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Recouvrement",
        short_name: "Recouvrement",
        url: "/recouvrement",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
