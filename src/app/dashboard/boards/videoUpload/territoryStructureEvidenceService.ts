import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { loadMapProfiles } from "@/app/lib/relatorio/mapProfiles";
import WeeklyTerritoryReportModel, { type IWeeklyTerritoryElement } from "@/app/models/WeeklyTerritoryReport";
import { structurePatternFromNarrativeForm, STRUCTURE_PATTERN_LABELS } from "./creatorStructureEvidence";
import type { ScriptStructurePattern } from "./scriptAdjustmentRecommendation";

export type TerritoryStructurePatternEvidence = {
  pattern: ScriptStructurePattern;
  label: string;
  performanceIndex: number;
  posts: number;
  creators: number;
  evidence: string;
};

export type TerritoryStructureContext = {
  territoryId: string;
  territoryLabel: string;
  weekKey: string;
  posts: number;
  creators: number;
  windowDays: number;
  patterns: TerritoryStructurePatternEvidence[];
};

export function isTerritoryStructureEvidenceEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return env.VIDEO_NARRATIVE_SCRIPT_ADJUSTMENT_TERRITORY_ENABLED === "1";
}

export function territoryStructureEvidenceAllowsTerritory(
  territoryId: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  if (!isTerritoryStructureEvidenceEnabled(env)) return false;
  const allowed = (env.VIDEO_NARRATIVE_SCRIPT_ADJUSTMENT_TERRITORIES
    ?? env.VIDEO_NARRATIVE_TERRITORY_HOOKS_TERRITORIES
    ?? "")
    .split(",")
    .map((value) => value.trim().toLocaleLowerCase("pt-BR"))
    .filter(Boolean);
  return allowed.includes(territoryId.trim().toLocaleLowerCase("pt-BR"));
}

function performanceIndex(element: IWeeklyTerritoryElement): number | null {
  const value = element.metrics?.find((metric) => metric.metric === "retencao")?.index
    ?? element.metrics?.find((metric) => metric.metric === "engajamento")?.index
    ?? null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function territoryStructureContextFromSnapshot(snapshot: {
  weekKey: string;
  territoryId: string;
  territoryLabel: string;
  creators: number;
  cutoff?: { windowDays?: number } | null;
  elements: IWeeklyTerritoryElement[];
}): TerritoryStructureContext | null {
  const grouped = new Map<ScriptStructurePattern, TerritoryStructurePatternEvidence>();
  for (const element of snapshot.elements ?? []) {
    if (element.kind !== "formato") continue;
    const index = performanceIndex(element);
    if (index === null || index < 1 || element.pullsDown || element.occurrencesInWindow < 5 || element.fitsCount < 2 || element.evidence === "indicio") continue;
    const pattern = structurePatternFromNarrativeForm(element.key || element.label);
    const current = grouped.get(pattern);
    const candidate = {
      pattern,
      label: STRUCTURE_PATTERN_LABELS[pattern],
      performanceIndex: Math.round(index * 100) / 100,
      posts: element.occurrencesInWindow,
      creators: element.fitsCount,
      evidence: element.evidence,
    };
    if (!current || candidate.performanceIndex > current.performanceIndex) grouped.set(pattern, candidate);
  }
  const patterns = [...grouped.values()].sort((a, b) => b.performanceIndex - a.performanceIndex || b.posts - a.posts).slice(0, 3);
  if (patterns.length === 0) return null;
  return {
    territoryId: snapshot.territoryId,
    territoryLabel: snapshot.territoryLabel,
    weekKey: snapshot.weekKey,
    posts: patterns.reduce((sum, pattern) => sum + pattern.posts, 0),
    creators: Math.max(snapshot.creators, ...patterns.map((pattern) => pattern.creators)),
    windowDays: Math.max(0, snapshot.cutoff?.windowDays ?? 90),
    patterns,
  };
}

export async function buildTerritoryStructureContextForUser(userId: string): Promise<TerritoryStructureContext | null> {
  if (!isTerritoryStructureEvidenceEnabled() || !mongoose.Types.ObjectId.isValid(userId)) return null;
  await connectToDatabase();
  const profiles = await loadMapProfiles([userId]);
  const territoryId = profiles.get(userId)?.primaryTerritoryId;
  if (!territoryId || !territoryStructureEvidenceAllowsTerritory(territoryId)) return null;
  const snapshot = await WeeklyTerritoryReportModel.findOne({ territoryId, "elements.kind": "formato" })
    .sort({ weekStartsAt: -1 })
    .select("weekKey territoryId territoryLabel creators cutoff elements")
    .lean<{
      weekKey: string;
      territoryId: string;
      territoryLabel: string;
      creators: number;
      cutoff?: { windowDays?: number } | null;
      elements: IWeeklyTerritoryElement[];
    } | null>();
  return snapshot ? territoryStructureContextFromSnapshot(snapshot) : null;
}
