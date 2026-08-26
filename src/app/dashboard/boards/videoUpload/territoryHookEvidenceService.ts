import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { loadMapProfiles } from "@/app/lib/relatorio/mapProfiles";
import WeeklyTerritoryReportModel, {
  type IWeeklyTerritoryElement,
} from "@/app/models/WeeklyTerritoryReport";
import type { CreatorHookPattern } from "./creatorHookEvidence";

export type TerritoryHookPatternEvidence = {
  pattern: CreatorHookPattern;
  label: string;
  performanceIndex: number;
  posts: number;
  creators: number;
  evidence: string;
};

export type TerritoryHookContext = {
  territoryId: string;
  territoryLabel: string;
  weekKey: string;
  posts: number;
  creators: number;
  windowDays: number;
  patterns: TerritoryHookPatternEvidence[];
};

const HOOK_PATTERNS = new Set<CreatorHookPattern>([
  "question",
  "diagnostic",
  "comparison",
  "specific_number",
  "contrarian",
  "personal_confession",
  "direct_statement",
]);

export function isTerritoryHookEvidenceEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return env.VIDEO_NARRATIVE_TERRITORY_HOOKS_ENABLED === "1";
}

export function territoryHookEvidenceAllowsTerritory(
  territoryId: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  if (!isTerritoryHookEvidenceEnabled(env)) return false;
  const allowed = (env.VIDEO_NARRATIVE_TERRITORY_HOOKS_TERRITORIES ?? "")
    .split(",")
    .map((value) => value.trim().toLocaleLowerCase("pt-BR"))
    .filter(Boolean);
  return allowed.includes(territoryId.trim().toLocaleLowerCase("pt-BR"));
}

function retentionIndex(element: IWeeklyTerritoryElement): number | null {
  const value = element.metrics?.find((metric) => metric.metric === "retencao")?.index
    ?? element.metrics?.find((metric) => metric.metric === "engajamento")?.index
    ?? null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function territoryHookContextFromSnapshot(snapshot: {
  weekKey: string;
  territoryId: string;
  territoryLabel: string;
  creators: number;
  cutoff?: { windowDays?: number } | null;
  elements: IWeeklyTerritoryElement[];
}): TerritoryHookContext | null {
  const patterns = (snapshot.elements ?? [])
    .filter((element) => element.kind === "gancho" && HOOK_PATTERNS.has(element.key as CreatorHookPattern))
    .map((element) => ({ element, performanceIndex: retentionIndex(element) }))
    .filter(({ element, performanceIndex }) =>
      performanceIndex !== null &&
      performanceIndex >= 1 &&
      !element.pullsDown &&
      element.occurrencesInWindow >= 5 &&
      element.fitsCount >= 2 &&
      element.evidence !== "indicio"
    )
    .sort((a, b) =>
      (b.performanceIndex ?? 0) - (a.performanceIndex ?? 0) ||
      b.element.occurrencesInWindow - a.element.occurrencesInWindow
    )
    .slice(0, 3)
    .map(({ element, performanceIndex }) => ({
      pattern: element.key as CreatorHookPattern,
      label: element.label,
      performanceIndex: Math.round((performanceIndex ?? 1) * 100) / 100,
      posts: element.occurrencesInWindow,
      creators: element.fitsCount,
      evidence: element.evidence,
    }));

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

export async function buildTerritoryHookContextForUser(
  userId: string,
): Promise<TerritoryHookContext | null> {
  if (!mongoose.Types.ObjectId.isValid(userId)) return null;
  await connectToDatabase();
  const profiles = await loadMapProfiles([userId]);
  const territoryId = profiles.get(userId)?.primaryTerritoryId;
  if (!territoryId) return null;
  if (!territoryHookEvidenceAllowsTerritory(territoryId)) return null;

  const snapshot = await WeeklyTerritoryReportModel.findOne({
    territoryId,
    "elements.kind": "gancho",
  })
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

  return snapshot ? territoryHookContextFromSnapshot(snapshot) : null;
}
