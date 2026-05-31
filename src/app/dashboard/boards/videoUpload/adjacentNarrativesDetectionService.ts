/**
 * adjacentNarrativesDetectionService.ts
 *
 * Detects 2-3 adjacent narrative candidates from the creator's confirmed map
 * + reading history using Gemini.
 *
 * Adjacent narrative = a narrative angle (not a topic/territory) that extends
 * from the creator's confirmed central narrative. It answers:
 * "Another way this creator could look through the same identity lens."
 *
 * Prerequisites: narrative confirmed + territories confirmed + ≥3 readings.
 */

import { GoogleGenAI, createUserContent } from "@google/genai";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface AdjacentNarrativeCandidate {
  label: string;
  /** 1–2 sentence rationale connecting it to the confirmed narrative. */
  rationale: string;
}

export interface DetectAdjacentNarrativesResult {
  ok: boolean;
  candidates?: AdjacentNarrativeCandidate[];
  errorCode?: "missing_api_key" | "gemini_call_failed" | "invalid_response" | "prerequisites_not_met";
  message?: string;
}

export interface DetectAdjacentNarrativesParams {
  /** Creator's confirmed central narrative label + summary */
  mainNarrative: { label: string; summary: string };
  /** Creator's confirmed territories */
  territories: Array<{ label: string }>;
  /** Creator's confirmed tone (optional) */
  tone: string | null;
  /** Already-existing adjacent narrative labels (to avoid re-proposing) */
  existingAdjacentLabels: string[];
  /** Number of analyzed readings (must be >= 3) */
  analyzedReadingsCount: number;
  /** Recent reading summaries / themes to inform detection */
  readingSignals: Array<{
    title: string | null;
    themes: string[];
    narrativeContribution?: string | null;
  }>;
}

// ─── Implementation ───────────────────────────────────────────────────────────

const MODEL = "gemini-2.0-flash";
const MIN_READINGS = 3;
const MAX_CANDIDATES = 3;

function readApiKey(): string | null {
  return (
    process.env.GOOGLE_GEMINI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    null
  );
}

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      minItems: 1,
      maxItems: MAX_CANDIDATES,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "rationale"],
        properties: {
          label: { type: "string", maxLength: 80 },
          rationale: { type: "string", maxLength: 280 },
        },
      },
    },
  },
};

export async function detectAdjacentNarratives(
  params: DetectAdjacentNarrativesParams,
): Promise<DetectAdjacentNarrativesResult> {
  const { mainNarrative, territories, tone, existingAdjacentLabels, analyzedReadingsCount, readingSignals } =
    params;

  if (analyzedReadingsCount < MIN_READINGS) {
    return {
      ok: false,
      errorCode: "prerequisites_not_met",
      message: `Mínimo de ${MIN_READINGS} leituras necessárias (atual: ${analyzedReadingsCount}).`,
    };
  }

  const apiKey = readApiKey();
  if (!apiKey) {
    return { ok: false, errorCode: "missing_api_key", message: "GEMINI_API_KEY não configurada." };
  }

  const existingBlock =
    existingAdjacentLabels.length > 0
      ? `\nNÃO proponha estes (já existem ou foram descartados):\n${existingAdjacentLabels.map((l) => `  - ${l}`).join("\n")}`
      : "";

  const readingSignalsBlock =
    readingSignals.length > 0
      ? `\nSinais das últimas leituras (temas recorrentes):\n${readingSignals
          .slice(0, 8)
          .map((r) => {
            const themes = r.themes.length > 0 ? `temas: ${r.themes.join(", ")}` : "";
            const contrib = r.narrativeContribution ? `contribuição: ${r.narrativeContribution}` : "";
            const title = r.title ? `título: ${r.title}` : "";
            return `  - ${[title, themes, contrib].filter(Boolean).join(" | ")}`;
          })
          .join("\n")}`
      : "";

  const systemInstruction = [
    "Você é um analista de narrativa para a plataforma Data2Content.",
    "Seu trabalho é identificar EXTENSÕES da narrativa central de um criador — não novos tópicos, mas outros ângulos de olhar pela mesma identidade.",
    "",
    "Diferença crítica:",
    "  - Território = assunto que o criador ocupa (ex: 'produtividade', 'maternidade')",
    "  - Narrativa adjacente = OUTRO modo de enxergar através da mesma identidade (ex: se a narrativa é 'quem constrói devagar e com intenção', uma adjacente pode ser 'quem aprende em público')",
    "",
    "Regras:",
    "1. Cada candidata deve ser um ÂNGULO narrativo, não um tema ou território.",
    "2. A candidata deve emergir naturalmente dos sinais de leitura — não invente.",
    "3. A label deve soar como um traço de identidade, não um título de vídeo.",
    "4. Use linguagem espelhada — o criador deve se reconhecer.",
    "5. NUNCA use: algoritmo, viralizar, engajamento, tendência, crescimento, seguidores.",
    "6. Gere entre 1 e 3 candidatas — só proponha se houver sinal real.",
  ].join("\n");

  const userInstruction = [
    `Narrativa central confirmada: ${mainNarrative.label}`,
    mainNarrative.summary ? `  ${mainNarrative.summary}` : "",
    "",
    `Territórios confirmados: ${territories.map((t) => t.label).join(", ")}`,
    tone ? `Tom confirmado: ${tone}` : "",
    readingSignalsBlock,
    existingBlock,
    "",
    `Tarefa: identifique ${MAX_CANDIDATES > 1 ? `entre 1 e ${MAX_CANDIDATES}` : "1"} narrativa(s) adjacente(s) à narrativa central.`,
    "Cada uma deve ser um ângulo de identidade diferente — como o mesmo criador pode olhar para o mundo de outro ponto de vista sem perder quem é.",
    "",
    "Responda em JSON estrito conforme o schema.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const genAI = new GoogleGenAI({ apiKey });
    const response = await genAI.models.generateContent({
      model: MODEL,
      contents: createUserContent([{ text: userInstruction }]),
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.4,
      },
    });

    const raw = response.text?.trim() ?? "";
    let parsed: { candidates: AdjacentNarrativeCandidate[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("[adjacentNarrativesDetection] JSON parse failed:", raw.slice(0, 300));
      return { ok: false, errorCode: "invalid_response", message: "Resposta inválida do modelo." };
    }

    if (!Array.isArray(parsed?.candidates) || parsed.candidates.length === 0) {
      return { ok: false, errorCode: "invalid_response", message: "Sem candidatas retornadas." };
    }

    const candidates = parsed.candidates
      .filter((c) => typeof c.label === "string" && c.label.trim().length > 0)
      .slice(0, MAX_CANDIDATES);

    return { ok: true, candidates };
  } catch (err) {
    console.error("[adjacentNarrativesDetection] Gemini call failed:", err);
    return { ok: false, errorCode: "gemini_call_failed", message: "Erro ao chamar o modelo." };
  }
}
