import { upsertAssetGroup, dropAssetGroup } from "./route";

describe("upsertAssetGroup", () => {
  it("adiciona o override quando o array está vazio/ausente", () => {
    expect(upsertAssetGroup(undefined, "Feira livre", "cenario")).toEqual([
      { label: "Feira livre", group: "cenario" },
    ]);
  });

  it("substitui o grupo do mesmo label (case-insensitive), sem duplicar", () => {
    const result = upsertAssetGroup(
      [{ label: "Feira livre", group: "vida" }],
      "feira LIVRE",
      "cenario",
    );
    expect(result).toEqual([{ label: "feira LIVRE", group: "cenario" }]);
  });

  it("preserva overrides de outros labels", () => {
    const result = upsertAssetGroup(
      [{ label: "Microfone", group: "objeto" }],
      "Praça",
      "cenario",
    );
    expect(result).toEqual([
      { label: "Microfone", group: "objeto" },
      { label: "Praça", group: "cenario" },
    ]);
  });
});

describe("dropAssetGroup", () => {
  it("remove o override do label (case-insensitive)", () => {
    expect(
      dropAssetGroup([{ label: "Feira livre", group: "cenario" }], "FEIRA LIVRE"),
    ).toBeUndefined();
  });

  it("mantém os demais e retorna undefined só quando esvazia", () => {
    expect(
      dropAssetGroup(
        [
          { label: "Microfone", group: "objeto" },
          { label: "Praça", group: "cenario" },
        ],
        "Praça",
      ),
    ).toEqual([{ label: "Microfone", group: "objeto" }]);
  });

  it("é no-op quando não há overrides", () => {
    expect(dropAssetGroup(undefined, "qualquer")).toBeUndefined();
  });
});
