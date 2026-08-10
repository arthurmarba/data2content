export const CREATOR_WEEKLY_REPORT_SCHEMA_VERSION = 1;

export type CreatorWeeklyReportStatus =
  | "queued"
  | "generating"
  | "ready"
  | "partial"
  | "failed";

export type CreatorWeeklyReportEvidence = "indicio" | "sinal" | "tendencia";

export type CreatorWeeklyReportDetailId =
  | "timing"
  | "scene"
  | "subjects"
  | "openings";

export interface CreatorWeeklyReportRankItem {
  id: string;
  label: string;
  nPosts: number;
  index: number | null;
  evidence: CreatorWeeklyReportEvidence;
  weeklyOccurrences: number;
}

export interface CreatorWeeklyReportRankGroup {
  id: string;
  title: string;
  subtitle: string;
  items: CreatorWeeklyReportRankItem[];
}

export interface CreatorWeeklyReportDetail {
  id: CreatorWeeklyReportDetailId;
  title: string;
  subtitle: string;
  summary: string;
  interpretation: string | null;
  coverageLabel: string;
  groups: CreatorWeeklyReportRankGroup[];
}

export interface CreatorWeeklyReportVideo {
  postId: string | null;
  postLink: string | null;
  thumbnailUrl: string | null;
  publishedAt: string;
  description: string;
  views: number | null;
  saved: number | null;
  shares: number | null;
  performanceIndex: number | null;
  openingLine: string | null;
  subject: string | null;
  place: string | null;
}

export interface CreatorWeeklyReportPayload {
  schemaVersion: number;
  weekKey: string;
  period: {
    startsAt: string;
    endsAt: string;
    rangeLabel: string;
  };
  status: CreatorWeeklyReportStatus;
  generatedAt: string;
  sourceMetricsUpdatedAt: string | null;
  coverage: {
    posts90d: number;
    postsWeek: number;
    postsWithScene: number;
    scenePercent: number;
  };
  overview: {
    summary: string;
    numbers: Array<{ value: string; label: string }>;
    observedSubjects: string[];
  };
  weeklyVideo: CreatorWeeklyReportVideo | null;
  details: CreatorWeeklyReportDetail[];
}

export interface CreatorWeeklyReportDocumentSnapshot {
  id: string;
  userId: string;
  report: CreatorWeeklyReportPayload;
  createdAt: string;
  updatedAt: string;
}

export function isCreatorWeeklyReportReady(
  report: CreatorWeeklyReportPayload | null | undefined,
): report is CreatorWeeklyReportPayload {
  return report?.status === "ready" || report?.status === "partial";
}
