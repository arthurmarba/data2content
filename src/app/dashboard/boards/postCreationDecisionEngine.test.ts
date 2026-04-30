import type { PlannerUISlot } from "@/hooks/usePlannerData";

import {
  buildDecisionPathKey,
  buildPostCreationDecisionEngine,
  estimatePlannerSlotInteractions,
} from "./postCreationDecisionEngine";
import { createEmptyPostCreationFunnelState } from "./postCreationFunnel";

const slots: PlannerUISlot[] = [
  {
    slotId: "slot-1",
    dayOfWeek: 2,
    blockStartHour: 12,
    format: "reel",
    themes: ["opening"],
    categories: { proposal: ["diagnostico"], context: ["retencao"] },
    narrativeForm: ["erro -> ajuste -> prova"],
    status: "planned",
    isSaved: true,
    title: "O erro que derruba sua retenção antes da dica",
    scriptShort: "Abra com o erro, prove com exemplo e feche com pergunta.",
    rationale: "Combinação forte no perfil para retenção.",
    expectedMetrics: { viewsP50: 12000, viewsP90: 28000, sharesP50: 240 },
  },
  {
    slotId: "slot-2",
    dayOfWeek: 4,
    blockStartHour: 19,
    format: "reel",
    themes: ["opening"],
    categories: { proposal: ["diagnostico"], context: ["retencao"] },
    narrativeForm: ["erro -> ajuste -> prova"],
    status: "drafted",
    title: "Por que seu vídeo perde força antes da dica",
    scriptShort: "Mostre o erro de abertura e depois a correção.",
    rationale: "Faixa forte para reels diretos.",
    expectedMetrics: { viewsP50: 11000, viewsP90: 25000, sharesP50: 210 },
  },
  {
    slotId: "slot-3",
    dayOfWeek: 4,
    blockStartHour: 19,
    format: "carousel",
    themes: ["framework simples para planejar 5 posts"],
    categories: { proposal: ["framework"], context: ["planejamento"] },
    narrativeForm: ["passo a passo -> exemplo -> CTA"],
    status: "planned",
    title: "Framework simples para planejar 5 posts",
    scriptShort: "Explique os blocos e convide a copiar.",
    rationale: "Bom para compartilhamento.",
    expectedMetrics: { viewsP50: 9000, viewsP90: 21000, sharesP50: 160 },
  },
];

