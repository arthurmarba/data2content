// src/app/lib/mapaSeed/generatePautasFromMapa.ts
// Gera pautas a partir do mapa narrativo do criador.
//
// Intensidade por maturidade:
//   seed               → gpt-4o · medium → 3 pautas simples e diretas
//   instagram_enriched → gpt-4o · high   → pautas conectadas a assets e territórios reais
//   video_enriched     → gpt-4o · high   → idem, com referência ao histórico de vídeo
//
// Saída: array de pautas compatíveis com ICreatorContentIdea (source: "gpt4o_v1")

import crypto from "node:crypto";
import { callClaudeJSON } from "@/app/lib/claudeService";
import { logger } from "@/app/lib/logger";
import type { IMapaData } from "@/app/models/MapaSeed";
import type { ClaudeIntensity } from "@/app/lib/claudeService";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface PautaGerada {
  title:           string;
  angle:           string;
  hook:            string;
  territory:       string;
  assets:          string[];
  suggestedFormat: string;
  tone:            string | null;
  whyItFits:       string;
  mapContextHash:  string;
  modelVersion:    string;
  generatedAt:     Date;
}

export interface GeneratePautasOptions {
  count?:           number;  // quantas pautas gerar (default: 3)
  focusTerritory?:  string;  // opcional: focar em um território específico
  focusFormat?:     string;  // opcional: focar em um formato específico
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveIntensity(maturidade: IMapaData["maturidade"]): ClaudeIntensity {
  return maturidade === "seed" ? "medium" : "high";
}

function hashMapContext(mapa: IMapaData): string {
  const snapshot = JSON.stringify({
    narrativa_central: mapa.narrativa_central,
    territorios:       mapa.territorios,
    tom:               mapa.tom,
    maturidade:        mapa.maturidade,
  });
  return crypto.createHash("sha256").update(snapshot).digest("hex").slice(0, 16);
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(mapa: IMapaData, opts: GeneratePautasOptions): string {
  const count = opts.count ?? 3;
  const territorioFoco = opts.focusTerritory
    ? `\nFoque especialmente no território: "${opts.focusTerritory}"`
    : "";
  const formatoFoco = opts.focusFormat
    ? `\nPrefira o formato: "${opts.focusFormat}"`
    : "";

  const contextoPorMaturidade =
    mapa.maturidade === "seed"
      ? "O mapa ainda está em formação — baseie-se no que o criador declarou sobre si mesmo."
      : "O mapa foi enriquecido com conteúdo real — conecte as pautas a assets e territórios confirmados.";

  return `Você é um gerador de pautas narrativas para criadores de conteúdo.

Sua tarefa: gerar ${count} pautas a partir do mapa do criador.
Cada pauta deve surgir do mapa — não de tendências genéricas ou do que "funciona no algoritmo".

Mapa do criador:
${JSON.stringify(
  {
    narrativa_central:     mapa.narrativa_central,
    territorios:           mapa.territorios,
    narrativas_adjacentes: mapa.narrativas_adjacentes,
    assets:                mapa.assets,
    tom:                   mapa.tom,
    formatos:              mapa.formatos,
  },
  null,
  2
)}

Contexto de maturidade: ${contextoPorMaturidade}
${territorioFoco}${formatoFoco}

Para cada pauta, gere:
- title: título direto (máx. 80 chars). Concreto, no tom do criador. Sem clickbait.
- angle: por que este ângulo é específico para ESTE criador (1-2 frases, máx. 120 chars).
- hook: abertura do vídeo — primeira frase que prende (máx. 100 chars).
- territory: qual território do mapa esta pauta ocupa (string do mapa, não invente).
- assets: quais assets do mapa aparecem nesta pauta (lista, pode ser vazia []).
- suggestedFormat: formato mais adequado entre os que o criador usa.
- tone: como esta pauta deve soar (espelhe o tom do mapa, 1 frase curta ou null).
- whyItFits: por que esta pauta faz sentido para o mapa deste criador (1-2 frases).

Regras:
- Não use: "viral", "engajamento", "algoritmo", "crescimento", "dicas de".
- Não force um nicho. Respeite a identidade que pode abranger múltiplos territórios.
- Se o mapa for vago, gere pautas mais abertas — não invente especificidade.
- As ${count} pautas devem cobrir territórios diferentes (não repetir o mesmo assunto).

Retorne apenas JSON válido com um array de ${count} objetos.
Sem explicação adicional.

Formato esperado:
[
  {
    "title": "string",
    "angle": "string",
    "hook": "string",
    "territory": "string",
    "assets": ["string"],
    "suggestedFormat": "string",
    "tone": "string | null",
    "whyItFits": "string"
  }
]`;
}

// ─── Função principal ─────────────────────────────────────────────────────────

export async function generatePautasFromMapa(
  mapa: IMapaData,
  opts: GeneratePautasOptions = {}
): Promise<PautaGerada[]> {
  const TAG = "[mapaSeed][generatePautasFromMapa]";
  const count = Math.min(opts.count ?? 3, 6);
  const intensity = resolveIntensity(mapa.maturidade);
  const mapContextHash = hashMapContext(mapa);
  const generatedAt = new Date();

  logger.info(
    `${TAG} Gerando ${count} pautas | maturidade=${mapa.maturidade} | intensity=${intensity}`
  );

  type RawPauta = Omit<PautaGerada, "mapContextHash" | "modelVersion" | "generatedAt">;

  const raw = await callClaudeJSON<RawPauta[]>(
    buildPrompt(mapa, { ...opts, count }),
    {
      intensity,
      maxTokens: 2048,
    }
  );

  if (!Array.isArray(raw) || raw.length === 0) {
    logger.error(`${TAG} Resposta inválida — não é array ou está vazia.`);
    throw new Error("Geração de pautas retornou resultado inválido.");
  }

  const modelVersion = `gpt4o_v1_${mapa.maturidade}`;

  const pautas: PautaGerada[] = raw
    .filter((p) => p.title && p.angle && p.hook && p.territory)
    .slice(0, count)
    .map((p) => ({
      title:           p.title,
      angle:           p.angle,
      hook:            p.hook,
      territory:       p.territory,
      assets:          Array.isArray(p.assets) ? p.assets : [],
      suggestedFormat: p.suggestedFormat ?? mapa.formatos[0] ?? "Reels",
      tone:            p.tone ?? null,
      whyItFits:       p.whyItFits ?? "",
      mapContextHash,
      modelVersion,
      generatedAt,
    }));

  logger.info(`${TAG} ${pautas.length} pautas geradas com sucesso.`);
  return pautas;
}
