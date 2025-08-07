import type { Metadata } from "next";

export const landingMetadata: Metadata = {
  title: "data2content - Menos análise, mais criação.",
  description:
    "Seu estrategista de conteúdo pessoal que analisa seu Instagram e te diz exatamente o que fazer para crescer.",
  alternates: { canonical: "https://data2content.ai/" },
  openGraph: {
    title: "data2content - Menos análise, mais criação.",
    description:
      "Seu estrategista de conteúdo pessoal que analisa seu Instagram e te diz exatamente o que fazer para crescer.",
    url: "https://data2content.ai",
    type: "website",
    images: [
      {
        url: "/images/Colorido-Simbolo.png",
        width: 1200,
        height: 630,
        alt: "data2content logo"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    creator: "@data2content"
  }
};

export const landingJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "data2content",
  url: "https://data2content.ai"
};
