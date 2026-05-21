import type { VideoNarrativeAiAnalysis, VideoNarrativeAiIssue } from "./videoNarrativeAiProviderTypes";
import type { CreatorVideoNarrativeEvidenceAnchors } from "./creatorVideoNarrativeDiagnosisTypes";

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
const MAX_ANCHOR_ITEMS = 4;
const MAX_QUOTE_LENGTH = 180;
const MAX_ANCHOR_TEXT_LENGTH = 260;
const LARGE_BASE64_PATTERN = /(?:data:[^;]+;base64,)?[A-Za-z0-9+/=]{1200,}/;
const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const STORAGE_PATH_PATTERN = /\b(?:uploads|video-narrative|mobile-strategic-profile|tmp|temporary)\/[A-Za-z0-9._/-]+\.(mp4|mov|webm|mkv)\b/gi;
const STORAGE_FIELD_PATTERN = /\b(?:objectKey|signedUrl|uploadUrl|thumbnailUrl|localPath|storageProviderPath)\b/gi;
const VALID_QUOTE_ROLES = new Set(["hook", "promise", "turning_point", "closing", "example", "context", "other"]);
const VALID_MOMENT_ROLES = new Set(["opening", "conflict", "turning_point", "visual_signal", "pacing_signal", "production_signal", "other"]);
const VALID_CHAPTER_HINTS = new Set(["pattern", "tension", "movement", "territory", "video_reveal", "profile_impact", "opportunities"]);

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
      if (key === "evidenceAnchors") continue;
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
  output = output
    .replace(URL_PATTERN, "[url-redigida]")
    .replace(STORAGE_PATH_PATTERN, "[storage-redigido]")
    .replace(STORAGE_FIELD_PATTERN, "[storage-redigido]")
    .replace(LARGE_BASE64_PATTERN, "[base64-redigido]");
  return output.slice(0, MAX_STRING_LENGTH).trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function sanitizeAnchorText(value: unknown, maxLength = MAX_ANCHOR_TEXT_LENGTH): string | null {
  if (typeof value !== "string") return null;
  if (LARGE_BASE64_PATTERN.test(value)) return null;
  const lineCount = value.split(/\n+/).filter(Boolean).length;
  const timestampCount = (value.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g) ?? []).length;
  if (value.length > 2000 || lineCount >= 12 || timestampCount >= 6) return null;
  const sanitized = sanitizeText(value).replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, "").replace(/\s+/g, " ").trim();
  return sanitized ? truncate(sanitized, maxLength) : null;
}

function readEnum<T extends string>(value: unknown, valid: Set<string>, fallback: T): T {
  return typeof value === "string" && valid.has(value) ? (value as T) : fallback;
}

function readEvidenceAnchors(value: unknown): {
  anchors?: CreatorVideoNarrativeEvidenceAnchors;
  issues: VideoNarrativeAiIssue[];
} {
  if (value === undefined || value === null) return { anchors: undefined, issues: [] };
  if (!isRecord(value)) {
    return { anchors: undefined, issues: [issue("invalid_evidence_anchors", "Evidence anchors inválidos foram descartados.", "warning")] };
  }

  const issues: VideoNarrativeAiIssue[] = [];
  try {
    const speechQuotes = (Array.isArray(value.speechQuotes) ? value.speechQuotes : [])
      .slice(0, MAX_ANCHOR_ITEMS)
      .filter(isRecord)
      .map((item) => {
        const quote = sanitizeAnchorText(item.quote, MAX_QUOTE_LENGTH);
        const whyItMatters = sanitizeAnchorText(item.whyItMatters);
        const source = item.source === "creator_spoken" ? "creator_spoken" : null;
        if (!quote || !whyItMatters || !source) return null;
        return {
          quote,
          source,
          quoteRole: readEnum(item.quoteRole, VALID_QUOTE_ROLES, "other"),
          whyItMatters,
          chapterHint: readEnum(item.chapterHint, VALID_CHAPTER_HINTS, "video_reveal"),
        };
      })
      .filter(Boolean) as CreatorVideoNarrativeEvidenceAnchors["speechQuotes"];

    const sceneAnchors = (Array.isArray(value.sceneAnchors) ? value.sceneAnchors : [])
      .slice(0, MAX_ANCHOR_ITEMS)
      .filter(isRecord)
      .map((item) => {
        const description = sanitizeAnchorText(item.description);
        const whyItMatters = sanitizeAnchorText(item.whyItMatters);
        const source = item.source === "model_observed" || item.source === "derived_scene" ? item.source : "model_observed";
        if (!description || !whyItMatters) return null;
        return {
          description,
          source,
          momentRole: readEnum(item.momentRole, VALID_MOMENT_ROLES, "other"),
          whyItMatters,
          chapterHint: readEnum(item.chapterHint, VALID_CHAPTER_HINTS, "video_reveal"),
        };
      })
      .filter(Boolean) as CreatorVideoNarrativeEvidenceAnchors["sceneAnchors"];

    const rawIntent = isRecord(value.creatorIntentAnchor) ? value.creatorIntentAnchor : null;
    const creatorIntentAnchor = rawIntent
      ? (() => {
          const statedGoal = sanitizeAnchorText(rawIntent.statedGoal);
          const interpretedGoal = sanitizeAnchorText(rawIntent.interpretedGoal);
          const whyItMatters = sanitizeAnchorText(rawIntent.whyItMatters);
          if (!statedGoal || !interpretedGoal || !whyItMatters) return null;
          return {
            source: "creator_goal" as const,
            statedGoal,
            interpretedGoal,
            whyItMatters,
          };
        })()
      : null;

    if (
      (Array.isArray(value.speechQuotes) && speechQuotes.length < Math.min(value.speechQuotes.length, MAX_ANCHOR_ITEMS)) ||
      (Array.isArray(value.sceneAnchors) && sceneAnchors.length < Math.min(value.sceneAnchors.length, MAX_ANCHOR_ITEMS)) ||
      (rawIntent && !creatorIntentAnchor)
    ) {
      issues.push(issue("invalid_evidence_anchors", "Parte dos evidence anchors foi descartada por segurança.", "warning"));
    }

    return {
      anchors: {
        speechQuotes,
        sceneAnchors,
        creatorIntentAnchor,
        profilePatternAnchors: [],
        instagramAnchors: [],
      },
      issues,
    };
  } catch {
    return { anchors: undefined, issues: [issue("invalid_evidence_anchors", "Evidence anchors inválidos foram descartados.", "warning")] };
  }
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
  const evidenceAnchors = readEvidenceAnchors(parsed.evidenceAnchors);

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
      ...(evidenceAnchors.anchors ? { evidenceAnchors: evidenceAnchors.anchors } : {}),
    },
    issues: evidenceAnchors.issues,
  };
}
