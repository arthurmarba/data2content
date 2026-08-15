import type { IMapaData } from "@/app/models/MapaSeed";
import { applyStrategicMapMutation } from "./applyStrategicMapMutation";

const seed: IMapaData = {
  narrativa_central: "Criar com leveza",
  territorios: ["Rotina criativa"],
  temas: ["Um briefing que mudou"],
  narrativas_adjacentes: [],
  assets: ["Mesa do estúdio"],
  assetGroups: [{ label: "Mesa do estúdio", group: "cenario" }],
  tom: "Direto",
  formatos: [],
  maturidade: "seed",
  fonte: ["onboarding_declarativo"],
};

describe("applyStrategicMapMutation", () => {
  it("adiciona chips sem duplicar por caixa e preserva o estado anterior", () => {
    const added = applyStrategicMapMutation(seed, "territorios", "add", "Bastidores reais");
    const duplicate = applyStrategicMapMutation(added, "territorios", "add", "bastidores REAIS");

    expect(added.territorios).toEqual(["Rotina criativa", "Bastidores reais"]);
    expect(duplicate.territorios).toEqual(added.territorios);
    expect(seed.territorios).toEqual(["Rotina criativa"]);
  });

  it("remove um asset e seu agrupamento visual", () => {
    const result = applyStrategicMapMutation(seed, "assets", "remove", "mesa do ESTÚDIO", "cenario");

    expect(result.assets).toEqual([]);
    expect(result.assetGroups).toEqual([]);
  });

  it("reinsere um asset no grupo escolhido e limita a narrativa", () => {
    const withoutAsset = applyStrategicMapMutation(seed, "assets", "remove", "Mesa do estúdio", "cenario");
    const restored = applyStrategicMapMutation(withoutAsset, "assets", "add", "Mesa do estúdio", "vida");
    const narrative = applyStrategicMapMutation(restored, "narrativa_central", "set", `  ${"a".repeat(220)}  `);

    expect(restored.assetGroups).toEqual([{ label: "Mesa do estúdio", group: "vida" }]);
    expect(narrative.narrativa_central).toHaveLength(200);
  });
});
