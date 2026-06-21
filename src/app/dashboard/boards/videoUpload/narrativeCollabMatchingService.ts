/**
 * narrativeCollabMatchingService.ts
 *
 * Fase C — matching de collab baseado em narrativa, sem dependência de Instagram.
 *
 * Algoritmo:
 *   1. Busca criadores com narrativa E territórios confirmados no CreatorMapConfirmations
 *   2. Exclui o viewer
 *   3. Para cada candidato: busca seu diagnóstico mais recente (publishIntent="yes" ou completed)
 *   4. Usa videoReading.mainNarrative + videoReading.title como "narrative example"
 *   5. Gera a razão de fit com Gemini (1 frase, ≤ 120 chars)
 *   6. Retorna até `limit` matches
 *
 * Limitações do V1:
 *   - Sem scoring sofisticado de complementaridade — pega os primeiros candidatos elegíveis
 *   - Sem cache persistente — cache no cliente (collabSuggestionsCacheRef no shell)
 *   - Fit reason gerado on-demand por Gemini
 */

import { Types } from "mongoose";
import { GoogleGenAI, createUserContent } from "@google/genai";
import { connectToDatabase } from "@/app/lib/mongoose";
import { rankByComplementarity, findSharedLabel, findDistinctLabels } from "./collabComplementarity";
import { logGeminiUsage } from "@/app/lib/llm/geminiUsageLog";

// Configurável por env (GEMINI_COLLAB_MODEL) para A/B de modelo — candidato a
// gemini-2.5-flash-lite. Default idêntico ao histórico.
const GEMINI_MODEL = process.env.GEMINI_COLLAB_MODEL || "gemini-2.5-flash";
const CANDIDATE_POOL_SIZE = 30; // Pool amplo p/ o matcher por-pauta dedupar por território

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NarrativeCollabMatch {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  mediaKitSlug: string | null;
  /** Exemplo narrativo: "[título do vídeo] — [resumo em 1 frase]" */
  narrativeExample: string;
  /** Narrativa central do criador sugerido */
  suggestedNarrativeLabel: string;
  /** Razão de fit gerada por Gemini */
  narrativeFitReason: string;
  /** Como o conteúdo seria gravado a dois (1 frase). Opcional — só no fluxo por-pauta. */
  collabRecordingIdea?: string | null;
  /** Ponto de encontro: território confirmado do viewer que o candidato também toca. */
  sharedSignal: string | null;
  /** Territórios DELE que o viewer não tem — o ângulo novo que a collab traz. */
  distinctSignals: string[];
  narrativeMatch: true;
}

export interface NarrativeCollabMatchingResult {
  ok: boolean;
  matches: NarrativeCollabMatch[];
  reason?: "no_viewer_map" | "no_candidates" | "gemini_failed" | "db_error";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readApiKey(): string | null {
  return (
    process.env.GOOGLE_GEMINI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    null
  );
}

/**
 * Gera a razão de fit narrativo entre duas narrativas em 1 frase curta.
 * Non-fatal: retorna fallback se Gemini falhar.
 */
async function generateNarrativeFitReason(
  viewerNarrative: string,
  candidateNarrative: string,
  viewerTerritoryLabels: string[] = [],
): Promise<string> {
  const apiKey = readApiKey();
  if (!apiKey) return `Narrativa compatível com o seu mapa.`;

  const territoriesLine = viewerTerritoryLabels.length > 0
    ? `\nTerritórios confirmados do Criador A: ${viewerTerritoryLabels.slice(0, 4).join(", ")}`
    : "";

  const prompt = `\
Você é o companheiro narrativo da Data2Content.
Em 1 frase curta (máximo 110 caracteres), explique por que estas duas narrativas fazem sentido como collab.
Foque em como elas se COMPLEMENTAM — não copiam, mas se somam. Tom calmo e específico.
Nunca use: "engajamento", "alcance", "algoritmo", "seguidores", "performance", "audiência".

Criador A (perfil base): "${viewerNarrative}"${territoriesLine}
Criador B (sugestão): "${candidateNarrative}"

Responda apenas com a frase, sem pontuação no final.`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: createUserContent([prompt]),
      config: { maxOutputTokens: 80, temperature: 0.6 },
    });
    logGeminiUsage("collab", GEMINI_MODEL, response);
    const text = response.text?.trim();
    if (text && text.length > 5) return text;
  } catch {
    // Non-fatal
  }

  return `Narrativa complementar ao seu mapa confirmado.`;
}

