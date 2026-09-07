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
import MapaSeedModel from "@/app/models/MapaSeed";

export const MCP_CREATOR_MAP_SCHEMA_VERSION = "creator_map_v1";

/** Quanta evidência sustenta a leitura, na ordem em que o mapa amadurece. */
export type McpCreatorMapEvidenceLevel = "declared" | "one_reading" | "two_readings";

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
  updatedAt: string | null;
  vocabulary: Record<string, string>;
  usage: string[];
  warnings: string[];
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
  "Quando evidenceLevel for 'declared', trate a narrativa como ponto de partida declarado pelo creator, não como diagnóstico.",
];

function buildWarnings(map: McpCreatorMap): string[] {
  const warnings: string[] = [];
  if (!map.narrative) warnings.push("narrative_missing");
  if (map.territories.length === 0) warnings.push("territories_missing");
  if (!map.tone) warnings.push("tone_not_established_yet");
  if (map.evidenceLevel === "declared") warnings.push("map_not_enriched_by_readings");
  if (!map.narrativeIsFirm) warnings.push("narrative_not_firm_yet");
  return warnings;
}

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
    updatedAt: null,
    vocabulary: MAP_VOCABULARY,
    usage: MAP_USAGE,
    warnings: ["creator_map_not_created_yet"],
  };

  if (!Types.ObjectId.isValid(userId)) return empty;
  await connectToDatabase();

  const seed = await MapaSeedModel.findOne({ userId: new Types.ObjectId(userId) })
    .select(
      "mapa.narrativa_central mapa.territorios mapa.temas mapa.narrativas_adjacentes " +
        "mapa.assets mapa.tom mapa.formatos mapa.maturidade mapa.fonte updatedAt",
    )
    .lean<AnyRecord | null>();

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
    updatedAt:
      seed?.updatedAt instanceof Date ? (seed.updatedAt as Date).toISOString() : null,
    vocabulary: MAP_VOCABULARY,
    usage: MAP_USAGE,
    warnings: [],
  };
  map.warnings = buildWarnings(map);
  return map;
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
  };
}
