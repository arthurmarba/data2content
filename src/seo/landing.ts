import type { Metadata } from "next";
import faqItems from "@/data/faq";

export const landingMetadata: Metadata = {
  title: "Data2Content — Feche mais campanhas com IA",
  description:
    "Feche mais campanhas e valorize seu trabalho com a IA da Data2Content. Crie seu mídia kit gratuito e conecte-se a marcas.",
  alternates: { canonical: "https://data2content.ai/" },
  openGraph: {
    title: "Data2Content — Feche mais campanhas com IA",
    description:
      "Feche mais campanhas e valorize seu trabalho com a IA da Data2Content. Crie seu mídia kit gratuito e conecte-se a marcas.",
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
  url: "https://data2content.ai",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://data2content.ai/search?q={search_term_string}",
    "query-input": "required name=search_term_string",
  }
};

export const landingProductJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "data2content",
  description:
    "Feche mais campanhas e valorize seu trabalho com a IA da Data2Content. Crie seu mídia kit gratuito e conecte-se a marcas.",
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