/**
 * Constrói o texto do narrative example a partir do diagnóstico do candidato.
 * Formato: "[título do vídeo] — [primeiros 80 chars do summary]"
 */
function buildNarrativeExample(reading: {
  videoReading: { title: string; summary: string; mainNarrative: string };
}): string {
  const title = reading.videoReading.title?.trim() ?? "";
  const summary = reading.videoReading.summary?.trim() ?? "";

  if (!title && !summary) return "Conteúdo narrativo deste criador.";

  if (title && summary) {
    const shortSummary = summary.length > 80 ? summary.slice(0, 80).trimEnd() + "…" : summary;
    return `"${title}" — ${shortSummary}`;
  }

  return title || summary;
}

// ─── Pool de candidatos (fan-out ao Mongo, compartilhável) ─────────────────────

export interface EligibleCandidate {
  userId: string;
  user: {
    _id: Types.ObjectId;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    mediaKitSlug?: string | null;
  };
  reading: {
    userId: Types.ObjectId;
    videoReading: { title: string; summary: string; mainNarrative: string };
    publishIntent: "yes" | "no" | null;
  };
}

export interface NarrativeCandidatePool {
  pool: EligibleCandidate[];
  /** Territórios confirmados de cada candidato (por userId) — "o que ela traz de novo". */
  candidateTerritoriesById: Map<string, string[]>;
}

/**
 * Busca UMA vez todos os candidatos elegíveis a collab e seus territórios. Caro
 * (várias queries Mongo); por isso é compartilhado entre o matcher single-shot e
 * o matcher por-pauta (que ranqueia o mesmo pool N vezes).
 *
 * Fonte do pool = **MapaSeed** (a base viva de criadores: narrativa + territórios
 * vindos de onboarding/Instagram/vídeo). O caminho antigo (CreatorMapConfirmations
 * confirmado + diagnóstico de vídeo) cobria quase ninguém real — a base de mapas
 * confirmados estava vazia/órfã. Quando o candidato TAMBÉM tem leitura de vídeo
 * completa, ela enriquece o exemplo narrativo; senão, sintetizamos do MapaSeed.
 *
 * Retorna `null` em erro de DB; pool vazio quando não há candidatos.
 */
