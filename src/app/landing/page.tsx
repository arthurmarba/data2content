import LandingPageClient from "../LandingPageClient";
import {
  landingJsonLd,
  landingProductJsonLd,
  landingMetadata,
  landingFaqJsonLd,
  landingOrganizationJsonLd,
} from "@/seo/landing";

export const metadata = {
  ...landingMetadata,
  alternates: { canonical: "https://data2content.ai/landing" },
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            landingJsonLd,
            landingProductJsonLd,
            landingFaqJsonLd,
            landingOrganizationJsonLd,
          ]),
        }}
      />
      <LandingPageClient />
    </>
  );
}
