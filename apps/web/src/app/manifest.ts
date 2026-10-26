import type { MetadataRoute } from "next";
import fr from "../../messages/fr.json";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: fr.metadata.title,
    short_name: fr.metadata.title,
    description: fr.metadata.description,
    lang: "fr",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#1e3a8a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
