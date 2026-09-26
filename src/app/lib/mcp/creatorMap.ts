// src/app/lib/mcp/creatorMap.ts
//
// O mapa narrativo do creator exposto ao MCP.
//
// Por que este módulo existe: dentro do aplicativo, território/narrativa/asset/
// tom vêm SEMPRE do card "Seu Mapa" — o mapa é o dicionário. Até aqui o MCP não
// lia o MapaSeed para responder ao próprio creator (só para casar collabs), e as
// respostas no Claude/ChatGPT eram montadas a partir de categoria de
// classificação. Este módulo fecha essa diferença.
//
// Acesso: o mapa seed é visível para qualquer conta que tenha mapa — é a mesma
// regra de `evaluateMapaAccess` (`podeVerMapa = temMapa`). Pautas, essas sim,
// são Pro. Ver `src/app/lib/mapaSeed/mapaAccessGuard.ts`.

import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import CreatorMapConfirmationsModel from "@/app/models/CreatorMapConfirmations";
import MapaSeedModel from "@/app/models/MapaSeed";

export const MCP_CREATOR_MAP_SCHEMA_VERSION = "creator_map_v1";

/** Quanta evidência sustenta a leitura, na ordem em que o mapa amadurece. */
export type McpCreatorMapEvidenceLevel = "declared" | "one_reading" | "two_readings";

/** O que o creator respondeu no card "Seu Mapa" sobre cada dimensão. */
export type McpMapConfirmationState = "pending" | "confirmed" | "dismissed";

export interface McpCreatorMap {
  schemaVersion: typeof MCP_CREATOR_MAP_SCHEMA_VERSION;
  hasMap: boolean;
  narrative: string | null;
  territories: string[];
  themes: string[];
  adjacentNarratives: string[];
  assets: string[];
  tone: string | null;
  formats: string[];
  maturity: string;
  sources: string[];
  evidenceLevel: McpCreatorMapEvidenceLevel;
  narrativeIsFirm: boolean;
  narrativeConfirmedByCreator: boolean;
  confirmations: {
    narrative: McpMapConfirmationState;
    territories: McpMapConfirmationState;
    tone: McpMapConfirmationState;
  };
  confirmedAssets: string[];
  /** O que o creator recusou no card. Serve para não voltar a sugerir, nunca como dicionário. */
  rejectedByCreator: {
    narrative: string | null;
    territories: string[];
    tone: string | null;
    assets: string[];
    adjacentNarratives: string[];
  };
  updatedAt: string | null;
  vocabulary: Record<string, string>;
  usage: string[];
  warnings: string[];
}

/** Forma mínima de `CreatorMapConfirmations` que o MCP precisa ler. */
export interface McpMapConfirmationsInput {
  narrative?: { state?: string | null; confirmedValue?: string | null } | null;
  territories?: { state?: string | null; confirmedValue?: string | null } | null;
  tone?: { state?: string | null; confirmedValue?: string | null } | null;
  assets?: Array<{ label?: string | null; state?: string | null }> | null;
  adjacentNarratives?: Array<{ label?: string | null; state?: string | null }> | null;
}

type AnyRecord = Record<string, unknown>;

function cleanStrings(value: unknown, limit = 24): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= limit) break;
  }
  return out;
}

function cleanText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Uma leitura de Instagram OU de vídeo já é evidência; as duas juntas tornam a
 * narrativa firme. Sem nenhuma delas, o que existe é a declaração do creator —
 * ponto de partida legítimo, mas não diagnóstico.
 */
export function resolveEvidenceLevel(maturity: string, sources: string[]): McpCreatorMapEvidenceLevel {
  const readings = new Set<string>();
  for (const source of sources) {
    const normalized = source.toLowerCase();
    if (normalized.includes("instagram")) readings.add("instagram");
    if (normalized.includes("video") || normalized.includes("vídeo")) readings.add("video");
  }
  if (maturity === "instagram_enriched") readings.add("instagram");
  if (maturity === "video_enriched") readings.add("video");
  if (readings.size >= 2) return "two_readings";
  if (readings.size === 1) return "one_reading";
  return "declared";
}

/**
 * O vocabulário viaja junto com o dado. Sem isso, o modelo trata "humor" como
 * território e credencial como asset — e a resposta deixa de ser Data2Content.
 */
const MAP_VOCABULARY: Record<string, string> = {
  narrative:
    "Uma tensão ou uma missão — o que está em jogo na vida do creator. Não é nicho, não é bio, não é descrição.",
  territory:
    "Um substantivo: o assunto onde o creator vive. 'Humor' não é território; 'humor de casal' é, porque tem assunto embaixo.",
  asset:
    "Um elemento de vida do creator (a filha, a cozinha, o cachorro). Não é credencial, diploma nem prêmio.",
  theme: "Recortes recorrentes dentro dos territórios.",
  adjacentNarrative: "Direções vizinhas que o creator poderia ocupar sem deixar de ser ele.",
  tone: "Como o creator fala — não o que ele fala.",
};

