import type { Metadata } from "next";
import faqItems from "@/data/faq";

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

export const landingProductJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "data2content",
  description:
    "Seu estrategista de conteúdo pessoal que analisa seu Instagram e te diz exatamente o que fazer para crescer.",
  applicationCategory: "MarketingApplication",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "BRL",
  },
};

export const landingOrganizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "data2content",
  url: "https://data2content.ai",
  logo: "https://data2content.ai/images/Colorido-Simbolo.png",
  sameAs: [
    "https://github.com/data2content",
    "https://www.linkedin.com/company/data2content",
    "https://twitter.com/data2content",
    "https://www.instagram.com/data2content",
  ],
};

export const landingFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};
