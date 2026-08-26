/**
 * Read-only audit for the creator + territory hook recommender.
 * Prints aggregate coverage only: no creator id, handle, opening line or post text.
 *
 * @run `npm run audit:hook-readiness`
 */

import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import MetricModel from "@/app/models/Metric";
import { loadMapProfiles } from "@/app/lib/relatorio/mapProfiles";
import { canonicalTerritoryById } from "@/app/lib/relatorio/mapRegistry";
import {
  summarizeHookRecommendationReadiness,
  type HookRecommendationReadinessMetric,
} from "@/app/dashboard/boards/videoUpload/hookRecommendationReadiness";

const WINDOW_DAYS = 90;
const ONE_DAY_MS = 86_400_000;

type MetricDocument = {
  user: mongoose.Types.ObjectId;
  stats?: Record<string, unknown> | null;
  sceneElements?: {
    version?: string | null;
    openingLine?: string | null;
    screenTitle?: string | null;
  } | null;
};

function finiteNonNegative(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function positive(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function readinessLabel(value: string): string {
  if (value === "ready") return "PRONTO";
  if (value === "partial") return "PARCIAL";
  return "SEM BASE";
}

async function main() {
  await connectToDatabase();
  const since = new Date(Date.now() - WINDOW_DAYS * ONE_DAY_MS);
  const documents = await MetricModel.find({
    postDate: { $gte: since },
    classificationStatus: "completed",
    $or: [
      { format: "reel" },
      { type: { $regex: "reel|video", $options: "i" } },
      { "stats.video_duration_seconds": { $gt: 0 } },
    ],
  })
    .select("user stats sceneElements")
    .lean<MetricDocument[]>();

  const creatorIds = [...new Set(documents.map((document) => String(document.user)))];
  const profiles = await loadMapProfiles(creatorIds);
  const territoryLabels = new Map<string, string>();
  for (const profile of profiles.values()) {
    for (const territoryId of profile.territoryIds) {
      territoryLabels.set(territoryId, canonicalTerritoryById(territoryId)?.label ?? territoryId);
    }
  }

  const metrics: HookRecommendationReadinessMetric[] = documents.map((document) => {
    const stats = document.stats ?? {};
    const creatorId = String(document.user);
    return {
      creatorId,
      territoryId: profiles.get(creatorId)?.primaryTerritoryId ?? null,
      hasSceneRead: hasText(document.sceneElements?.version),
      hasOpeningLine: hasText(document.sceneElements?.openingLine),
      hasScreenTitle: hasText(document.sceneElements?.screenTitle),
      hasDuration: positive(stats.video_duration_seconds),
      hasWatchTime: positive(stats.ig_reels_avg_watch_time)
        || positive(stats.average_video_watch_time_seconds)
        || positive(stats.avg_watch_time_seconds),
      // A persistência legada usa zero como fallback em parte da base. Para a
      // prontidão do recomendador, zero não prova que houve leitura de retenção.
      hasRetention: positive(stats.retention_rate),
      hasIntentSignals: finiteNonNegative(stats.shares)
        || finiteNonNegative(stats.saved)
        || finiteNonNegative(stats.saves),
    };
  });
  const results = summarizeHookRecommendationReadiness({ metrics, territoryLabels });
  const withoutTerritory = metrics.filter((metric) => !metric.territoryId).length;
  const ready = results.filter((result) => result.readiness === "ready").length;
  const partial = results.filter((result) => result.readiness === "partial").length;

  console.log("\n═══ PRONTIDÃO DO GERADOR DE GANCHO POR TERRITÓRIO ═══\n");
  console.log(`Janela ................................... ${WINDOW_DAYS} dias`);
  console.log(`Reels/vídeos classificados ............... ${documents.length}`);
  console.log(`Criadores na amostra ..................... ${creatorIds.length}`);
  console.log(`Posts sem território canônico ............ ${withoutTerritory}`);
  console.log(`Territórios prontos para beta ............ ${ready}`);
  console.log(`Territórios com base parcial ............. ${partial}`);

  console.log("\nSTATUS     TERRITÓRIO                    POSTS  PESSOAS  GANCHOS  CENAS  OUTCOME");
  for (const result of results) {
    console.log(
      `${readinessLabel(result.readiness).padEnd(10)}`
      + `${result.territoryLabel.slice(0, 28).padEnd(30)}`
      + `${String(result.posts).padStart(5)}  `
      + `${String(result.creators).padStart(7)}  `
      + `${String(result.hooksAvailable).padStart(7)}  `
      + `${pct(result.sceneCoverage).padStart(5)}  `
      + `${pct(result.outcomeCoverage).padStart(7)}`,
    );
    if (result.blockers.length > 0) console.log(`           bloqueios: ${result.blockers.join(", ")}`);
  }

  console.log("\nCritério beta: ≥20 posts, ≥5 criadores, ≥10 ganchos, ≥50% de cenas e ≥40% de outcome de retenção/watch time.\n");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Falhou:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