export async function buildNarrativeCandidatePool(
  viewerUserId: string,
): Promise<NarrativeCandidatePool | null> {
  if (!viewerUserId || !Types.ObjectId.isValid(viewerUserId)) return null;

  try {
    await connectToDatabase();

    const { default: MapaSeed } = await import("@/app/models/MapaSeed");
    const seeds = await MapaSeed.find({
      "mapa.narrativa_central": { $exists: true, $ne: "" },
      userId: { $ne: new Types.ObjectId(viewerUserId) },
    })
      .select("userId mapa.narrativa_central mapa.territorios mapa.temas")
      .limit(CANDIDATE_POOL_SIZE)
      .lean<Array<{ userId: Types.ObjectId; mapa: { narrativa_central?: string; territorios?: string[]; temas?: string[] } }>>();

    if (seeds.length === 0) return { pool: [], candidateTerritoriesById: new Map() };

    const candidateIds = seeds.map((s) => s.userId);

    const { default: UserModel } = await import("@/app/models/User");
    const { default: CreatorVideoNarrativeDiagnosis } = await import(
      "@/app/models/CreatorVideoNarrativeDiagnosis"
    );

    const users = await UserModel.find({ _id: { $in: candidateIds } })
      .select("_id name email image mediaKitSlug")
      .lean<Array<EligibleCandidate["user"]>>();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    // Leitura de vídeo é OPCIONAL agora — só enriquece o exemplo quando existe.
    const bestReadings = await CreatorVideoNarrativeDiagnosis.aggregate<EligibleCandidate["reading"]>([
      {
        $match: {
          userId: { $in: candidateIds },
          status: "completed",
          $or: [{ publishIntent: "yes" }, { publishIntent: null }],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$userId",
          userId: { $first: "$userId" },
          videoReading: { $first: "$videoReading" },
          publishIntent: { $first: "$publishIntent" },
        },
      },
    ]);
    const readingMap = new Map(bestReadings.map((r) => [r.userId.toString(), r]));

    const pool: EligibleCandidate[] = [];
    const candidateTerritoriesById = new Map<string, string[]>();
    for (const seed of seeds) {
      const userId = seed.userId.toString();
      const user = userMap.get(userId);
      if (!user) continue; // precisa de User real (nome/avatar/mídia kit)

      const narrativa = seed.mapa?.narrativa_central?.trim() ?? "";
      if (!narrativa) continue;

      const territorios = Array.isArray(seed.mapa?.territorios)
        ? seed.mapa.territorios.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        : [];
      if (territorios.length === 0) continue; // sem território não casa por-pauta

      candidateTerritoriesById.set(userId, territorios);

      // Vídeo enriquece; sem ele, sintetiza a "reading" a partir do MapaSeed.
      const videoReading = readingMap.get(userId);
      const reading: EligibleCandidate["reading"] = videoReading ?? {
        userId: seed.userId,
        videoReading: {
          title: "",
          summary: (seed.mapa?.temas?.find((t) => typeof t === "string" && t.trim()) ?? narrativa),
          mainNarrative: narrativa,
        },
        publishIntent: null,
      };

      pool.push({ userId, user, reading });
    }

    return { pool, candidateTerritoriesById };
  } catch (err) {
    console.error("[narrativeCollabMatching] buildNarrativeCandidatePool erro:", err);
    return null;
  }
}

/**
 * Monta um NarrativeCollabMatch a partir de um candidato elegível. O fit reason é
 * INJETADO (o chamador decide se vem do Gemini ou de um fallback barato), para que
 * o matcher por-pauta possa limitar chamadas Gemini.
 */
export function buildMatchFromCandidate(
  eligible: EligibleCandidate,
  viewerTerritoryLabels: string[],
  candidateTerritoriesById: Map<string, string[]>,
  narrativeFitReason: string,
  collabRecordingIdea?: string | null,
): NarrativeCollabMatch {
  const { user, reading } = eligible;
  const candidateNarrative = reading.videoReading.mainNarrative?.trim() ?? "";
  const handle = (user as any).username ?? (user as any).instagramUsername ?? null;
  const herTerritories = candidateTerritoriesById.get(user._id.toString()) ?? [];

  return {
    id: user._id.toString(),
    name: user.name ?? "Criador",
    username: typeof handle === "string" ? handle : null,
    avatarUrl: user.image ?? null,
    mediaKitSlug: user.mediaKitSlug ?? null,
    narrativeExample: buildNarrativeExample(reading),
    suggestedNarrativeLabel: candidateNarrative,
    narrativeFitReason,
    collabRecordingIdea: collabRecordingIdea ?? null,
    sharedSignal: findSharedLabel(viewerTerritoryLabels, candidateNarrative),
    distinctSignals: findDistinctLabels(viewerTerritoryLabels, herTerritories, 3),
    narrativeMatch: true,
  };
}

/**
 * Gera, numa única chamada Gemini, a razão de fit E uma ideia curta de como o
 * conteúdo seria gravado a dois. Usado no fluxo por-pauta (alimenta o modal da
 * pauta). Non-fatal: cai no fallback recebido se o Gemini falhar.
 */
