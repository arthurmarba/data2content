export const D2C_INTELLIGENCE_SCHEMA_VERSION = "d2c_intelligence_v1";

export type IntelligenceLayerStatus = "available" | "partial" | "unavailable" | "restricted";

export type IntelligenceLayerManifest = {
  id: string;
  label: string;
  source: string;
  scope: string;
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
    tools: ["analyze_content_period", "get_content_detail"],
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
    tools: ["analyze_content_period", "get_content_detail", "get_creator_playbook"],
    fields: ["metrics", "derivedMetrics", "velocity", "baselines", "deltas", "evidenceLevel"],
  },
  {
    id: "creator_map",
    label: "Mapa narrativo do creator",
    source: "MapaSeed + CreatorMapConfirmations",
    scope: "intelligence:read",
    tools: ["get_creator_intelligence_profile"],
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
    tools: ["get_video_diagnosis"],
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
    tools: ["get_audience_intelligence"],
    fields: ["account", "periodInsights", "followerDemographics", "engagedAudienceDemographics", "growth"],
  },
  {
    id: "outcome_learning",
    label: "Aprendizado histórico",
    source: "CreatorWeeklyReport + ScriptOutcomeProfile",
    scope: "intelligence:read",
    tools: ["get_creator_playbook"],
    fields: ["weeklyPatterns", "scriptOutcome", "topExamples", "confidence", "sampleSize"],
  },
  {
    id: "creator_script_dna",
    label: "DNA de conteúdo e roteiro",
    source: "PublishedContentEvidence + CreatorScriptDnaProfile + AudienceDemographicSnapshot",
    scope: "intelligence:read",
    tools: ["get_creator_content_dna", "generate_creator_script", "critique_script_against_creator_dna"],
    fields: [
      "voice", "narrative", "visual", "subjects", "audience", "winningDurations",
      "performanceIndex", "coverage", "confidence", "evidenceReceipt",
    ],
    intentionallyExcluded: [
      { field: "historicalFullTranscripts", reason: "O corpus integral é usado internamente na recuperação, sem ser entregue ao cliente MCP." },
      { field: "historicalFullScripts", reason: "Roteiros integrais históricos são usados como evidência privada, sem exposição em massa." },
      { field: "demographicRawPayload", reason: "Somente distribuições agregadas e sanitizadas orientam a geração." },
    ],
  },
  {
    id: "creator_script_generation",
    label: "Geração e crítica de roteiro",
    source: "CreatorScriptGenerationV3",
    scope: "scripts:generate",
    tools: ["generate_creator_script", "critique_script_against_creator_dna", "save_generated_script"],
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
    tools: ["suggest_collab_creators"],
    fields: ["publicProfile", "sharedSignals", "complementarySignals", "fitReason", "recordingDirection", "mode"],
    intentionallyExcluded: [
      { field: "email", reason: "Dado pessoal não necessário para uma sugestão." },
      { field: "location", reason: "O MCP expõe apenas o modo presencial/remoto, nunca localização precisa." },
      { field: "privateMetrics", reason: "Métricas de outro creator não são compartilhadas." },
      { field: "privateEvidence", reason: "Falas e cenas privadas de outro creator não são compartilhadas." },
    ],
  },
];

export function getPublicIntelligenceManifest() {
  return {
    schemaVersion: D2C_INTELLIGENCE_SCHEMA_VERSION,
    layers: D2C_INTELLIGENCE_MANIFEST,
  };
}
