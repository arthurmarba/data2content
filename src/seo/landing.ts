import type { Metadata } from "next";
import { LANDING_PLAN_PRICE_AMOUNT } from "@/app/landing/copy";

const SITE_URL = "https://data2content.ai";
const HOME_SHARE_LOGO_URL = `${SITE_URL}/images/Colorido-Simbolo.png`;

// OG title: ≤60 chars — aparece em negrito no preview do WhatsApp/social
const OG_TITLE = "Data2Content — Análise de conteúdo ao vivo";

// OG description: ≤160 chars — aparece como texto abaixo do título
const OG_DESCRIPTION =
  "Assista gratuitamente à reunião semanal de análise de conteúdo. Toda quinta, às 19h, com Arthur Marbá e Ronaldo Fonseca.";

export const landingMetadata: Metadata = {
  title: OG_TITLE,
  description: OG_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    url: SITE_URL,
    type: "website",
    siteName: "Data2Content",
    locale: "pt_BR",
    images: [
      {
        url: HOME_SHARE_LOGO_URL,
        width: 607,
        height: 539,
        alt: "Logo Data2Content",
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    creator: "@data2content",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [HOME_SHARE_LOGO_URL],
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
    "Experiência consultiva de conteúdo com reunião semanal ao vivo, Mapa, pautas personalizadas, collabs e ferramentas para creators.",
  applicationCategory: "MarketingApplication",
  offers: {
    "@type": "Offer",
    price: LANDING_PLAN_PRICE_AMOUNT,
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
