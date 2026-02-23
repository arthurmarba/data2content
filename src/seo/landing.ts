import type { Metadata } from "next";
import faqItems from "@/data/faq";

const SITE_URL = "https://data2content.ai";
const HOME_OG_VERSION = "20260223-home-og-v2";
const HOME_OG_IMAGE_URL = `${SITE_URL}/api/og/home?v=${HOME_OG_VERSION}`;

export const landingMetadata: Metadata = {
  title: "Data2Content: IA para criadores e oportunidades com marcas.",
  description:
    "Analise seus posts, organize sua rotina e apareça para marcas com IA. Crie seu mídia kit e receba propostas no mesmo lugar.",
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    title: "Data2Content: IA para criadores e oportunidades com marcas.",
    description:
      "Analise seus posts, organize sua rotina e apareça para marcas com IA. Crie seu mídia kit e receba propostas no mesmo lugar.",
    url: SITE_URL,
    type: "website",
    siteName: "Data2Content",
    locale: "pt_BR",
    images: [
      {
        url: HOME_OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Data2Content: IA para criadores e oportunidades com marcas",
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    creator: "@data2content",
    title: "Data2Content: IA para criadores e oportunidades com marcas.",
    description:
      "Analise seus posts, organize sua rotina e apareça para marcas com IA. Crie seu mídia kit e receba propostas no mesmo lugar.",
    images: [HOME_OG_IMAGE_URL],
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
    "Analise seus posts, organize sua rotina e apareça para marcas com IA. Crie seu mídia kit e receba propostas no mesmo lugar.",
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
