/**
 * contentIdeasReadService.ts
 *
 * Read + mutate operations for CreatorContentIdea documents.
 */
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import CreatorContentIdea, {
  type ICreatorContentIdea,
  type CreatorContentIdeaStatus,
} from "@/app/models/CreatorContentIdea";
import { cleanIdeaText } from "./contentIdeasTextHygiene";

export interface ContentIdeaListItem {
  id: string;
  title: string;
  angle: string;
  hook: string;
  territory: string;
  assets: string[];
  suggestedFormat: string;
  tone: string | null;
  whyItFits: string;
  /** Script directional: 2-3 ordered scene points for the video */
  scriptPoints: string[];
  /** Suggested video closing — question, invitation, or final insight */
  scriptClosing: string | null;
  /** Audience match — why this is what people most keep from the creator (null when none) */
  resonanceNote: string | null;
  status: CreatorContentIdeaStatus;
  generatedAt: string;
  /** ISO date string when the creator scheduled this idea. Null when unscheduled. */
  scheduledFor: string | null;
}

/**
 * Reads the creator's active + saved ideas. Dismissed ones stay hidden.
 * Latest first. Capped at 30 to avoid pagination V1.
 */
export async function listContentIdeasForUser(userId: string): Promise<ContentIdeaListItem[]> {
  if (!userId || !Types.ObjectId.isValid(userId)) return [];

  try {
    await connectToDatabase();
    const docs = await CreatorContentIdea.find({
      userId: new Types.ObjectId(userId),
      status: { $in: ["active", "saved", "posted"] },
    })
      .sort({ generatedAt: -1, _id: -1 })
      .limit(30)
      .lean<ICreatorContentIdea[]>();

    return docs.map((d) => ({
      id: d._id.toString(),
      // Conserta acentos mutilados pelo gerador ("cabe00e7a" → "cabeça") nas pautas
      // JÁ gravadas — sem migração. Pautas novas já saem limpas do sanitize.
      title: cleanIdeaText(d.title),
      angle: cleanIdeaText(d.angle),
      hook: cleanIdeaText(d.hook),
      territory: d.territory,
      assets: d.assets,
      suggestedFormat: d.suggestedFormat,
      tone: d.tone,
      whyItFits: cleanIdeaText(d.whyItFits),
      scriptPoints: (d.scriptPoints ?? []).map(cleanIdeaText),
      scriptClosing: d.scriptClosing ? cleanIdeaText(d.scriptClosing) : null,
      resonanceNote: d.resonanceNote ? cleanIdeaText(d.resonanceNote) : null,
      status: d.status,
      generatedAt: d.generatedAt.toISOString(),
      scheduledFor: d.scheduledFor ? d.scheduledFor.toISOString() : null,
    }));
  } catch (err) {
    console.error("[contentIdeas:read] Erro silencioso:", err);
    return [];
  }
}

/**
 * Returns titles of recently dismissed ideas (used by the prompt builder
 * to avoid re-suggesting close variations).
 */
export async function listRecentDismissedTitles(userId: string, limit = 10): Promise<string[]> {
  if (!userId || !Types.ObjectId.isValid(userId)) return [];

  try {
    await connectToDatabase();
    const docs = await CreatorContentIdea.find({
      userId: new Types.ObjectId(userId),
      status: "dismissed",
    })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select("title")
      .lean<Array<{ title: string }>>();

    return docs.map((d) => d.title);
  } catch {
    return [];
  }
}

/**
 * Schedules a content idea for a specific date (or clears the schedule).
 * Only the owner can mutate.
 */
export async function scheduleContentIdea(
  userId: string,
  ideaId: string,
  scheduledFor: Date | null,
): Promise<{ ok: boolean }> {
  if (
    !userId ||
    !Types.ObjectId.isValid(userId) ||
    !ideaId ||
    !Types.ObjectId.isValid(ideaId)
  ) {
    return { ok: false };
  }

  try {
    await connectToDatabase();
    const result = await CreatorContentIdea.findOneAndUpdate(
      { _id: new Types.ObjectId(ideaId), userId: new Types.ObjectId(userId) },
      { $set: { scheduledFor } },
    );
    return { ok: result != null };
  } catch (err) {
    console.error("[contentIdeas:schedule] Erro:", err);
    return { ok: false };
  }
}

/**
 * Updates a single idea's status. Only the owner can mutate.
 */
export async function updateContentIdeaStatus(
  userId: string,
  ideaId: string,
  status: CreatorContentIdeaStatus,
): Promise<{ ok: boolean }> {
  if (
    !userId ||
    !Types.ObjectId.isValid(userId) ||
    !ideaId ||
    !Types.ObjectId.isValid(ideaId)
  ) {
    return { ok: false };
  }

  try {
    await connectToDatabase();
    const result = await CreatorContentIdea.findOneAndUpdate(
      { _id: new Types.ObjectId(ideaId), userId: new Types.ObjectId(userId) },
      { $set: { status } },
    );
    return { ok: result != null };
  } catch (err) {
    console.error("[contentIdeas:update] Erro:", err);
    return { ok: false };
  }
}
