import type { CreatorVideoNarrativeDiagnosisInput } from "./creatorVideoNarrativeDiagnosisTypes";

const FIXTURE_USER_ID = "665f0f2c8a0b7d1f2c3a4b5c";

export function buildCreatorVideoNarrativeDiagnosisFixture(
  overrides: Partial<CreatorVideoNarrativeDiagnosisInput> = {},
): CreatorVideoNarrativeDiagnosisInput {
  return {
    userId: FIXTURE_USER_ID,
    diagnosisId: `diagnosis-${Date.now()}`,
    status: "completed",
    source: "mock",
    videoMetadata: {
      mimeType: "video/mp4",
      sizeBytes: 12_000_000,
      durationSeconds: 42,
      originalFileNameSanitized: "rotina-skincare.mp4",
      uploadedAt: new Date("2026-05-20T10:00:00.000Z"),
      analyzedAt: new Date("2026-05-20T10:03:00.000Z"),
    },
    creatorGoal: "Entender se este vídeo pode fortalecer posicionamento comercial.",
    selectedGoalOption: "commercial_positioning",
    videoReading: {
      title: "Rotina que vira prova de autoridade",
      rememberedAs: "Bastidor simples com clareza de recomendação.",
      summary: "O vídeo comunica rotina real e aproxima a creator de um território de cuidado prático.",
      whatVideoReveals: "Revela consistência, repertório de produto e capacidade de explicar escolha.",
      mainNarrative: "Cuidado cotidiano com critério.",
      creatorIntent: "Mostrar uma rotina confiável sem parecer publi direta.",
      dominantInsight: "A autoridade aparece melhor quando a creator explica o porquê das escolhas.",
    },
    speechReading: {
      summary: "A fala é direta, mas pode abrir com uma tensão mais específica.",
      openingRead: "A abertura contextualiza, mas não cria urgência imediata.",
      clarityRead: "A linha central é compreensível.",
      pacingRead: "O ritmo sustenta a atenção sem acelerar demais.",
      suggestedLine: "Eu uso isso quando quero resolver textura sem complicar a rotina.",
      suggestedOpening: "Se sua pele fica boa só no primeiro dia, olha essa ordem.",
      suggestedClosing: "Salva essa ordem para testar quando a rotina estiver confusa.",
    },
    productionReading: {
      summary: "Produção simples, suficiente para credibilidade.",
      framing: "Enquadramento próximo ajuda a leitura dos gestos.",
      lighting: "Luz funcional, com espaço para mais contraste no primeiro frame.",
      audio: "Áudio claro.",
      editingRhythm: "Cortes acompanham a explicação.",
      firstFrame: "Poderia antecipar o resultado ou o problema.",
      visualClarity: "Produtos e gestos ficam legíveis.",
    },
    commercialReading: {
      summary: "Há sinal comercial em skincare, beleza acessível e rotina prática.",
      brandTerritories: ["skincare", "beleza funcional", "rotina prática"],
      whyItCouldFitBrands: "A creator consegue transformar uso real em argumento simples.",
      adAdaptationIdea: "Adaptar para uma sequência problema, escolha, uso e resultado esperado.",
      limitations: "Ainda precisa de mais evidências de performance para sustentar território principal.",
    },
    strategicRecommendation: {
      mainAdjustment: "Abrir com um problema mais reconhecível.",
      nextExperiment: "Testar primeiro frame com promessa clara antes do produto.",
      whatToRepeat: "Tom de bastidor e explicação prática.",
      whatToAvoid: "Começar direto no produto sem tensão narrativa.",
      successSignal: "Mais salvamentos e respostas perguntando pela ordem da rotina.",
    },
    profileContribution: {
      type: "commercial_signal",
      confidence: "medium",
      weight: "medium",
      reason: "O vídeo mostra potencial comercial, mas ainda não deve redefinir o Perfil geral.",
      profileImpactPreview: "Pode virar evidência futura de território em beleza funcional se recorrente.",
    },
    schemaVersion: "creator_video_narrative_diagnosis_v1",
    ...overrides,
  };
}