const MAP_USAGE = [
  "Use este mapa como dicionário: ao falar de território, narrativa, asset ou tom, use os termos daqui em vez de inventar rótulo novo.",
  "Pauta nasce do cruzamento entre narrativa e território. Audiência sozinha não sustenta pauta.",
  "Quando evidenceLevel for 'declared' e narrativeConfirmedByCreator for false, trate a narrativa como ponto de partida declarado pelo creator, não como diagnóstico.",
  "Quando narrativeConfirmedByCreator for true, o próprio creator confirmou a narrativa no mapa: use-a como firme, dizendo que foi confirmada por ele.",
  "Nunca sugira o que está em rejectedByCreator: o creator recusou esses itens no próprio mapa.",
];

function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function asConfirmationState(value: unknown): McpMapConfirmationState {
  return value === "confirmed" || value === "dismissed" ? value : "pending";
}

/**
 * A resposta vale para a frase que o creator viu. Se o mapa mudou depois (nova
 * leitura trocou a narrativa), a confirmação antiga não fala da frase atual e a
 * dimensão volta a ser pendente. Confirmações antigas sem `confirmedValue` valem
 * como estão — é o mesmo tratamento do card.
 */
function resolveDimensionState(
  dimension: { state?: string | null; confirmedValue?: string | null } | null | undefined,
  currentValue: string | null,
): McpMapConfirmationState {
  const state = asConfirmationState(dimension?.state);
  if (state === "pending") return state;
  const confirmedValue = typeof dimension?.confirmedValue === "string" ? dimension.confirmedValue.trim() : "";
  if (!confirmedValue || !currentValue) return state;
  return normalizeLabel(confirmedValue) === normalizeLabel(currentValue) ? state : "pending";
}

function labelsWithState(
  items: Array<{ label?: string | null; state?: string | null }> | null | undefined,
  state: McpMapConfirmationState,
): Set<string> {
  return new Set(
    (items ?? [])
      .filter((item) => asConfirmationState(item?.state) === state && typeof item?.label === "string")
      .map((item) => normalizeLabel(item.label as string))
      .filter(Boolean),
  );
}

/**
 * Aplica ao mapa o que o creator respondeu no card "Seu Mapa". Recusa tem efeito:
 * o item sai do dicionário e vai para `rejectedByCreator`. Confirmação da
 * narrativa a torna firme mesmo sem duas leituras — regra do próprio produto.
 */
export function applyMcpMapConfirmations(
  map: McpCreatorMap,
  confirmations: McpMapConfirmationsInput | null,
): McpCreatorMap {
  if (!map.hasMap || !confirmations) return map;

  const narrativeState = resolveDimensionState(confirmations.narrative, map.narrative);
  const territoriesState = resolveDimensionState(
    confirmations.territories,
    map.territories.length ? map.territories.join(" | ") : null,
  );
  const toneState = resolveDimensionState(confirmations.tone, map.tone);
  const dismissedAssets = labelsWithState(confirmations.assets, "dismissed");
  const confirmedAssetKeys = labelsWithState(confirmations.assets, "confirmed");
  const dismissedAdjacent = labelsWithState(confirmations.adjacentNarratives, "dismissed");

  const narrative = narrativeState === "dismissed" ? null : map.narrative;
  const territories = territoriesState === "dismissed" ? [] : map.territories;
  const tone = toneState === "dismissed" ? null : map.tone;
  const assets = map.assets.filter((asset) => !dismissedAssets.has(normalizeLabel(asset)));
  const adjacentNarratives = map.adjacentNarratives.filter(
    (label) => !dismissedAdjacent.has(normalizeLabel(label)),
  );
  const narrativeConfirmedByCreator = Boolean(narrative) && narrativeState === "confirmed";

  const next: McpCreatorMap = {
    ...map,
    narrative,
    territories,
    tone,
    assets,
    adjacentNarratives,
    narrativeConfirmedByCreator,
    narrativeIsFirm: Boolean(narrative) && (map.evidenceLevel === "two_readings" || narrativeConfirmedByCreator),
    confirmations: { narrative: narrativeState, territories: territoriesState, tone: toneState },
    confirmedAssets: assets.filter((asset) => confirmedAssetKeys.has(normalizeLabel(asset))),
    rejectedByCreator: {
      narrative: narrativeState === "dismissed" ? map.narrative : null,
      territories: territoriesState === "dismissed" ? map.territories : [],
      tone: toneState === "dismissed" ? map.tone : null,
      assets: map.assets.filter((asset) => dismissedAssets.has(normalizeLabel(asset))),
      adjacentNarratives: map.adjacentNarratives.filter((label) => dismissedAdjacent.has(normalizeLabel(label))),
    },
  };
  next.warnings = buildWarnings(next);
  return next;
}

