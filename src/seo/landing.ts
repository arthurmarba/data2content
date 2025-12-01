import type { Metadata } from "next";
import faqItems from "@/data/faq";

export const landingMetadata: Metadata = {
  title: "Agência que dá suporte aos criadores com estratégia de imagem e conteúdo.",
  description:
    "E faz o match entre marcas e criadores com IA. Crie seu mídia kit conosco — é por lá que a marca envia a proposta de publi.",
  alternates: { canonical: "https://data2content.ai/" },
  openGraph: {
    title: "Agência que dá suporte aos criadores com estratégia de imagem e conteúdo.",
    description:
      "E faz o match entre marcas e criadores com IA. Crie seu mídia kit conosco — é por lá que a marca envia a proposta de publi.",
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
    "Agência que dá suporte aos criadores com estratégia de imagem e conteúdo. E faz o match entre marcas e criadores com IA. Crie seu mídia kit conosco — é por lá que a marca envia a proposta de publi.",
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
