import { buildDiscoverBoardFeedQueryString } from "./discoverBoardFeedQuery";

describe("buildDiscoverBoardFeedQueryString", () => {
  it("keeps canonical discover filters when loading the community board feed", () => {
    const query = buildDiscoverBoardFeedQueryString(
      "format=reel&context=Moda/Estilo&references=geography.city",
      {
        limitPerRow: 12,
        days: 45,
        surface: "board",
      },
    );
    const params = new URLSearchParams(query);

    expect(params.get("format")).toBe("reel");
    expect(params.get("context")).toBe("fashion_style");
    expect(params.get("references")).toBe("city");
    expect(params.get("limitPerRow")).toBe("12");
    expect(params.get("days")).toBe("45");
    expect(params.get("surface")).toBe("board");
  });

  it("converts legacy proposal and tone params into v2 discover dimensions", () => {
    const query = buildDiscoverBoardFeedQueryString(
      "proposal=guide,tips&tone=Promocional/Comercial",
      {
        limitPerRow: 24,
        days: 80,
        surface: "full",
      },
    );
    const params = new URLSearchParams(query);

    expect(params.get("contentIntent")).toBe("teach");
    expect(params.get("narrativeForm")).toBe("tutorial");
    expect(params.get("proposal")).toBeNull();
    expect(params.get("tone")).toBeNull();
    expect(params.get("surface")).toBe("full");
  });

  it("passes through feed modifiers without leaking unrelated page params", () => {
    const query = buildDiscoverBoardFeedQueryString(
      "videoOnly=1&exp=niche_humor&view=weekend&board=discover&tab=posts",
      {
        limitPerRow: 12,
        days: 45,
        surface: "board",
      },
    );
    const params = new URLSearchParams(query);

    expect(params.get("videoOnly")).toBe("1");
    expect(params.get("exp")).toBe("niche_humor");
    expect(params.get("view")).toBe("weekend");
    expect(params.get("board")).toBeNull();
    expect(params.get("tab")).toBeNull();
  });
});
