import {
  getDiscoverGridChips,
  getDiscoverPrimaryBadge,
} from "@/app/discover/components/discoverPresentation";

describe("discover presentation", () => {
  it("prioritizes strategic badge from V2 and V2.5 categories", () => {
    expect(
      getDiscoverPrimaryBadge({
        contentIntent: ["convert"],
        narrativeForm: ["review"],
        proofStyle: ["social_proof"],
      })
    ).toBe("Converter");

    expect(
      getDiscoverPrimaryBadge({
        narrativeForm: ["tutorial"],
        proofStyle: ["demonstration"],
      })
    ).toBe("Tutorial/Passo a Passo");
  });

  it("builds minimal grid chips with format, strategic angle and topic", () => {
    expect(
      getDiscoverGridChips({
        format: ["reel"],
        contentIntent: ["teach"],
        context: ["fashion_style"],
        narrativeForm: ["tutorial"],
      })
    ).toEqual([
      { text: "Reel", tone: "format" },
      { text: "Ensinar", tone: "intent" },
      { text: "Moda/Estilo", tone: "topic" },
    ]);

    expect(
      getDiscoverGridChips({
        format: ["carousel"],
        proofStyle: ["social_proof"],
        references: ["city"],
      })
    ).toEqual([
      { text: "Carrossel", tone: "format" },
      { text: "Prova Social", tone: "topic" },
    ]);
  });
});
