import type { PlannerUISlot } from "@/hooks/usePlannerData";

import { buildBlueprintFromPlannerSlot } from "./postCreationBlueprintBuilder";

describe("postCreationBlueprintBuilder", () => {
  it("builds a native blueprint with editorial summary and scenes", () => {
    const slot: PlannerUISlot = {
      slotId: "slot-1",
      dayOfWeek: 4,
      blockStartHour: 19,
      format: "reel",
      categories: {
        proposal: ["diagnostico"],
        context: ["retencao"],
        tone: "direto",
      },
      narrativeForm: ["erro -> ajuste -> prova"],
      status: "planned",
      title: "O erro que derruba sua retenção antes da dica",
      scriptShort: "Abra com o erro, mostre o exemplo e feche com pergunta específica.",
      rationale: "Combinação forte no perfil para retenção.",
      expectedMetrics: { viewsP50: 12000, viewsP90: 28000, sharesP50: 240 },
      isSaved: true,
    };

    const blueprint = buildBlueprintFromPlannerSlot(slot);

    expect(blueprint?.whatToPost).toContain("retenção");
    expect(blueprint?.whenToPost).toContain("19h");
    expect(blueprint?.scenes).toHaveLength(4);
    expect(blueprint?.scenes[0]?.title).toBe("Gancho");
    expect(blueprint?.scenes[2]?.title).toBe("Virada prática");
  });
});
