import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  const routes = [
    "",
    "/termos-e-condicoes",
    "/politica-de-privacidade",
    "/afiliados",
    "/assinar",
    "/landing",
    "/login",
    "/api/ai-summary",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
  }));
}
