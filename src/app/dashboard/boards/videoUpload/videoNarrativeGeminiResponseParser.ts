import type {
  VideoNarrativeAiAnalysis,
  VideoNarrativeAiIssue,
  VideoNarrativeContentContext,
  VideoNarrativeCoherence,
  VideoNarrativeAxisCoherence,
} from "./videoNarrativeAiProviderTypes";
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
const VALID_COHERENCE_VERDICTS = new Set(["confirms_top_pattern", "experiment", "deviation", "first_reading", "unknown"]);
const VALID_AXIS_VERDICTS = new Set(["aligned", "tension", "off", "unknown"]);

const FIELD_ALIASES: Record<keyof VideoNarrativeAiAnalysis, string[]> = {
  directAnswer: ["direct_answer", "respostaDireta", "resposta_direta", "answer", "resposta"],
  mainNarrative: ["main_narrative", "narrativaPrincipal", "narrativa_principal", "narrative", "narrativa"],
  whatVideoCommunicates: ["what_video_communicates", "videoMessage", "mensagemDoVideo", "oQueOVideoComunica"],
  creatorIntention: ["creator_intention", "creatorIntent", "intencaoDoCreator", "intençãoDoCreator", "intencao"],
  strategicReading: ["strategic_reading", "leituraEstrategica", "leitura_estrategica", "diagnosis", "diagnostico"],
  strengthPoint: ["strength_point", "strength", "pontoDeForca", "ponto_de_forca", "forca"],
  attentionPoint: ["attention_point", "attention", "pontoDeAtencao", "ponto_de_atencao", "atencao"],
  recommendedAdjustment: ["recommended_adjustment", "adjustment", "calibragem", "ajusteRecomendado", "ajuste_recomendado"],
  suggestedHook: ["suggested_hook", "hook", "ganchoSugerido", "gancho_sugerido", "gancho"],
  commercialPotential: ["commercial_potential", "commercialFit", "territorioComercial", "potencialComercial"],
  nextActions: ["next_actions", "nextSteps", "proximosSinais", "proximasAcoes", "próximasAções"],
  creatorSignals: ["creator_signals", "signals", "sinaisDoCreator", "sinais_do_creator", "sinais"],
  brandTerritories: ["brand_territories", "territories", "territoriosDeMarca", "territorios_de_marca", "territorios"],
  collabOpportunities: ["collab_opportunities", "collabs", "oportunidadesDeCollab", "oportunidades_de_collab"],
  evidenceAnchors: ["evidence_anchors", "evidence", "anchors", "evidencias", "evidências"],
  contentContext: ["content_context", "contextoDoConteudo", "contexto_do_conteudo"],
  narrativeCoherence: ["narrative_coherence", "coerenciaNarrativa", "coerênciaNarrativa", "coerencia_narrativa"],
  audienceCoherence: ["audience_coherence", "coerenciaAudiencia", "coerênciaAudiência", "coerencia_audiencia"],
  brandCoherence: ["brand_coherence", "coerenciaMarca", "coerênciaMarca", "coerencia_marca"],
};

const SHORT_STRING_MAX = 120;

function readOptionalShortString(value: unknown): string | null {
  const text = readNestedText(value);
  if (!text) return null;
  const sanitized = sanitizeText(text).slice(0, SHORT_STRING_MAX).trim();
  return sanitized || null;
}

