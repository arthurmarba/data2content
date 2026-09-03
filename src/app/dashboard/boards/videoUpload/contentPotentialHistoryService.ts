import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import type { VideoNarrativePotentialBand } from "./videoNarrativeContentPotentialScan";
import { structurePatternFromNarrativeForm } from "./creatorStructureEvidence";
import { sanitizeScriptAdjustmentRecommendation } from "./scriptAdjustmentRecommendation";

export type ContentPotentialCalibrationHistory = {
  outcomesLinked: number;
  bandOutcomes: Partial<Record<VideoNarrativePotentialBand, { count: number; successRate: number }>>;
};

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function readStats(metric: any) {
  const stats = metric?.stats ?? {};
  return {
    reach: finite(stats.reach ?? stats.accounts_reached),
    views: finite(stats.views ?? stats.video_views ?? stats.plays),
    watchTimeSeconds: finite(stats.ig_reels_avg_watch_time ?? stats.avg_watch_time),
    shares: finite(stats.shares),
    saves: finite(stats.saved ?? stats.saves),
  };
}

function avg(values: Array<number | null>): number | null {
  const usable = values.filter((value): value is number => value !== null);
  return usable.length > 0 ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function normalizedTokens(value: unknown): Set<string> {
  if (typeof value !== "string") return new Set();
  return new Set(value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1));
}

export function hookOpeningMatchScore(selected: unknown, published: unknown): number | null {
  const a = normalizedTokens(selected);
  const b = normalizedTokens(published);
  if (a.size === 0 || b.size === 0) return null;
  const overlap = [...a].filter((token) => b.has(token)).length;
  return Math.round((2 * overlap / (a.size + b.size)) * 100) / 100;
}

export function scriptStructureMatchScore(selectedPattern: unknown, publishedForms: unknown): number | null {
  if (typeof selectedPattern !== "string" || !selectedPattern.trim()) return null;
  const forms = Array.isArray(publishedForms)
    ? publishedForms.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    : typeof publishedForms === "string" && publishedForms.trim() ? [publishedForms] : [];
  if (forms.length === 0) return null;
  return forms.some((value) => structurePatternFromNarrativeForm(value) === selectedPattern) ? 1 : 0;
}

/**
 * Resolves an explicit Instagram media link first. Without one, links a pending
 * "Vou postar" scan only when there is exactly one Reel in the next seven days.
 * Ambiguous matches stay pending.
 */
