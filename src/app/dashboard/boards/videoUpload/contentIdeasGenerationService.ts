/**
 * contentIdeasGenerationService.ts
 *
 * Orchestrates pauta generation:
 *   1. Reads the creator's confirmed map + signals
 *   2. Builds the Gemini prompt
 *   3. Calls Gemini with strict JSON schema
 *   4. Validates and persists ideas as `active`
 *
 * Returns either the generated ideas or a structured error.
 */
import { Types } from "mongoose";
import crypto from "node:crypto";
import { GoogleGenAI, createUserContent } from "@google/genai";
import { connectToDatabase } from "@/app/lib/mongoose";
import CreatorContentIdea from "@/app/models/CreatorContentIdea";
import type { ICreatorContentIdea } from "@/app/models/CreatorContentIdea";
import {
  buildContentIdeasPrompt,
  CONTENT_IDEAS_RESPONSE_JSON_SCHEMA,
  type ContentIdeasMapContext,
} from "./contentIdeasGeminiPromptBuilder";
import { stripIronicQuotes } from "./contentIdeasTextHygiene";

// ─── Public types ─────────────────────────────────────────────────────────────

export type ContentIdeasGenerationErrorCode =
  | "missing_api_key"
  | "invalid_user"
  | "gemini_call_failed"
  | "invalid_gemini_response"
  | "persistence_failed";

export interface ContentIdeasGenerationResult {
  ok: boolean;
  ideas?: Array<{
    id: string;
    title: string;
    angle: string;
    hook: string;
    territory: string;
    assets: string[];
    suggestedFormat: string;
    tone: string | null;
    whyItFits: string;
    resonanceNote: string | null;
    generatedAt: string;
  }>;
  errorCode?: ContentIdeasGenerationErrorCode;
  message?: string;
}

export interface GenerateContentIdeasParams {
  userId: string;
  context: ContentIdeasMapContext;
  count?: number;
  focusedTerritory?: string | null;
  focusedFormat?: string | null;
}

// ─── Implementation ───────────────────────────────────────────────────────────

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_COUNT = 3;
const MAX_COUNT = 6;

function readApiKey(): string | null {
  return (
    process.env.GOOGLE_GEMINI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    null
  );
}

function hashMapContext(context: ContentIdeasMapContext): string {
  const stableInput = JSON.stringify({
    narrative: context.narrative.label,
    territories: context.territories.map((t) => t.label).sort(),
    assets: [...context.confirmedAssets].sort(),
    tone: context.tone,
  });
  return crypto.createHash("sha256").update(stableInput).digest("hex").slice(0, 32);
}

function parseGeminiJson(text: string | null): { ideas: Array<Record<string, unknown>> } | null {
  if (!text || typeof text !== "string") return null;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray((parsed as any).ideas)) return null;
    return parsed as { ideas: Array<Record<string, unknown>> };
  } catch {
    // Try to extract JSON block in case Gemini wraps it in markdown
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      if (!parsed || typeof parsed !== "object") return null;
      if (!Array.isArray((parsed as any).ideas)) return null;
      return parsed as { ideas: Array<Record<string, unknown>> };
    } catch {
      return null;
    }
  }
}