export async function generateCollabContext(
  viewerNarrative: string,
  candidateNarrative: string,
  territoryLabel: string,
  fallbackFitReason: string,
): Promise<{ fitReason: string; recordingIdea: string | null }> {
  const apiKey = readApiKey();
  if (!apiKey) return { fitReason: fallbackFitReason, recordingIdea: null };

  const territoriesLine = territoryLabel
    ? `\nTerritório da pauta: ${territoryLabel}`
    : "";

  const prompt = `\
Você é o companheiro narrativo da Data2Content.
Duas criadoras com narrativas compatíveis vão postar juntas (collab). Responda em JSON:
{
  "fitReason": "1 frase curta (máx 110 caracteres) — por que estas narrativas se COMPLEMENTAM como collab",
  "recordingIdea": "1 frase curta (máx 130 caracteres) — como elas gravariam esse conteúdo JUNTAS, de forma concreta e prática"
}
Tom calmo e específico. Nunca use: "engajamento", "alcance", "algoritmo", "seguidores", "performance", "audiência".

Criador A (perfil base): "${viewerNarrative}"${territoriesLine}
Criador B (sugestão): "${candidateNarrative}"

Responda apenas com o JSON, sem cercas de código.`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: createUserContent([prompt]),
      config: { maxOutputTokens: 160, temperature: 0.6, responseMimeType: "application/json" },
    });
    logGeminiUsage("collab", GEMINI_MODEL, response);
    const text = response.text?.trim();
    if (text) {
      const parsed = JSON.parse(text) as { fitReason?: unknown; recordingIdea?: unknown };
      const fitReason = typeof parsed.fitReason === "string" && parsed.fitReason.trim().length > 5
        ? parsed.fitReason.trim()
        : fallbackFitReason;
      const recordingIdea = typeof parsed.recordingIdea === "string" && parsed.recordingIdea.trim().length > 5
        ? parsed.recordingIdea.trim()
        : null;
      return { fitReason, recordingIdea };
    }
  } catch {
    // Non-fatal
  }

  return { fitReason: fallbackFitReason, recordingIdea: null };
}

export { generateNarrativeFitReason };

// ─── Atribuição semântica por território (1 chamada Gemini para todo o lote) ────

export interface CollabCandidateForLLM {
  id: string;
  name: string;
  narrative: string;
  territories: string[];
}

export interface CollabAssignment {
  /** id do candidato escolhido, ou null se nenhum tem laço real com o território. */
  candidateId: string | null;
  fitReason: string;
  recordingIdea: string | null;
}

/**
 * Numa ÚNICA chamada Gemini, atribui a cada território de pauta o criador cujo
 * mapa permite uma collab LEGÍTIMA sobre aquele tema — e já devolve a razão de
 * fit + a ideia de gravação. Semântico (pega "empreendedorismo" ↔ "Negócios"),
 * mas instruído a retornar null quando não há laço real (coerência > cobertura).
 *
 * Retorna Map<territórioNormalizado, CollabAssignment>. Non-fatal: em falta de
 * chave/erro/JSON inválido devolve Map vazio → o chamador cai no determinístico.
 * Guarda contra alucinação: o chamador valida que o candidateId existe no pool.
 */
