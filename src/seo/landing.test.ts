import { landingMetadata } from "./landing";

describe("landingMetadata", () => {
  it("usa endpoint OG dinâmico na home", () => {
    const image = landingMetadata.openGraph?.images?.[0];
    const imageUrl = typeof image === "string" ? image : image?.url;

    expect(imageUrl).toContain("https://data2content.ai/api/og/home");
    expect(imageUrl).toContain("v=20260223-home-og-v2");
  });

  it("preenche campos de twitter summary_large_image", () => {
    expect(landingMetadata.twitter?.card).toBe("summary_large_image");
    expect(landingMetadata.twitter?.title).toContain("Data2Content");
    expect(landingMetadata.twitter?.description).toContain("Analise seus posts");
    expect(Array.isArray(landingMetadata.twitter?.images)).toBe(true);
  });
});