function sanitizeIdea(
  raw: Record<string, unknown>,
  allowedTerritories: string[],
  allowedAssets: string[],
): {
  title: string;
  angle: string;
  hook: string;
  territory: string;
  assets: string[];
  suggestedFormat: string;
  whyItFits: string;
  scriptPoints: string[];
  scriptClosing: string | null;
  resonanceNote: string | null;
} | null {
  const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 160) : null;
  const angle = typeof raw.angle === "string" ? raw.angle.trim().slice(0, 400) : null;
  const hook = typeof raw.hook === "string" ? raw.hook.trim().slice(0, 220) : null;
  const rawTerritory = typeof raw.territory === "string" ? raw.territory.trim() : null;
  const suggestedFormat = typeof raw.suggestedFormat === "string"
    ? raw.suggestedFormat.trim().slice(0, 60)
    : null;
  const whyItFits = typeof raw.whyItFits === "string" ? raw.whyItFits.trim().slice(0, 400) : null;

  if (!title || !angle || !hook || !rawTerritory || !suggestedFormat || !whyItFits) {
    return null;
  }

  // Territory validation: exact match first; then prefix-tolerant fallback to handle
  // labels that were truncated in the DB ("a performance como uma estratégi" vs
  // "a performance como uma estratégia"). Either side may be the prefix of the other.
  // Accent-normalised to handle Gemini returning "negócio" vs stored "negocio", etc.
  const normalizeStr = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const rawNorm = normalizeStr(rawTerritory);
  const matchedTerritory = allowedTerritories.find((t) => {
    const allowed = normalizeStr(t);
    return (
      allowed === rawNorm ||
      rawNorm.startsWith(allowed) ||
      allowed.startsWith(rawNorm)
    );
  });
  if (!matchedTerritory) {
    console.warn("[contentIdeas:sanitize] territory not matched:", rawTerritory, "| allowed:", allowedTerritories);
    return null;
  }

  // Assets: filter to only confirmed ones; allow empty
  const rawAssets = Array.isArray(raw.assets) ? raw.assets : [];
  const assets = rawAssets
    .filter((a): a is string => typeof a === "string")
    .map((a) => a.trim())
    .filter((a) => a.length > 0)
    .map((a) => allowedAssets.find((c) => c.toLowerCase() === a.toLowerCase()) ?? null)
    .filter((a): a is string => a !== null)
    .slice(0, 4);

  // Script directional — enrichment fields, never drop an idea if absent
  const scriptPoints = Array.isArray(raw.scriptPoints)
    ? raw.scriptPoints
        .filter((p): p is string => typeof p === "string")
        .map((p) => p.trim().slice(0, 160))
        .filter((p) => p.length > 0)
        .slice(0, 3)
    : [];
  const scriptClosing =
    typeof raw.scriptClosing === "string" && raw.scriptClosing.trim()
      ? raw.scriptClosing.trim().slice(0, 160)
      : null;

  // Audience match — enrichment, never drops an idea if absent.
  const resonanceNote =
    typeof raw.resonanceNote === "string" && raw.resonanceNote.trim()
      ? raw.resonanceNote.trim().slice(0, 200)
      : null;

  return {
    title: stripIronicQuotes(title),
    angle,
    hook: stripIronicQuotes(hook),
    territory: matchedTerritory,
    assets,
    suggestedFormat,
    whyItFits: stripIronicQuotes(whyItFits),
    scriptPoints: scriptPoints.map(stripIronicQuotes),
    scriptClosing: scriptClosing ? stripIronicQuotes(scriptClosing) : null,
    resonanceNote: resonanceNote ? stripIronicQuotes(resonanceNote) : null,
  };
}

/**
 * Generates pautas for a creator and persists them.
 */