async function reconcilePendingOutcomes(userId: string): Promise<void> {
  const { default: Diagnosis } = await import("@/app/models/CreatorVideoNarrativeDiagnosis");
  const { default: Metric } = await import("@/app/models/Metric");
  const userObjectId = new Types.ObjectId(userId);
  const pending = await Diagnosis.find({
    userId: userObjectId,
    publishIntent: "yes",
    publishDecisionAt: { $exists: true },
    performanceOutcome: { $exists: false },
    contentPotentialScan: { $exists: true },
  })
    .select("diagnosisId publishDecisionAt linkedInstagramMediaId hookSelection scriptAdjustmentRecommendation scriptAdjustmentSelection videoMetadata.durationSeconds")
    .sort({ publishDecisionAt: -1 })
    .limit(6)
    .lean();
  if (pending.length === 0) return;

  const recentMetrics = await Metric.find({ user: userObjectId })
    .select("instagramMediaId postDate format type narrativeForm stats sceneElements.openingLine")
    .sort({ postDate: -1 })
    .limit(120)
    .lean();
  const baselineReach = avg(recentMetrics.map((metric: any) => readStats(metric).reach));
  const baselineIntent = avg(recentMetrics.map((metric: any) => {
    const stats = readStats(metric);
    return stats.shares !== null || stats.saves !== null ? (stats.shares ?? 0) + (stats.saves ?? 0) : null;
  }));

  for (const diagnosis of pending as any[]) {
    const start = new Date(diagnosis.publishDecisionAt);
    if (!Number.isFinite(start.getTime())) continue;
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const explicitlyLinked = diagnosis.linkedInstagramMediaId
      ? recentMetrics.find((metric: any) => metric.instagramMediaId === diagnosis.linkedInstagramMediaId)
      : null;
    const matches = explicitlyLinked ? [explicitlyLinked] : recentMetrics.filter((metric: any) => {
        const postDate = new Date(metric.postDate);
        if (!Number.isFinite(postDate.getTime()) || postDate < start || postDate > end) return false;
        const formats = Array.isArray(metric.format) ? metric.format : [metric.format, metric.type];
        return formats.some((value: unknown) => /reel|video/i.test(String(value ?? "")));
      });
    if (matches.length !== 1) continue;
    const metric: any = matches[0];
    if (!metric?.instagramMediaId) continue;
    const stats = readStats(metric);
    const intent = stats.shares !== null || stats.saves !== null ? (stats.shares ?? 0) + (stats.saves ?? 0) : null;
    const selectedCandidate = diagnosis.hookSelection?.candidate;
    const openingMatchScore = selectedCandidate
      ? hookOpeningMatchScore(selectedCandidate.spokenLine, metric.sceneElements?.openingLine)
      : null;
    const scriptRecommendation = sanitizeScriptAdjustmentRecommendation(
      diagnosis.scriptAdjustmentRecommendation,
      { durationSeconds: diagnosis.videoMetadata?.durationSeconds },
    );
    const selectedStepIds = Array.isArray(diagnosis.scriptAdjustmentSelection?.selectedStepIds)
      ? diagnosis.scriptAdjustmentSelection.selectedStepIds.filter((value: unknown): value is string => typeof value === "string")
      : [];
    const publishedForms = Array.isArray(metric.narrativeForm)
      ? metric.narrativeForm.filter((value: unknown): value is string => typeof value === "string")
      : typeof metric.narrativeForm === "string" ? [metric.narrativeForm] : [];
    const publishedStructureMatchScore = scriptRecommendation
      ? scriptStructureMatchScore(scriptRecommendation.pattern, publishedForms)
      : null;
    await Diagnosis.updateOne(
      { _id: diagnosis._id, performanceOutcome: { $exists: false } },
      {
        $set: {
          linkedInstagramMediaId: metric.instagramMediaId,
          performanceOutcome: {
            ...stats,
            relativeReach: stats.reach !== null && baselineReach ? stats.reach / baselineReach : null,
            relativeIntent: intent !== null && baselineIntent ? intent / baselineIntent : null,
            capturedAt: new Date(),
          },
          learningStatus: "published_matched",
          ...(selectedCandidate
            ? {
                hookOutcome: {
                  selectedCandidateId: diagnosis.hookSelection.candidateId,
                  pattern: selectedCandidate.pattern,
                  strategy: selectedCandidate.strategy,
                  openingMatchScore,
                  usedInPublishedOpening: openingMatchScore === null ? null : openingMatchScore >= 0.7,
                  capturedAt: new Date(),
                },
              }
            : {}),
          ...(scriptRecommendation && diagnosis.scriptAdjustmentSelection
            ? {
                scriptAdjustmentOutcome: {
                  recommendationVersion: scriptRecommendation.version,
                  pattern: scriptRecommendation.pattern,
                  effort: scriptRecommendation.effort,
                  selectedStepIds,
                  publishedStructureMatchScore,
                  capturedAt: new Date(),
                },
              }
            : {}),
        },
      },
    );
  }
}

export async function buildContentPotentialCalibrationHistory(
  userId: string,
): Promise<ContentPotentialCalibrationHistory> {
  if (!Types.ObjectId.isValid(userId)) return { outcomesLinked: 0, bandOutcomes: {} };
  try {
    await connectToDatabase();
    await reconcilePendingOutcomes(userId);
    const { default: Diagnosis } = await import("@/app/models/CreatorVideoNarrativeDiagnosis");
    const docs = await Diagnosis.find({
      userId: new Types.ObjectId(userId),
      linkedInstagramMediaId: { $exists: true },
      performanceOutcome: { $exists: true },
      contentPotentialScan: { $exists: true },
    })
      .select("contentPotentialScan.band performanceOutcome.relativeReach performanceOutcome.relativeIntent")
      .limit(80)
      .lean();

    const grouped = new Map<VideoNarrativePotentialBand, { count: number; successes: number }>();
    for (const doc of docs as any[]) {
      const band = doc?.contentPotentialScan?.band as VideoNarrativePotentialBand | undefined;
      if (!band) continue;
      const relativeReach = finite(doc?.performanceOutcome?.relativeReach);
      const relativeIntent = finite(doc?.performanceOutcome?.relativeIntent);
      const success = (relativeReach ?? 0) >= 1 || (relativeIntent ?? 0) >= 1;
      const current = grouped.get(band) ?? { count: 0, successes: 0 };
      current.count += 1;
      current.successes += success ? 1 : 0;
      grouped.set(band, current);
    }

    const bandOutcomes: ContentPotentialCalibrationHistory["bandOutcomes"] = {};
    for (const [band, value] of grouped) {
      bandOutcomes[band] = { count: value.count, successRate: value.successes / value.count };
    }
    return { outcomesLinked: docs.length, bandOutcomes };
  } catch {
    return { outcomesLinked: 0, bandOutcomes: {} };
  }
}