function buildWarnings(map: McpCreatorMap): string[] {
  const warnings: string[] = [];
  if (map.rejectedByCreator.narrative) warnings.push("narrative_rejected_by_creator");
  else if (!map.narrative) warnings.push("narrative_missing");
  if (map.rejectedByCreator.territories.length) warnings.push("territories_rejected_by_creator");
  else if (map.territories.length === 0) warnings.push("territories_missing");
  if (map.rejectedByCreator.tone) warnings.push("tone_rejected_by_creator");
  else if (!map.tone) warnings.push("tone_not_established_yet");
  if (map.evidenceLevel === "declared") warnings.push("map_not_enriched_by_readings");
  if (map.narrative && !map.narrativeIsFirm) warnings.push("narrative_not_firm_yet");
  return warnings;
}

const EMPTY_CONFIRMATIONS: McpCreatorMap["confirmations"] = {
  narrative: "pending",
  territories: "pending",
  tone: "pending",
};

const EMPTY_REJECTIONS: McpCreatorMap["rejectedByCreator"] = {
  narrative: null,
  territories: [],
  tone: null,
  assets: [],
  adjacentNarratives: [],
};

/**
 * Carrega o mapa do próprio creator. Devolve `hasMap: false` — e não erro —
 * quando o creator ainda não tem mapa: ausência de mapa é estado normal do
 * começo da jornada, não falha.
 */
export async function loadMcpCreatorMap(userId: string): Promise<McpCreatorMap> {
  const empty: McpCreatorMap = {
    schemaVersion: MCP_CREATOR_MAP_SCHEMA_VERSION,
    hasMap: false,
    narrative: null,
    territories: [],
    themes: [],
    adjacentNarratives: [],
    assets: [],
    tone: null,
    formats: [],
    maturity: "none",
    sources: [],
    evidenceLevel: "declared",
    narrativeIsFirm: false,
    narrativeConfirmedByCreator: false,
    confirmations: EMPTY_CONFIRMATIONS,
    confirmedAssets: [],
    rejectedByCreator: EMPTY_REJECTIONS,
    updatedAt: null,
    vocabulary: MAP_VOCABULARY,
    usage: MAP_USAGE,
    warnings: ["creator_map_not_created_yet"],
  };

  if (!Types.ObjectId.isValid(userId)) return empty;
  await connectToDatabase();

  const userObjectId = new Types.ObjectId(userId);
  let confirmationsUnavailable = false;
  const [seed, confirmations] = await Promise.all([
    MapaSeedModel.findOne({ userId: userObjectId })
      .select(
        "mapa.narrativa_central mapa.territorios mapa.temas mapa.narrativas_adjacentes " +
          "mapa.assets mapa.tom mapa.formatos mapa.maturidade mapa.fonte updatedAt",
      )
      .lean<AnyRecord | null>(),
    CreatorMapConfirmationsModel.findOne({ userId: userObjectId })
      .select("narrative territories tone assets adjacentNarratives")
      .lean<McpMapConfirmationsInput | null>()
      .catch(() => {
        confirmationsUnavailable = true;
        return null;
      }),
  ]);

  const mapa = seed?.mapa as AnyRecord | undefined;
  if (!mapa) return empty;

  const maturity = cleanText(mapa.maturidade) ?? "seed";
  const sources = cleanStrings(mapa.fonte, 8);
  const evidenceLevel = resolveEvidenceLevel(maturity, sources);
  const narrative = cleanText(mapa.narrativa_central);

  const map: McpCreatorMap = {
    schemaVersion: MCP_CREATOR_MAP_SCHEMA_VERSION,
    hasMap: true,
    narrative,
    territories: cleanStrings(mapa.territorios),
    themes: cleanStrings(mapa.temas),
    adjacentNarratives: cleanStrings(mapa.narrativas_adjacentes, 8),
    assets: cleanStrings(mapa.assets),
    tone: cleanText(mapa.tom),
    formats: cleanStrings(mapa.formatos, 8),
    maturity,
    sources,
    evidenceLevel,
    narrativeIsFirm: Boolean(narrative) && evidenceLevel === "two_readings",
    narrativeConfirmedByCreator: false,
    confirmations: EMPTY_CONFIRMATIONS,
    confirmedAssets: [],
    rejectedByCreator: EMPTY_REJECTIONS,
    updatedAt:
      seed?.updatedAt instanceof Date ? (seed.updatedAt as Date).toISOString() : null,
    vocabulary: MAP_VOCABULARY,
    usage: MAP_USAGE,
    warnings: [],
  };
  map.warnings = buildWarnings(map);
  const withConfirmations = applyMcpMapConfirmations(map, confirmations);
  if (confirmationsUnavailable) {
    // Sem as respostas do creator, um item recusado pode reaparecer: avise.
    withConfirmations.warnings = [...withConfirmations.warnings, "creator_confirmations_unavailable"];
  }
  return withConfirmations;
}

/** Resumo curto do mapa para embutir em respostas maiores sem inflar o payload. */
export function summarizeMcpCreatorMap(map: McpCreatorMap) {
  return {
    hasMap: map.hasMap,
    narrative: map.narrative,
    territories: map.territories,
    assets: map.assets.slice(0, 8),
    tone: map.tone,
    evidenceLevel: map.evidenceLevel,
    narrativeIsFirm: map.narrativeIsFirm,
    narrativeConfirmedByCreator: map.narrativeConfirmedByCreator,
  };
}
