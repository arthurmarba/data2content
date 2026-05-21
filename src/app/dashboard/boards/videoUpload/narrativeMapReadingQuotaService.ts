import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import CreatorVideoNarrativeDiagnosis from "@/app/models/CreatorVideoNarrativeDiagnosis";
import {
  createEmptyNarrativeMapReadingQuotaSnapshot,
  normalizeNarrativeMapReadingQuotaSnapshot,
  resolveNarrativeMapAccessState,
  type NarrativeMapReadingQuotaSnapshot,
  type ResolveNarrativeMapAccessStateInput,
} from "./narrativeMapAccessState";

type DiagnosisModelLike = typeof CreatorVideoNarrativeDiagnosis;

function assertValidUserId(userId: string): void {
  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new Error("UserId inválido");
  }
}

function monthRange(now: Date): { monthKey: string; start: Date; end: Date } {
  const monthKey = now.toISOString().slice(0, 7);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  return { monthKey, start, end };
}

export async function getNarrativeMapReadingQuotaForUser(params: {
  userId: string;
  now?: Date;
  model?: DiagnosisModelLike;
}): Promise<NarrativeMapReadingQuotaSnapshot> {
  assertValidUserId(params.userId);
  await connectToDatabase();

  const model = params.model ?? CreatorVideoNarrativeDiagnosis;
  const now = params.now ?? new Date();
  const range = monthRange(now);
  const userId = new Types.ObjectId(params.userId);
  const completedForUser = { userId, status: "completed" };

  const [usedTotal, usedThisMonth] = await Promise.all([
    model.countDocuments(completedForUser),
    model.countDocuments({
      ...completedForUser,
      createdAt: { $gte: range.start, $lt: range.end },
    }),
  ]);

  return normalizeNarrativeMapReadingQuotaSnapshot({
    ...createEmptyNarrativeMapReadingQuotaSnapshot({ userId: params.userId, now }),
    monthKey: range.monthKey,
    usedTotal,
    usedThisMonth,
  });
}

export async function assertCanStartNarrativeMapReading(params: {
  userId: string;
  access: Omit<ResolveNarrativeMapAccessStateInput, "readingQuota">;
  now?: Date;
  model?: DiagnosisModelLike;
}): Promise<{
  ok: boolean;
  state: ReturnType<typeof resolveNarrativeMapAccessState>;
  quota: NarrativeMapReadingQuotaSnapshot;
  message: string;
}> {
  const quota = await getNarrativeMapReadingQuotaForUser({
    userId: params.userId,
    now: params.now,
    model: params.model,
  });
  const state = resolveNarrativeMapAccessState({
    ...params.access,
    readingQuota: quota,
  });
  const ok = state === "free_unused" || state === "pro_instagram_connected" || state === "pro_needs_instagram" || state === "admin";

  return {
    ok,
    state,
    quota,
    message: ok ? "Leitura disponível." : "Limite de leituras indisponível.",
  };
}
