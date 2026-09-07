export const D2C_INTELLIGENCE_SCHEMA_VERSION = "d2c_intelligence_v1";

export type IntelligenceLayerStatus = "available" | "partial" | "unavailable" | "restricted";

export type IntelligenceLayerManifest = {
  id: string;
  label: string;
  source: string;
  scope: string;
  /**
   * "available" exige que `tools` cite ferramentas que existem de verdade no
   * servidor — o teste do contrato confere isso contra a lista registrada.
   * "unavailable" é uma camada que o produto pretende expor e ainda não expõe.
   */
  status: IntelligenceLayerStatus;
  tools: string[];
  fields: string[];
  intentionallyExcluded?: Array<{ field: string; reason: string }>;
};

/**
 * Public, versioned inventory of the intelligence that the MCP is allowed to
 * expose. This is deliberately independent from Mongo schemas: adding a field
 * to a model must not silently make private/raw data available to an AI client.
 */
export const D2C_INTELLIGENCE_MANIFEST: IntelligenceLayerManifest[] = [
  {
    id: "published_content",
    label: "Conteúdo publicado",
    source: "Metric",
    scope: "content:read",
    status: "available",
    tools: ["analyze_creator_period", "get_content_deep_analysis"],
    fields: [
      "format", "caption", "publication", "collaboration", "classification",
      "entities", "lifeAssets", "visualIntelligence",
    ],
    intentionallyExcluded: [
      { field: "rawData", reason: "Resposta bruta de provedores e payloads internos." },
      { field: "classificationError", reason: "Erro operacional interno; o MCP expõe somente status e motivo seguro." },
      { field: "mediaUrl", reason: "URL de mídia pode expirar ou revelar storage privado." },
    ],
  },
  {
    id: "performance",
    label: "Performance e evolução",
    source: "Metric.stats + Metric.dailySnapshots",
    scope: "metrics:read",
    status: "available",
    tools: ["analyze_creator_period", "get_content_deep_analysis", "get_creator_intelligence_snapshot", "list_top_content"],
    fields: ["metrics", "derivedMetrics", "velocity", "baselines", "deltas", "evidenceLevel", "followersGained"],
  },
  {
    id: "audience_growth",
    label: "Saldo de seguidores por dia",
    source: "AccountInsight.followersCount",
    scope: "metrics:read",
    status: "available",
    tools: ["get_follower_growth"],
    fields: [
      "dailyNetGain", "followersAtEndOfDay", "daysCovered", "readingsPerDay",
      "periodNetGain", "bestDay", "worstDay", "coverage",
    ],
    intentionallyExcluded: [
      {
        field: "grossFollowsAndUnfollows",
        reason: "A API do Instagram não devolve seguidas e deixadas de seguir separadamente na coleta atual; só o saldo é verificável.",
      },
      {
        field: "followerIdentities",
        reason: "Quem seguiu é dado pessoal de terceiro; o MCP expõe apenas contagem agregada.",
      },
    ],
  },
  {
    id: "creator_map",
    label: "Mapa narrativo do creator",
    source: "MapaSeed + CreatorMapConfirmations",
    scope: "intelligence:read",
    status: "available",
    tools: ["get_creator_map", "get_creator_intelligence_snapshot"],
    fields: ["narrative", "territories", "themes", "adjacentNarratives", "assets", "tone", "formats", "confirmations"],
    intentionallyExcluded: [
      { field: "dismissedChips", reason: "Controle editorial interno; apenas o efeito da rejeição é aplicado." },
    ],
  },
  {
    id: "video_diagnosis",
    label: "Diagnóstico multimodal de vídeo",
    source: "CreatorVideoNarrativeDiagnosis",
    scope: "intelligence:read",
    // Declarada mas ainda não exposta: nenhum módulo do MCP lê
    // CreatorVideoNarrativeDiagnosis hoje.
    status: "unavailable",
    tools: [],
    fields: [
      "videoReading", "speechReading", "productionReading", "commercialReading",
      "strategicRecommendation", "profileContribution", "evidenceAnchors",
      "contentContext", "narrativeCoherence", "contentPotentialScan", "performanceOutcome",
      "hookRecommendation", "hookSelection", "hookOutcome", "scriptAdjustmentRecommendation",
      "scriptAdjustmentSelection", "scriptAdjustmentOutcome",
    ],
    intentionallyExcluded: [
      { field: "originalFileNameSanitized", reason: "Metadado desnecessário para a análise." },
      { field: "thumbnailUrl", reason: "Pode ser URL assinada; a leitura textual contém as evidências necessárias." },
      { field: "safetyFlags", reason: "Flags operacionais internas; diagnósticos não sanitizados são bloqueados." },
    ],
  },
  {
    id: "audience",
    label: "Audiência agregada",
    source: "AccountInsight",
    scope: "audience:read",
    // A audiência chega ao modelo dentro do DNA de conteúdo, não por
    // ferramenta própria.
    status: "partial",
    tools: ["get_creator_content_dna"],
    fields: ["account", "periodInsights", "followerDemographics", "engagedAudienceDemographics", "growth"],
  },
  {
    id: "outcome_learning",
    label: "Aprendizado histórico",
    source: "CreatorWeeklyReport + ScriptOutcomeProfile",
    scope: "intelligence:read",
    status: "available",
    tools: ["get_creator_intelligence_snapshot"],
    fields: ["weeklyPatterns", "scriptOutcome", "topExamples", "confidence", "sampleSize"],
  },
  {
    id: "creator_script_dna",
    label: "DNA de conteúdo e roteiro",
    source: "PublishedContentEvidence + CreatorScriptDnaProfile + AudienceDemographicSnapshot",
    scope: "intelligence:read",
    status: "available",
    tools: ["get_creator_content_dna", "get_script_evidence_pack", "generate_script_draft", "critique_script_against_creator_dna"],
    fields: [
      "voice", "narrative", "visual", "subjects", "audience", "winningDurations",
      "performanceIndex", "coverage", "confidence", "evidenceReceipt",
    ],
    intentionallyExcluded: [
      { field: "bulkHistoricalTranscripts", reason: "Somente referências próprias selecionadas são entregues; o corpus em massa é privado." },
      { field: "historicalFullScripts", reason: "Roteiros integrais históricos são usados como evidência privada, sem exposição em massa." },
      { field: "demographicRawPayload", reason: "Somente distribuições agregadas e sanitizadas orientam a geração." },
    ],
  },
  {
    id: "creator_script_generation",
    label: "Geração e crítica de roteiro",
    source: "CreatorScriptGenerationV3",
    scope: "scripts:generate",
    status: "available",
    tools: ["generate_script_draft", "critique_script_against_creator_dna", "save_script", "record_script_feedback"],
    fields: ["script", "duration", "validation", "evidenceReceipt", "provider", "model"],
    intentionallyExcluded: [
      { field: "providerPrompt", reason: "Prompt interno contém evidências privadas e regras proprietárias." },
      { field: "verbatimMatchedText", reason: "O MCP recebe apenas o sinal de sobreposição, não o trecho histórico." },
    ],
  },
  {
    id: "collaboration_network",
    label: "Rede de collabs",
    source: "MapaSeed + User + CreatorVideoNarrativeDiagnosis",
    scope: "collabs:read",
    status: "available",
    tools: ["recommend_collab_creators"],
    fields: ["publicProfile", "sharedSignals", "complementarySignals", "fitReason", "recordingDirection", "mode"],
    intentionallyExcluded: [
      { field: "email", reason: "Dado pessoal não necessário para uma sugestão." },
      { field: "location", reason: "O MCP expõe apenas o modo presencial/remoto, nunca localização precisa." },
      { field: "privateMetrics", reason: "Métricas de outro creator não são compartilhadas." },
      { field: "privateEvidence", reason: "Falas e cenas privadas de outro creator não são compartilhadas." },
    ],
  },
  {
    id: "content_ideas",
    label: "Pautas ancoradas no mapa",
    source: "CreatorContentIdea",
    scope: "intelligence:read",
    status: "available",
    tools: ["list_content_ideas"],
    fields: [
      "title", "territory", "angle", "hook", "assets", "suggestedFormat",
      "tone", "whyItFits", "scriptPoints", "scriptClosing", "status",
    ],
    intentionallyExcluded: [
      { field: "generationPrompt", reason: "Prompt interno de geração não é exposto." },
    ],
  },
];

export function getPublicIntelligenceManifest() {
  return {
    schemaVersion: D2C_INTELLIGENCE_SCHEMA_VERSION,
    layers: D2C_INTELLIGENCE_MANIFEST,
  };
}