describe("postCreationDecisionEngine", () => {
  it("resolves a recommended path from planner slots", () => {
    const result = buildPostCreationDecisionEngine(slots, createEmptyPostCreationFunnelState().decision);

    expect(result.checkpoints.length).toBeGreaterThanOrEqual(6);
    expect(result.decision.dayId).toBeTruthy();
    expect(result.decision.hourId).toBeTruthy();
    expect(result.decision.proposalId).toBe("diagnostico");
    expect(result.decision.contextId).toBe("retencao");
    expect(result.ideaCandidates[0]?.variant.lane).toBe("recommended");
    expect(result.ideaCandidates[0]?.decision.formatId).toBe("reel");
  });

  it("keeps a valid upstream selection and recalculates downstream checkpoints", () => {
    const result = buildPostCreationDecisionEngine(slots, {
      ...createEmptyPostCreationFunnelState().decision,
      dayId: "4",
      hourId: "19",
      proposalId: "framework",
      formatId: "carousel",
    });

    expect(result.decision.dayId).toBe("4");
    expect(result.decision.hourId).toBe("19");
    expect(result.decision.proposalId).toBe("framework");
    expect(result.decision.contextId).toBe("planejamento");
    expect(result.ideaCandidates[0]?.variant.title).toContain("Framework");
  });

  it("includes recommendation slots as AI ideas in the candidate pool", () => {
    const recommendationSlots: PlannerUISlot[] = [
      {
        slotId: "rec-1",
        dayOfWeek: 5,
        blockStartHour: 18,
        format: "story",
        categories: { proposal: ["checklist"], context: ["comunidade"] },
        status: "planned",
        title: "Checklist de sexta para fechar a semana",
        scriptShort: "Stories curtos com check rápido e CTA de salvar.",
        rationale: "Boa aposta de rotina leve para sexta.",
        expectedMetrics: { viewsP50: 8500, viewsP90: 19500, sharesP50: 120 },
      },
    ];

    const result = buildPostCreationDecisionEngine(slots.slice(0, 1), createEmptyPostCreationFunnelState().decision, {
      recommendationSlots,
    });

    expect(result.ideaCandidates.some((candidate) => candidate.variant.source === "ai_idea")).toBe(true);
  });

  it("deduplicates legacy and V2 intent aliases before rendering options", () => {
    const intentSlots: PlannerUISlot[] = [
      {
        slotId: "intent-legacy",
        dayOfWeek: 2,
        blockStartHour: 16,
        format: "reel",
        categories: { proposal: ["humor_scene"], context: ["estilo_de_vida"] },
        contentIntent: ["entreter"],
        status: "planned",
        title: "Cena leve sobre rotina de criador",
        expectedMetrics: { viewsP50: 9000, viewsP90: 22000, sharesP50: 100 },
      },
      {
        slotId: "intent-v2",
        dayOfWeek: 3,
        blockStartHour: 16,
        format: "reel",
        categories: { proposal: ["humor_scene"], context: ["estilo_de_vida"] },
        contentIntent: ["entertain"],
        status: "planned",
        title: "Humor rápido sobre bastidores",
        expectedMetrics: { viewsP50: 8500, viewsP90: 21000, sharesP50: 95 },
      },
      {
        slotId: "intent-engage",
        dayOfWeek: 4,
        blockStartHour: 16,
        format: "reel",
        categories: { proposal: ["humor_scene"], context: ["estilo_de_vida"] },
        contentIntent: ["engage"],
        status: "planned",
        title: "Pergunta para abrir conversa",
        expectedMetrics: { viewsP50: 6500, viewsP90: 15000, sharesP50: 60 },
      },
    ];

    const result = buildPostCreationDecisionEngine(intentSlots, createEmptyPostCreationFunnelState().decision);
    const intentCheckpoint = result.checkpoints.find((item) => item.step === "intent");

    expect(intentCheckpoint?.options.map((option) => option.id)).toContain("entreter");
    expect(intentCheckpoint?.options.map((option) => option.id)).not.toContain("entertain");
    expect(intentCheckpoint?.options.filter((option) => option.label === "Entreter")).toHaveLength(1);
    expect(intentCheckpoint?.options.some((option) => option.label === "Entertain")).toBe(false);
  });

  it("uses funnel step preferences to boost checkpoint recommendations inside the active branch", () => {
    const branchSlots: PlannerUISlot[] = [
      {
        slotId: "branch-1",
        dayOfWeek: 4,
        blockStartHour: 19,
        format: "carousel",
        categories: { proposal: ["framework"], context: ["planejamento"] },
        narrativeForm: ["passo a passo -> exemplo -> CTA"],
        status: "planned",
        title: "Framework simples para planejar 5 posts",
        expectedMetrics: { viewsP50: 8200, viewsP90: 18800, sharesP50: 140 },
      },
      {
        slotId: "branch-2",
        dayOfWeek: 4,
        blockStartHour: 19,
        format: "carousel",
        categories: { proposal: ["checklist"], context: ["planejamento"] },
        narrativeForm: ["passo a passo -> exemplo -> CTA"],
        status: "planned",
        title: "Checklist de publicação para a semana",
        expectedMetrics: { viewsP50: 8400, viewsP90: 19200, sharesP50: 150 },
      },
    ];

    const result = buildPostCreationDecisionEngine(
      branchSlots,
      {
        ...createEmptyPostCreationFunnelState().decision,
        contextId: "planejamento",
        dayId: "4",
        hourId: "19",
      },
      {
        preferenceSignals: {
          stepPreferences: {
            proposal: [{ optionId: "framework", count: 20, recommendedRate: 0.9 }],
          },
        },
      }
    );

    const proposalCheckpoint = result.checkpoints.find((item) => item.step === "proposal");
    expect(proposalCheckpoint?.recommendedId).toBe("framework");
  });

  it("uses full path preferences to boost a complete editorial combination", () => {
    const visiblePathKey = buildDecisionPathKey({
      contextId: "planejamento",
      proposalId: "framework",
      toneId: "educational",
      intentId: "educar",
      formatId: "carousel",
      durationId: "30-60s",
      narrativeId: "passo a passo -> exemplo -> CTA",
      dayId: "4",
      hourId: "19",
      themeId: "framework simples para planejar 5 posts",
    });

    const result = buildPostCreationDecisionEngine(
      slots,
      {
        ...createEmptyPostCreationFunnelState().decision,
        dayId: "4",
        hourId: "19",
        proposalId: "framework",
        contextId: "planejamento",
        themeId: "framework simples para planejar 5 posts",
        formatId: "carousel",
      },
      {
        preferenceSignals: {
          pathPreferences: [
            { pathKey: visiblePathKey, count: 6, avgConfidence: 0.92, recommendedRate: 0.9 },
          ],
          pathRules: [{ pathKey: visiblePathKey, mode: "promote", strength: 0.8 }],
        },
      }
    );

    expect(result.ideaCandidates[0]?.variant.title).toContain("Framework");
  });

  it("matches outcome signals by slotId instead of shared title", () => {
    const interactions = estimatePlannerSlotInteractions(slots[2]!, [
      {
        slotId: "other-slot",
        title: "Framework simples para planejar 5 posts",
        totalInteractions: 9999,
      },
    ]);

    expect(interactions).toBe(2005);
  });

  it("explains theme options from the analyzed content text", () => {
    const result = buildPostCreationDecisionEngine(slots, {
      ...createEmptyPostCreationFunnelState().decision,
      contextId: "planejamento",
      proposalId: "framework",
      formatId: "carousel",
      dayId: "4",
      hourId: "19",
    });

    const themeCheckpoint = result.checkpoints.find((item) => item.step === "theme");
    expect(themeCheckpoint?.options[0]?.shortReason).toMatch(/frase que puxa esse tema|frases que puxam esse tema/i);
  });

  it("summarizes repeated theme evidence across multiple analyzed contents", () => {
    const recurringThemeSlots: PlannerUISlot[] = [
      {
        slotId: "theme-1",
        dayOfWeek: 3,
        blockStartHour: 9,
        format: "carousel",
        themeKeyword: "cotidiano",
        categories: { proposal: ["framework"], context: ["planejamento"] },
        narrativeForm: ["passo a passo -> exemplo -> CTA"],
        status: "planned",
        title: "Cotidiano no home office para criar com constância",
        scriptShort: "Mostre os blocos reais do dia e como isso vira conteúdo.",
        expectedMetrics: { viewsP50: 7000, viewsP90: 16200, sharesP50: 110 },
      },
      {
        slotId: "theme-2",
        dayOfWeek: 3,
        blockStartHour: 9,
        format: "carousel",
        themeKeyword: "cotidiano",
        categories: { proposal: ["framework"], context: ["planejamento"] },
        narrativeForm: ["passo a passo -> exemplo -> CTA"],
        status: "drafted",
        title: "Bastidores do cotidiano de criação em dias corridos",
        scriptShort: "Conecte rotina, processo e execução sem parecer pesado.",
        expectedMetrics: { viewsP50: 6800, viewsP90: 15800, sharesP50: 105 },
      },
    ];

    const result = buildPostCreationDecisionEngine(recurringThemeSlots, {
      ...createEmptyPostCreationFunnelState().decision,
      contextId: "planejamento",
      proposalId: "framework",
      formatId: "carousel",
      dayId: "3",
      hourId: "9",
    });

    const themeCheckpoint = result.checkpoints.find((item) => item.step === "theme");
    expect(themeCheckpoint?.options[0]?.shortReason).toMatch(/frases que puxam esse tema/i);
    expect(themeCheckpoint?.options[0]?.shortReason).toMatch(/cotidiano no home office|bastidores do cotidiano/i);
  });
});