function readShortStringArray(value: unknown, maxItems = 6): string[] {
  if (typeof value === "string") {
    return value
      .split(/\n+|;|•|- /)
      .map((s) => sanitizeText(s).slice(0, SHORT_STRING_MAX).trim())
      .filter(Boolean)
      .slice(0, maxItems);
  }
  if (!Array.isArray(value)) return [];
  return value
    .map(readNestedText)
    .filter((item): item is string => typeof item === "string")
    .map((s) => sanitizeText(s).slice(0, SHORT_STRING_MAX).trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

/** Parse optional contentContext — returns undefined if missing or invalid, never throws. */
function readContentContext(raw: Record<string, unknown>): VideoNarrativeContentContext | undefined {
  const value = readAliasedField(raw, "contentContext");
  if (!isRecord(value)) return undefined;
  return {
    setting: readOptionalShortString(value.setting),
    socialPresence: readOptionalShortString(value.socialPresence),
    emotionalRegister: readOptionalShortString(value.emotionalRegister),
    humorStyle: readOptionalShortString(value.humorStyle),
    energyLevel: readOptionalShortString(value.energyLevel),
    lifeSignals: readShortStringArray(value.lifeSignals),
    productionStyle: readOptionalShortString(value.productionStyle),
  };
}

/** Parse optional narrativeCoherence — returns undefined if missing or invalid, never throws. */
function readNarrativeCoherence(raw: Record<string, unknown>): VideoNarrativeCoherence | undefined {
  const value = readAliasedField(raw, "narrativeCoherence");
  if (!isRecord(value)) return undefined;
  return {
    verdict: readEnum(value.verdict, VALID_COHERENCE_VERDICTS, "unknown") as VideoNarrativeCoherence["verdict"],
    topPattern: readOptionalShortString(value.topPattern),
    reasoning: typeof value.reasoning === "string" ? sanitizeText(value.reasoning) || null : null,
    alignedAssets: readShortStringArray(value.alignedAssets, 5),
    newAssets: readShortStringArray(value.newAssets, 5),
  };
}

/** Parse an optional non-narrative axis (audience/brand) — returns undefined if missing/invalid. */
function readAxisCoherence(
  raw: Record<string, unknown>,
  field: "audienceCoherence" | "brandCoherence",
): VideoNarrativeAxisCoherence | undefined {
  const value = readAliasedField(raw, field);
  if (!isRecord(value)) return undefined;
  return {
    verdict: readEnum(value.verdict, VALID_AXIS_VERDICTS, "unknown") as VideoNarrativeAxisCoherence["verdict"],
    reading: readOptionalShortString(value.reading),
  };
}

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

function extractJsonObjectCandidate(rawText: string): string {
  const stripped = stripCodeFences(rawText);
  if (stripped.startsWith("{") && stripped.endsWith("}")) return stripped;

  const looseFence = stripped.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (looseFence?.[1]) return looseFence[1].trim();

  const start = stripped.indexOf("{");
  if (start === -1) return stripped;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < stripped.length; index += 1) {
    const char = stripped[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return stripped.slice(start, index + 1);
    }
  }

  return stripped;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readAliasedField(raw: Record<string, unknown>, field: keyof VideoNarrativeAiAnalysis): unknown {
  if (field in raw) return raw[field];
  for (const alias of FIELD_ALIASES[field] ?? []) {
    if (alias in raw) return raw[alias];
  }
  return undefined;
}

function readNestedText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = readNestedText(item);
      if (nested) return nested;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  for (const key of ["text", "value", "summary", "description", "reading", "signal", "label", "title", "territory"]) {
    const nested = readNestedText(value[key]);
    if (nested) return nested;
  }
  return null;
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
  const value = readNestedText(readAliasedField(raw, field));
  if (!value?.trim()) return null;
  const maxLength = field === "mainNarrative" ? 90 : MAX_STRING_LENGTH;
  return truncate(sanitizeText(value), maxLength);
}

function readStringArray(raw: Record<string, unknown>, field: keyof VideoNarrativeAiAnalysis): string[] | null {
  const value = readAliasedField(raw, field);
  if (typeof value === "string") {
    const items = value
      .split(/\n+|;|•|- /)
      .map(sanitizeText)
      .filter(Boolean)
      .slice(0, MAX_ARRAY_ITEMS);
    return items.length > 0 ? items : [];
  }
  if (!Array.isArray(value)) return null;
  return value
    .map(readNestedText)
    .filter((item): item is string => typeof item === "string")
    .map((item) => sanitizeText(item))
    .filter(Boolean)
    .slice(0, MAX_ARRAY_ITEMS);
}

function hasRequiredFieldCandidate(value: Record<string, unknown>): boolean {
  return REQUIRED_FIELDS.some((field) => readAliasedField(value, field) !== undefined);
}

function unwrapAnalysisObject(parsed: Record<string, unknown>): Record<string, unknown> {
  if (hasRequiredFieldCandidate(parsed)) return parsed;
  for (const key of ["analysis", "diagnosis", "diagnóstico", "diagnostico", "result", "data", "reading", "leitura"]) {
    const nested = parsed[key];
    if (isRecord(nested) && hasRequiredFieldCandidate(nested)) return nested;
  }
  return parsed;
}

export function parseVideoNarrativeGeminiResponse(rawText: string): VideoNarrativeGeminiResponseParseResult {
  if (!rawText.trim()) {
    return { ok: false, issues: [issue("empty_response", "Resposta vazia do provider multimodal.")] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObjectCandidate(rawText));
  } catch {
    return { ok: false, issues: [issue("invalid_json", "Resposta do provider multimodal não é JSON válido.")] };
  }

  if (Array.isArray(parsed)) {
    parsed = parsed.find(isRecord) ?? parsed;
  }

  if (!isRecord(parsed)) {
    return { ok: false, issues: [issue("missing_object", "Resposta do provider multimodal não contém objeto estruturado.")] };
  }

  const root = unwrapAnalysisObject(parsed);
  const forbidden = containsForbiddenPayload(root);
  if (forbidden) {
    return { ok: false, issues: [issue(forbidden, "Resposta do provider multimodal contém dado inseguro.")] };
  }

  const missing = REQUIRED_FIELDS.filter((field) => readAliasedField(root, field) === undefined);
  if (missing.length > 0) {
    return { ok: false, issues: [issue("missing_required_fields", "Resposta do provider multimodal está incompleta.")] };
  }

  const strings = Object.fromEntries(
    STRING_FIELDS.map((field) => [field, readRequiredString(root, field)]),
  ) as Record<(typeof STRING_FIELDS)[number], string | null>;
  if (Object.values(strings).some((value) => !value)) {
    return { ok: false, issues: [issue("invalid_required_string", "Resposta do provider multimodal tem campos textuais inválidos.")] };
  }

  const arrays = Object.fromEntries(ARRAY_FIELDS.map((field) => [field, readStringArray(root, field)])) as Record<
    (typeof ARRAY_FIELDS)[number],
    string[] | null
  >;
  if (Object.values(arrays).some((value) => !value)) {
    return { ok: false, issues: [issue("invalid_required_array", "Resposta do provider multimodal tem listas inválidas.")] };
  }
  const evidenceAnchors = readEvidenceAnchors(
    readAliasedField(root, "evidenceAnchors") ?? {
      speechQuotes: root.speechQuotes,
      sceneAnchors: root.sceneAnchors,
      creatorIntentAnchor: root.creatorIntentAnchor,
    },
  );
  const contentContext = readContentContext(root);
  const narrativeCoherence = readNarrativeCoherence(root);
  const audienceCoherence = readAxisCoherence(root, "audienceCoherence");
  const brandCoherence = readAxisCoherence(root, "brandCoherence");

  // Optional: direct answer to the creator's question. Absent in older responses,
  // so it never blocks parsing — just truncated/sanitised when present.
  const directAnswerRaw = readNestedText(readAliasedField(root, "directAnswer"));
  const directAnswer = directAnswerRaw?.trim() ? truncate(sanitizeText(directAnswerRaw), 280) : undefined;

  return {
    ok: true,
    analysis: {
      ...(directAnswer ? { directAnswer } : {}),
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
      ...(contentContext ? { contentContext } : {}),
      ...(narrativeCoherence ? { narrativeCoherence } : {}),
      ...(audienceCoherence ? { audienceCoherence } : {}),
      ...(brandCoherence ? { brandCoherence } : {}),
    },
    issues: evidenceAnchors.issues,
  };
}
