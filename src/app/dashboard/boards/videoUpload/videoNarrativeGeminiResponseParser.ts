import type { VideoNarrativeAiAnalysis, VideoNarrativeAiIssue } from "./videoNarrativeAiProviderTypes";

const REQUIRED_FIELDS: Array<keyof VideoNarrativeAiAnalysis> = [
  "mainNarrative",
  "whatVideoCommunicates",
  "creatorIntention",
  "strategicReading",
  "strengthPoint",
  "attentionPoint",
  "recommendedAdjustment",
  "suggestedHook",
  "commercialPotential",
  "nextActions",
  "creatorSignals",
  "brandTerritories",
  "collabOpportunities",
];

const STRING_FIELDS: Array<keyof VideoNarrativeAiAnalysis> = [
  "mainNarrative",
  "whatVideoCommunicates",
  "creatorIntention",
  "strategicReading",
  "strengthPoint",
  "attentionPoint",
  "recommendedAdjustment",
  "suggestedHook",
  "commercialPotential",
];

const ARRAY_FIELDS: Array<keyof VideoNarrativeAiAnalysis> = [
  "nextActions",
  "creatorSignals",
  "brandTerritories",
  "collabOpportunities",
];

const FORBIDDEN_REPLACEMENTS: Array<[RegExp, string]> = [
  [/score/gi, "leitura"],
  [/nota/gi, "avaliação"],
  [/pontos/gi, "sinais"],
  [/ranking/gi, "referência"],
  [/gabarito/gi, "direção"],
  [/garantido/gi, "possível"],
  [/certeza/gi, "hipótese"],
  [/comprovado/gi, "observado"],
  [/viralizar garantido/gi, "ganhar clareza"],
  [/match real/gi, "afinidade possível"],
  [/marca garantida/gi, "marca possível"],
  [/patrocínio garantido/gi, "oportunidade futura"],
  [/vídeos salvos/gi, "leituras anteriores"],
  [/histórico de vídeos/gi, "diagnóstico vivo"],
  [/novo Mídia Kit/gi, "Perfil da D2C"],
  [/Mídia Kit mobile/gi, "Perfil da D2C"],
  [/18 sinais/gi, "sinais"],
  [/3 narrativas/gi, "narrativas"],
  [/percentual de perfil/gi, "leitura do perfil"],
];

const SIGNED_URL_PATTERN = /https?:\/\/\S*(signature|expires|token|policy)=\S*/i;
const API_KEY_PATTERN = /(AIzaSy[A-Za-z0-9-_]{20,}|sk-[A-Za-z0-9-_]{20,}|api[_-]?key|bearer\s+[A-Za-z0-9._-]+)/i;
const RAW_TRANSCRIPT_KEYS = new Set(["rawTranscript", "transcript", "fullTranscript"]);
const MAX_STRING_LENGTH = 420;
const MAX_ARRAY_ITEMS = 5;

export type VideoNarrativeGeminiResponseParseResult =
  | { ok: true; analysis: VideoNarrativeAiAnalysis; issues: VideoNarrativeAiIssue[] }
  | { ok: false; issues: VideoNarrativeAiIssue[] };

function issue(code: string, message: string, severity: VideoNarrativeAiIssue["severity"] = "blocker"): VideoNarrativeAiIssue {
  return { code, severity, message };
}

function stripCodeFences(rawText: string): string {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsForbiddenPayload(value: unknown): "signed_url" | "api_key" | "raw_transcript" | null {
  if (typeof value === "string") {
    if (SIGNED_URL_PATTERN.test(value)) return "signed_url";
    if (API_KEY_PATTERN.test(value)) return "api_key";
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = containsForbiddenPayload(item);
      if (found) return found;
    }
  }
  if (isRecord(value)) {
    for (const [key, nested] of Object.entries(value)) {
      if (RAW_TRANSCRIPT_KEYS.has(key) && typeof nested === "string" && nested.length > 600) {
        return "raw_transcript";
      }
      const found = containsForbiddenPayload(nested);
      if (found) return found;
    }
  }
  return null;
}

function sanitizeText(value: string): string {
  let output = value.replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of FORBIDDEN_REPLACEMENTS) {
    output = output.replace(pattern, replacement);
  }
  return output.slice(0, MAX_STRING_LENGTH).trim();
}

function readRequiredString(raw: Record<string, unknown>, field: keyof VideoNarrativeAiAnalysis): string | null {
  const value = raw[field];
  if (typeof value !== "string" || !value.trim()) return null;
  return sanitizeText(value);
}

function readStringArray(raw: Record<string, unknown>, field: keyof VideoNarrativeAiAnalysis): string[] | null {
  const value = raw[field];
  if (!Array.isArray(value)) return null;
  return value
    .filter((item): item is string => typeof item === "string")
    .map(sanitizeText)
    .filter(Boolean)
    .slice(0, MAX_ARRAY_ITEMS);
}

export function parseVideoNarrativeGeminiResponse(rawText: string): VideoNarrativeGeminiResponseParseResult {
  if (!rawText.trim()) {
    return { ok: false, issues: [issue("empty_response", "Resposta vazia do provider multimodal.")] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(rawText));
  } catch {
    return { ok: false, issues: [issue("invalid_json", "Resposta do provider multimodal não é JSON válido.")] };
  }

  if (!isRecord(parsed)) {
    return { ok: false, issues: [issue("missing_object", "Resposta do provider multimodal não contém objeto estruturado.")] };
  }

  const forbidden = containsForbiddenPayload(parsed);
  if (forbidden) {
    return { ok: false, issues: [issue(forbidden, "Resposta do provider multimodal contém dado inseguro.")] };
  }

  const missing = REQUIRED_FIELDS.filter((field) => !(field in parsed));
  if (missing.length > 0) {
    return { ok: false, issues: [issue("missing_required_fields", "Resposta do provider multimodal está incompleta.")] };
  }

  const strings = Object.fromEntries(
    STRING_FIELDS.map((field) => [field, readRequiredString(parsed, field)]),
  ) as Record<(typeof STRING_FIELDS)[number], string | null>;
  if (Object.values(strings).some((value) => !value)) {
    return { ok: false, issues: [issue("invalid_required_string", "Resposta do provider multimodal tem campos textuais inválidos.")] };
  }

  const arrays = Object.fromEntries(ARRAY_FIELDS.map((field) => [field, readStringArray(parsed, field)])) as Record<
    (typeof ARRAY_FIELDS)[number],
    string[] | null
  >;
  if (Object.values(arrays).some((value) => !value)) {
    return { ok: false, issues: [issue("invalid_required_array", "Resposta do provider multimodal tem listas inválidas.")] };
  }

  return {
    ok: true,
    analysis: {
      mainNarrative: strings.mainNarrative!,
      whatVideoCommunicates: strings.whatVideoCommunicates!,
      creatorIntention: strings.creatorIntention!,
      strategicReading: strings.strategicReading!,
      strengthPoint: strings.strengthPoint!,
      attentionPoint: strings.attentionPoint!,
      recommendedAdjustment: strings.recommendedAdjustment!,
      suggestedHook: strings.suggestedHook!,
      commercialPotential: strings.commercialPotential!,
      nextActions: arrays.nextActions!,
      creatorSignals: arrays.creatorSignals!,
      brandTerritories: arrays.brandTerritories!,
      collabOpportunities: arrays.collabOpportunities!,
    },
    issues: [],
  };
}
