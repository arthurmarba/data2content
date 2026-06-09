/**
 * weeklyMapSummaryService.ts
 *
 * Generates a weekly narrative map summary for a creator using GPT-4o-mini.
 * The summary reads as a mirror reflection — what the map revealed this week —
 * not as a metrics report. Aligned with the Data2Content product belief:
 * treat data as meaning and narrative, not performance pressure.
 *
 * Called by: /api/cron/weekly-map-summary
 */

import OpenAI from "openai";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { getMapConfirmationsSnapshot } from "./mapConfirmationsService";
import CreatorContentIdea from "@/app/models/CreatorContentIdea";

const openai =
  process.env.NODE_ENV === "test"
    ? ({
        chat: {
          completions: {
            create: async () => ({
              choices: [{ message: { content: "" } }],
            }),
          },
        },
      } as unknown as OpenAI)
    : new OpenAI({
        apiKey: process.env.OPENAI_API_KEY!,
        baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      });

/** Minimum gap between generations: 6 days in ms */
const MIN_GENERATION_INTERVAL_MS = 6 * 24 * 60 * 60 * 1000;

export interface WeeklyMapSummaryResult {
  ok: boolean;
  skipped?: "no_readings" | "too_recent" | "generation_failed";
  summary?: string;
}

/**
 * Generates (or skips) a weekly map summary for one user.
 * Saves the result directly on the User document when successful.
 */
export async function generateWeeklyMapSummaryForUser(
  userId: string,
): Promise<WeeklyMapSummaryResult> {
  if (!userId || !Types.ObjectId.isValid(userId)) return { ok: false };

  await connectToDatabase();

  const userDoc = await User.findById(userId).select(
    "name mobileStrategicProfile onboardingAnswers weeklyMapSummaryGeneratedAt plan",
  ).lean<{
    _id: Types.ObjectId;
    name?: string;
    mobileStrategicProfile?: {
      synthesis?: {
        mainNarrative?: { label?: string; summary?: string } | null;
        commercialTerritories?: Array<{ label?: string }>;
        nextStrategicMove?: { label?: string } | null;
        analyzedReadingsCount?: number;
        status?: string;
      } | null;
    } | null;
    onboardingAnswers?: {
      whyYouCreate?: string | null;
      desiredFeeling?: string | null;
      contentLimit?: string | null;
      creatorPurpose?: string | null;
    } | null;
    weeklyMapSummaryGeneratedAt?: Date | null;
    plan?: string;
  }>();

  if (!userDoc) return { ok: false };

  const synthesis = userDoc.mobileStrategicProfile?.synthesis;
  const readingCount = synthesis?.analyzedReadingsCount ?? 0;

  // Skip users with no readings — map is empty, nothing to reflect
  if (readingCount === 0) return { ok: false, skipped: "no_readings" };

  // Skip if generated recently
  if (userDoc.weeklyMapSummaryGeneratedAt) {
    const age = Date.now() - new Date(userDoc.weeklyMapSummaryGeneratedAt).getTime();
    if (age < MIN_GENERATION_INTERVAL_MS) return { ok: false, skipped: "too_recent" };
  }

  // Gather map confirmations
  const confirmations = await getMapConfirmationsSnapshot(userId);

  // Gather saved/active ideas (up to 2 titles for context)
  const recentIdeas = await CreatorContentIdea.find({
    userId: new Types.ObjectId(userId),
    status: { $in: ["active", "saved"] },
  })
    .sort({ generatedAt: -1 })
    .limit(2)
    .select("title suggestedFormat")
    .lean<Array<{ title: string; suggestedFormat: string }>>();

  // Build context for the prompt
  const narrative = synthesis?.mainNarrative?.label ?? null;
  const territories = (synthesis?.commercialTerritories ?? [])
    .slice(0, 3)
    .map((t) => t.label)
    .filter(Boolean)
    .join(", ");
  const nextMove = synthesis?.nextStrategicMove?.label ?? null;
  const confirmedDims: string[] = [];
  if (confirmations?.narrative === "confirmed") confirmedDims.push("narrativa");
  if (confirmations?.territories === "confirmed") confirmedDims.push("territórios");
  if (confirmations?.tone === "confirmed") confirmedDims.push("tom");
  const ideaTitles = recentIdeas.map((i) => `"${i.title}" (${i.suggestedFormat})`).join(", ");
  const whyCreate = userDoc.onboardingAnswers?.whyYouCreate ?? null;
  const creatorPurpose = userDoc.onboardingAnswers?.creatorPurpose ?? null;

  const prompt = buildPrompt({
    creatorName: userDoc.name ?? null,
    readingCount,
    narrative,
    territories,
    nextMove,
    confirmedDims,
    ideaTitles,
    whyCreate,
    creatorPurpose,
  });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      max_tokens: 160,
      messages: [
        {
          role: "system",
          content:
            "Você é o espelho narrativo do criador dentro da plataforma Data2Content. " +
            "Seu tom é calmo, direto e reconhecedor — nunca pressiona, nunca usa linguagem de métricas ou growth hack. " +
            "Fale em português brasileiro, na segunda pessoa (você). " +
            "Escreva um parágrafo curto (3-4 frases) que reflita o que o mapa do criador revela esta semana. " +
            "Não use bullet points, não liste números de postagens, não use 'engajamento', 'alcance' ou 'algoritmo'. " +
            "Termine com uma frase que oriente o próximo passo de conteúdo de forma calma.",
        },
        { role: "user", content: prompt },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) return { ok: false, skipped: "generation_failed" };

    await User.findByIdAndUpdate(userId, {
      $set: {
        weeklyMapSummary: text,
        weeklyMapSummaryGeneratedAt: new Date(),
      },
    });

    return { ok: true, summary: text };
  } catch (err) {
    console.error("[weeklyMapSummary] GPT-4o-mini error:", err);
    return { ok: false, skipped: "generation_failed" };
  }
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildPrompt(ctx: {
  creatorName: string | null;
  readingCount: number;
  narrative: string | null;
  territories: string;
  nextMove: string | null;
  confirmedDims: string[];
  ideaTitles: string;
  whyCreate: string | null;
  creatorPurpose: string | null;
}): string {
  const lines: string[] = [];

  lines.push(`Mapa do criador${ctx.creatorName ? ` ${ctx.creatorName}` : ""} esta semana:`);
  lines.push(`- Análises acumuladas: ${ctx.readingCount}`);

  // O propósito declarado é o norte — ancore o resumo nele quando existir.
  if (ctx.creatorPurpose) lines.push(`- Propósito do criador (norte): "${ctx.creatorPurpose}"`);
  if (ctx.narrative) lines.push(`- Narrativa central detectada: "${ctx.narrative}"`);
  if (ctx.territories) lines.push(`- Territórios: ${ctx.territories}`);
  if (ctx.confirmedDims.length > 0)
    lines.push(`- Dimensões confirmadas pelo criador: ${ctx.confirmedDims.join(", ")}`);
  if (ctx.nextMove) lines.push(`- Próximo passo estratégico: "${ctx.nextMove}"`);
  if (ctx.ideaTitles) lines.push(`- Pautas disponíveis no mapa: ${ctx.ideaTitles}`);
  if (ctx.whyCreate) lines.push(`- Por que cria: "${ctx.whyCreate}"`);

  lines.push(
    "\nCom base nisso, escreva o resumo semanal do mapa deste criador. " +
    "Seja específico ao mencionar a narrativa ou os territórios — não fale em genérico.",
  );

  return lines.join("\n");
}
