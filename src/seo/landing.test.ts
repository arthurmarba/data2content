import { landingMetadata } from "./landing";

describe("landingMetadata", () => {
  it("usa a logo PNG da empresa no preview da home", () => {
    const image = landingMetadata.openGraph?.images?.[0];
    const imageUrl = typeof image === "string" ? image : image?.url;

    expect(imageUrl).toBe("https://data2content.ai/images/Colorido-Simbolo.png");
  });

  it("preenche campos de twitter summary_large_image", () => {
    expect(landingMetadata.twitter?.card).toBe("summary_large_image");
    expect(landingMetadata.twitter?.title).toContain("Data2Content");
    expect(landingMetadata.twitter?.description).toContain("agência estratégica consultiva");
    expect(Array.isArray(landingMetadata.twitter?.images)).toBe(true);
  });
});
