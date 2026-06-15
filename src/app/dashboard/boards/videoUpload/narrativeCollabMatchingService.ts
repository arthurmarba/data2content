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

const GEMINI_MODEL = "gemini-2.5-flash";
const CANDIDATE_POOL_SIZE = 10; // Busca mais candidatos do que o limite para filtrar

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
 * Busca UMA vez todos os candidatos elegíveis (mapa confirmado + diagnóstico) e
 * seus territórios. Caro (várias queries Mongo); por isso é compartilhado entre o
 * matcher single-shot e o matcher por-pauta (que ranqueia o mesmo pool N vezes).
 * Retorna `null` em erro de DB; pool vazio quando não há candidatos.
 */
export async function buildNarrativeCandidatePool(
  viewerUserId: string,
): Promise<NarrativeCandidatePool | null> {
  if (!viewerUserId || !Types.ObjectId.isValid(viewerUserId)) return null;

  try {
    await connectToDatabase();

    const { default: CreatorMapConfirmations } = await import("@/app/models/CreatorMapConfirmations");
    const candidates = await CreatorMapConfirmations.find({
      "narrative.state": "confirmed",
      "territories.state": "confirmed",
      userId: { $ne: new Types.ObjectId(viewerUserId) },
    })
      .select("userId")
      .limit(CANDIDATE_POOL_SIZE)
      .lean<Array<{ userId: Types.ObjectId }>>();

    if (candidates.length === 0) return { pool: [], candidateTerritoriesById: new Map() };

    const candidateIds = candidates.map((c) => c.userId);

    const { default: UserModel } = await import("@/app/models/User");
    const { default: CreatorVideoNarrativeDiagnosis } = await import(
      "@/app/models/CreatorVideoNarrativeDiagnosis"
    );

    const users = await UserModel.find({ _id: { $in: candidateIds } })
      .select("_id name email image mediaKitSlug")
      .lean<Array<EligibleCandidate["user"]>>();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

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
    for (const candidate of candidates) {
      const userId = candidate.userId.toString();
      const user = userMap.get(userId);
      const reading = readingMap.get(userId);
      if (user && reading) pool.push({ userId, user, reading });
    }

    // Territórios confirmados de TODOS os elegíveis (barato — ≤10 ids).
    const candidateTerritoriesById = new Map<string, string[]>();
    try {
      const { default: CreatorStrategicProfileSnapshot } = await import(
        "@/app/models/CreatorStrategicProfileSnapshot"
      );
      const snaps = await CreatorStrategicProfileSnapshot.find({ userId: { $in: pool.map((e) => e.user._id) } })
        .select("userId snapshotJson")
        .lean<Array<{ userId: Types.ObjectId; snapshotJson: string }>>();
      for (const snap of snaps) {
        try {
          const parsed = JSON.parse(snap.snapshotJson) as { narrativeTerritories?: Array<{ label?: unknown }> };
          const labels = Array.isArray(parsed?.narrativeTerritories)
            ? parsed.narrativeTerritories
                .map((t) => (typeof t?.label === "string" ? t.label : null))
                .filter((l): l is string => !!l)
            : [];
          candidateTerritoriesById.set(String(snap.userId), labels);
        } catch {
          /* snapshot inválido — ignora */
        }
      }
    } catch (err) {
      console.warn("[narrativeCollabMatching] snapshot fetch failed (non-fatal):", err);
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
    sharedSignal: findSharedLabel(viewerTerritoryLabels, candidateNarrative),
    distinctSignals: findDistinctLabels(viewerTerritoryLabels, herTerritories, 3),
    narrativeMatch: true,
  };
}

export { generateNarrativeFitReason };

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
