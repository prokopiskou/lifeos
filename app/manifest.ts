import type { MetadataRoute } from "next";

// PWA manifest (Phase 8). ΣΗΜ: πρόσθεσε icons στο /public/ (π.χ. icon-192.png,
// icon-512.png) και ξεμπλόκαρε το `icons` array για πλήρες install prompt.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Within OS",
    short_name: "Within",
    description: "Δεν χτίζουμε καλύτερες μέρες. Χτίζουμε ποιος είσαι μέσα τους.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FAFAF7",
    theme_color: "#000000",
    lang: "el",
    icons: [
      // { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      // { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
