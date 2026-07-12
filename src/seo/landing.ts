import type { Metadata } from "next";
import { LANDING_FAQ_ITEMS } from "@/app/landing/faqData";

const SITE_URL = "https://data2content.ai";
const HOME_SHARE_LOGO_URL = `${SITE_URL}/images/Colorido-Simbolo.png`;

// OG title: ≤60 chars — aparece em negrito no preview do WhatsApp/social
const OG_TITLE = "Data2Content — Entenda o que seu conteúdo diz sobre você";

// OG description: ≤160 chars — aparece como texto abaixo do título
const OG_DESCRIPTION =
  "Descubra o que está funcionando, receba ideias prontas para postar e encontre criadores para crescer junto.";

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
  mainEntity: LANDING_FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};
