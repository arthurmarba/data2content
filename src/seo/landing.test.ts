import { LANDING_PLAN_PRICE_AMOUNT } from "@/app/landing/copy";

import { landingMetadata, landingProductJsonLd } from "./landing";

describe("landingMetadata", () => {
  it("usa a logo PNG da empresa no preview da home", () => {
    const image = landingMetadata.openGraph?.images?.[0];
    const imageUrl = typeof image === "string" ? image : image?.url;

    expect(imageUrl).toBe("https://data2content.ai/images/Colorido-Simbolo.png");
  });

  it("preenche campos de twitter summary_large_image", () => {
    expect(landingMetadata.twitter?.card).toBe("summary_large_image");
    expect(landingMetadata.twitter?.title).toBe("Data2Content — Tendência vira direção");
    expect(landingMetadata.twitter?.description).toBe(
      "Inteligência de tendências para criadores e marcas. Descubra assuntos, formatos e sinais para seu conteúdo crescer, engajar e vender."
    );
    expect(Array.isArray(landingMetadata.twitter?.images)).toBe(true);
  });

  it("mantém o preço estruturado sincronizado com a landing", () => {
    expect(landingProductJsonLd.offers.price).toBe(LANDING_PLAN_PRICE_AMOUNT);
    expect(landingProductJsonLd.offers.priceCurrency).toBe("BRL");
  });
});