export async function assignCollabsByTerritory(params: {
  viewerNarrative: string;
  territories: string[];
  candidates: CollabCandidateForLLM[];
}): Promise<Map<string, CollabAssignment>> {
  const out = new Map<string, CollabAssignment>();
  const { viewerNarrative, territories, candidates } = params;
  if (territories.length === 0 || candidates.length === 0) return out;

  const apiKey = readApiKey();
  if (!apiKey) return out;

  const prompt = `\
Você é o estrategista de collabs da Data2Content.
Para CADA território de pauta abaixo, escolha o ÚNICO criador cujo mapa permite uma collab LEGÍTIMA sobre aquele tema — alguém que genuinamente já vive/fala daquilo. Entenda o SENTIDO (ex.: "empreendedorismo" combina com "Negócios criativos"), não só a palavra igual.
Se NENHUM criador tem ligação real com o território, devolva candidateId null — é melhor não sugerir do que forçar uma collab que não faz sentido.
Evite repetir o mesmo criador em territórios diferentes, a menos que ele seja claramente o único que faz sentido.
Tom calmo e específico. Nunca use: "engajamento", "alcance", "algoritmo", "seguidores", "performance", "audiência".

Criador base (perfil do viewer): "${viewerNarrative}"

Territórios de pauta:
${territories.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Criadores disponíveis:
${candidates.map((c) => `[${c.id}] ${c.name} — narrativa: "${c.narrative}" — territórios: ${c.territories.join(", ")}`).join("\n")}

Responda APENAS com JSON, sem cercas de código:
{
  "assignments": [
    {
      "territory": "<texto EXATO do território da lista>",
      "candidateId": "<id entre colchetes, ou null>",
      "fitReason": "<1 frase ≤110 chars: por que combinam como collab nesse território>",
      "recordingIdea": "<1 frase ≤130 chars: como gravariam esse conteúdo juntos, concreto>"
    }
  ]
}`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: createUserContent([prompt]),
      // thinkingBudget 0: o "pensamento" do 2.5-flash consome maxOutputTokens e
      // truncava o JSON (finishReason MAX_TOKENS). Desligado + budget folgado.
      config: {
        maxOutputTokens: 1536,
        temperature: 0.5,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    logGeminiUsage("collab", GEMINI_MODEL, response);
    const text = response.text?.trim();
    if (!text) return out;

    const parsed = JSON.parse(text) as { assignments?: Array<Record<string, unknown>> };
    if (!Array.isArray(parsed?.assignments)) return out;

    for (const a of parsed.assignments) {
      const territory = typeof a.territory === "string" ? a.territory.trim() : "";
      if (!territory) continue;
      const candidateId = typeof a.candidateId === "string" && a.candidateId.trim() ? a.candidateId.trim() : null;
      const fitReason = typeof a.fitReason === "string" && a.fitReason.trim().length > 5 ? a.fitReason.trim() : "";
      const recordingIdea = typeof a.recordingIdea === "string" && a.recordingIdea.trim().length > 5 ? a.recordingIdea.trim() : null;
      out.set(territory.toLowerCase(), { candidateId, fitReason, recordingIdea });
    }
  } catch {
    // Non-fatal → o chamador usa o ranking determinístico.
  }

  return out;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Encontra criadores com mapa narrativo confirmado e compatível com o viewer.
 *
 * @param viewerUserId — userId do criador que está visualizando
 * @param viewerNarrativeLabel — narrativa central confirmada do viewer (para gerar fit reason)
 * @param limit — máximo de matches a retornar (padrão 1 para V1)
 */
export async function findNarrativeCollabMatches(
  viewerUserId: string,
  viewerNarrativeLabel: string,
  limit = 1,
  viewerTerritoryLabels: string[] = [],
): Promise<NarrativeCollabMatchingResult> {
  const poolResult = await buildNarrativeCandidatePool(viewerUserId);
  if (!poolResult) return { ok: false, matches: [], reason: "db_error" };
  if (poolResult.pool.length === 0) return { ok: true, matches: [], reason: "no_candidates" };

  try {
    // Ranking por COMPLEMENTARIDADE narrativa (determinístico; o Gemini só entra na razão de fit).
    const ranked = rankByComplementarity(
      [viewerNarrativeLabel, ...viewerTerritoryLabels],
      poolResult.pool,
      (e) => e.reading.videoReading.mainNarrative ?? "",
    );

    const selected = ranked.slice(0, limit);
    const matches: NarrativeCollabMatch[] = [];

    for (const eligible of selected) {
      const candidateNarrative = eligible.reading.videoReading.mainNarrative?.trim() ?? "";
      const narrativeFitReason = await generateNarrativeFitReason(
        viewerNarrativeLabel,
        candidateNarrative || "conteúdo criativo",
        viewerTerritoryLabels,
      );
      matches.push(
        buildMatchFromCandidate(eligible, viewerTerritoryLabels, poolResult.candidateTerritoriesById, narrativeFitReason),
      );
    }

    return { ok: true, matches };
  } catch (err) {
    console.error("[narrativeCollabMatching] Erro:", err);
    return { ok: false, matches: [], reason: "db_error" };
  }
}