export async function generateContentIdeas(
  params: GenerateContentIdeasParams,
): Promise<ContentIdeasGenerationResult> {
  const apiKey = readApiKey();
  if (!apiKey) {
    return {
      ok: false,
      errorCode: "missing_api_key",
      message: "Geração de pautas indisponível no momento.",
    };
  }

  if (!params.userId || !Types.ObjectId.isValid(params.userId)) {
    return { ok: false, errorCode: "invalid_user", message: "Usuário inválido." };
  }

  const count = Math.max(1, Math.min(params.count ?? DEFAULT_COUNT, MAX_COUNT));

  // The card shows a single, stable batch of fresh pautas. When the creator asks
  // for new ones, this batch is REPLACED — not accumulated. To make "Gerar novos"
  // actually feel new, we feed the current active titles into the avoid-list so
  // the model doesn't re-suggest near-duplicates of what's already on screen.
  let currentActiveTitles: string[] = [];
  try {
    await connectToDatabase();
    const activeDocs = await CreatorContentIdea.find({
      userId: new Types.ObjectId(params.userId),
      status: "active",
    })
      .select("title")
      .lean<Array<{ title: string }>>();
    currentActiveTitles = activeDocs.map((d) => d.title).filter(Boolean);
  } catch (err) {
    // Non-fatal: freshness is best-effort. Generation still proceeds.
    console.warn("[contentIdeas:generate] failed to read active titles for avoid-list:", err);
  }

  const avoidTitles = Array.from(
    new Set([...(params.context.recentDismissedTitles ?? []), ...currentActiveTitles]),
  );

  const prompt = buildContentIdeasPrompt({
    context: { ...params.context, recentDismissedTitles: avoidTitles },
    count,
    focusedTerritory: params.focusedTerritory ?? null,
    focusedFormat: params.focusedFormat ?? null,
  });

  // ── Call Gemini ───────────────────────────────────────────────────────────
  let rawText: string | null = null;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: createUserContent([prompt.userInstruction, prompt.responseSchemaInstruction]),
      config: {
        systemInstruction: prompt.systemInstruction,
        responseMimeType: "application/json",
        responseJsonSchema: CONTENT_IDEAS_RESPONSE_JSON_SCHEMA,
        maxOutputTokens: 6000,
      },
    });
    rawText = response.text ?? null;
  } catch (err) {
    console.error("[contentIdeas] Gemini call failed:", err);
    return {
      ok: false,
      errorCode: "gemini_call_failed",
      message: "Não foi possível gerar pautas agora. Tente novamente em instantes.",
    };
  }

  const parsed = parseGeminiJson(rawText);
  if (!parsed || !Array.isArray(parsed.ideas) || parsed.ideas.length === 0) {
    console.warn("[contentIdeas:generate] invalid_gemini_response — rawText length:", rawText?.length ?? 0, "| first 200 chars:", rawText?.slice(0, 200));
    return {
      ok: false,
      errorCode: "invalid_gemini_response",
      message: "Resposta inválida do gerador.",
    };
  }

  // ── Sanitize and validate ─────────────────────────────────────────────────
  const allowedTerritories = params.context.territories.map((t) => t.label);
  const allowedAssets = params.context.confirmedAssets;
  console.log("[contentIdeas:generate] Gemini returned", parsed.ideas.length, "raw ideas. allowedTerritories:", allowedTerritories);
  const sanitized = parsed.ideas
    .map((raw) => {
      const result = sanitizeIdea(raw, allowedTerritories, allowedAssets);
      if (!result) {
        console.warn("[contentIdeas:generate] sanitizeIdea dropped idea — territory:", (raw as any).territory, "| title:", (raw as any).title);
      }
      return result;
    })
    .filter((idea): idea is NonNullable<ReturnType<typeof sanitizeIdea>> => idea !== null);

  if (sanitized.length === 0) {
    console.warn("[contentIdeas:generate] All ideas dropped after sanitization. allowedTerritories:", allowedTerritories);
    return {
      ok: false,
      errorCode: "invalid_gemini_response",
      message: "Nenhuma pauta válida foi gerada. Tente novamente.",
    };
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  try {
    await connectToDatabase();
    const mapContextHash = hashMapContext(params.context);
    const generatedAt = new Date();

    const docs = await CreatorContentIdea.insertMany(
      sanitized.map((idea) => ({
        userId: new Types.ObjectId(params.userId),
        status: "active",
        source: "gemini_v1",
        title: idea.title,
        angle: idea.angle,
        hook: idea.hook,
        territory: idea.territory,
        assets: idea.assets,
        suggestedFormat: idea.suggestedFormat,
        tone: params.context.tone,
        whyItFits: idea.whyItFits,
        scriptPoints: idea.scriptPoints,
        scriptClosing: idea.scriptClosing,
        resonanceNote: idea.resonanceNote,
        mapContextHash,
        modelVersion: DEFAULT_MODEL,
        generatedAt,
      })),
    );

    // Rotate out the previous batch: any idea that was still `active` before this
    // generation becomes `superseded`. This keeps the card at a stable count
    // (one fresh batch at a time) instead of accumulating every generation.
    // Saved/posted/dismissed ideas are deliberate states and are left untouched.
    const newIds = (docs as Array<ICreatorContentIdea>).map((d) => d._id);
    await CreatorContentIdea.updateMany(
      {
        userId: new Types.ObjectId(params.userId),
        status: "active",
        _id: { $nin: newIds },
      },
      { $set: { status: "superseded" } },
    );

    return {
      ok: true,
      ideas: (docs as Array<ICreatorContentIdea>).map((d) => ({
        id: d._id.toString(),
        title: d.title,
        angle: d.angle,
        hook: d.hook,
        territory: d.territory,
        assets: d.assets,
        suggestedFormat: d.suggestedFormat,
        tone: d.tone,
        whyItFits: d.whyItFits,
        scriptPoints: d.scriptPoints ?? [],
        scriptClosing: d.scriptClosing ?? null,
        resonanceNote: d.resonanceNote ?? null,
        generatedAt: d.generatedAt.toISOString(),
      })),
    };
  } catch (err) {
    console.error("[contentIdeas] Persistence failed:", err);
    return {
      ok: false,
      errorCode: "persistence_failed",
      message: "Pautas geradas, mas não conseguimos salvá-las. Tente novamente.",
    };
  }
}
