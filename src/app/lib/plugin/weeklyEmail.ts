// E-mail semanal de quem conectou a Data2Content por um chat e não assinou.
//
// Uma pauta nova do mapa da pessoa por semana. Quando as pautas de amostra já
// foram todas mostradas, o e-mail para: pauta nova toda semana é o que o Pro
// entrega, e repetir a mesma pauta vira spam.

import { createHmac, timingSafeEqual } from "node:crypto";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { isActiveLike } from "@/app/lib/planGuard";
import { loadMcpCreatorMap } from "@/app/lib/mcp/creatorMap";
import { getMcpAppBaseUrl } from "@/app/lib/mcp/config";
import CreatorContentIdeaModel from "@/app/models/CreatorContentIdea";
import UserModel from "@/app/models/User";
import { PLUGIN_CLIENT_LABEL, parsePluginClient } from "./pluginClient";

const DAY_MS = 86_400_000;
const MIN_DAYS_BETWEEN_SENDS = 6;
/** Não escreve no mesmo dia da conexão: a pessoa acabou de ver tudo no chat. */
const MIN_DAYS_SINCE_CONNECTION = 1;
const RECENT_IDEAS_KEPT = 10;

function unsubscribeSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET ausente");
  return secret;
}

export function pluginWeeklyUnsubscribeToken(userId: string): string {
  return createHmac("sha256", unsubscribeSecret()).update(`plugin-weekly:${userId}`).digest("hex").slice(0, 32);
}

export function isValidPluginWeeklyUnsubscribeToken(userId: string, token: string): boolean {
  if (!Types.ObjectId.isValid(userId) || !/^[a-f0-9]{32}$/.test(token)) return false;
  const expected = Buffer.from(pluginWeeklyUnsubscribeToken(userId));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function optOutOfPluginWeeklyEmail(userId: string, token: string): Promise<boolean> {
  if (!isValidPluginWeeklyUnsubscribeToken(userId, token)) return false;
  await connectToDatabase();
  await UserModel.updateOne(
    { _id: new Types.ObjectId(userId), pluginWeeklyEmailOptOutAt: { $exists: false } },
    { $set: { pluginWeeklyEmailOptOutAt: new Date() } },
  );
  return true;
}

type Candidate = {
  _id: Types.ObjectId;
  email?: string | null;
  name?: string | null;
  planStatus?: unknown;
  pluginOrigin?: { client?: string } | null;
  pluginWeeklyEmailIdeaIds?: string[];
};

export interface PluginWeeklyEmailRun {
  candidates: number;
  sent: number;
  skipped: Record<string, number>;
  failed: number;
  dryRun: boolean;
  preview: Array<{ userRef: string; client: string; ideaTitle: string }>;
}

export async function runPluginWeeklyEmails(params: {
  now?: Date;
  limit?: number;
  dryRun?: boolean;
} = {}): Promise<PluginWeeklyEmailRun> {
  const now = params.now ?? new Date();
  const limit = Math.max(1, Math.min(200, params.limit ?? 50));
  const dryRun = params.dryRun === true;
  await connectToDatabase();

  const candidates = await UserModel.find({
    "pluginOrigin.firstConnectedAt": { $lte: new Date(now.getTime() - MIN_DAYS_SINCE_CONNECTION * DAY_MS) },
    pluginWeeklyEmailOptOutAt: { $exists: false },
    email: { $type: "string" },
    $or: [
      { pluginWeeklyEmailCheckedAt: { $exists: false } },
      { pluginWeeklyEmailCheckedAt: { $lte: new Date(now.getTime() - MIN_DAYS_BETWEEN_SENDS * DAY_MS) } },
    ],
  })
    .select("_id email name planStatus pluginOrigin pluginWeeklyEmailIdeaIds")
    .sort({ pluginWeeklyEmailCheckedAt: 1, _id: 1 })
    .limit(limit)
    .lean<Candidate[]>();

  const run: PluginWeeklyEmailRun = { candidates: candidates.length, sent: 0, skipped: {}, failed: 0, dryRun, preview: [] };
  const skip = async (userId: Types.ObjectId, reason: string) => {
    run.skipped[reason] = (run.skipped[reason] ?? 0) + 1;
    // Quem foi pulado volta à fila só na próxima semana, sem tomar a vez dos outros.
    if (!dryRun) await UserModel.updateOne({ _id: userId }, { $set: { pluginWeeklyEmailCheckedAt: now } });
  };
  const baseUrl = getMcpAppBaseUrl();

  for (const user of candidates) {
    const userId = String(user._id);
    // Assinante recebe o conteúdo do Pro pelos canais do Pro.
    if (isActiveLike(user.planStatus)) {
      await skip(user._id, "already_pro");
      continue;
    }
    const client = parsePluginClient(user.pluginOrigin?.client) ?? "chatgpt";
    const shown = new Set(user.pluginWeeklyEmailIdeaIds ?? []);
    const idea = await CreatorContentIdeaModel.findOne({
      userId: user._id,
      status: { $in: ["active", "saved"] },
      ...(shown.size ? { _id: { $nin: [...shown].filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id)) } } : {}),
    })
      .sort({ generatedAt: -1 })
      .select("_id title hook territory")
      .lean<{ _id: Types.ObjectId; title?: string; hook?: string; territory?: string } | null>();
    if (!idea?.title) {
      await skip(user._id, "no_new_idea");
      continue;
    }
    const map = await loadMcpCreatorMap(userId).catch(() => null);
    const email = {
      name: user.name ?? null,
      clientLabel: PLUGIN_CLIENT_LABEL[client],
      narrative: map?.narrative ?? null,
      idea: { title: idea.title, hook: idea.hook ?? null, territory: idea.territory ?? null },
      profileUrl: `${baseUrl}/dashboard/plugin?source=${client}&intent=pautas`,
      unsubscribeUrl: `${baseUrl}/api/plugin/weekly-email/unsubscribe?u=${userId}&t=${pluginWeeklyUnsubscribeToken(userId)}`,
    };

    if (dryRun) {
      run.preview.push({ userRef: userId.slice(-6), client, ideaTitle: idea.title });
      run.sent += 1;
      continue;
    }
    try {
      // Carregado só no envio: a prévia roda em script, fora do Next.
      const { sendPluginWeeklyEmail } = await import("@/app/lib/emailService");
      await sendPluginWeeklyEmail(user.email as string, email);
      await UserModel.updateOne(
        { _id: user._id },
        {
          $set: { pluginWeeklyEmailCheckedAt: now },
          $push: { pluginWeeklyEmailIdeaIds: { $each: [String(idea._id)], $slice: -RECENT_IDEAS_KEPT } },
        },
      );
      run.sent += 1;
    } catch (error) {
      run.failed += 1;
      logger.warn("[plugin][weekly_email_failed]", {
        userRef: userId.slice(-6),
        error: error instanceof Error ? error.name : "unknown_error",
      });
    }
  }

  return run;
}
