export const MCP_PERIOD_ANALYSIS_VERSION = "period_analysis_v1" as const;

export type McpPeriodContentFormat = "all" | "reel" | "carousel" | "photo";
export type McpResolvedContentFormat = Exclude<McpPeriodContentFormat, "all"> | "other";

export const MCP_PERIOD_METRIC_KEYS = [
  "reach",
  "views",
  "total_interactions",
  "saved",
  "shares",
  "comments",
  "likes",
  "retention_rate",
  "ig_reels_avg_watch_time",
] as const;

export type McpPeriodMetricKey = (typeof MCP_PERIOD_METRIC_KEYS)[number];

export type McpPeriodMetricDocument = {
  _id: unknown;
  instagramMediaId?: unknown;
  description?: unknown;
  text_content?: unknown;
  postLink?: unknown;
  postDate?: unknown;
  updatedAt?: unknown;
  type?: unknown;
  format?: unknown;
  classificationStatus?: unknown;
  proposal?: unknown;
  context?: unknown;
  tone?: unknown;
  references?: unknown;
  contentIntent?: unknown;
  narrativeForm?: unknown;
  stance?: unknown;
  proofStyle?: unknown;
  sceneElements?: unknown;
  stats?: unknown;
};

type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

type CoverageSignal = {
  available: number;
  total: number;
  ratio: number;
};

export class McpPeriodValidationError extends Error {
  constructor(
    public readonly code:
      | "invalid_date"
      | "invalid_date_range"
      | "period_too_large"
      | "invalid_timezone",
    message: string,
  ) {
    super(message);
    this.name = "McpPeriodValidationError";
  }
}

function parseCalendarDate(value: string, fieldName: string): CalendarDate {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new McpPeriodValidationError("invalid_date", `${fieldName} deve usar o formato YYYY-MM-DD.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new McpPeriodValidationError("invalid_date", `${fieldName} não é uma data válida.`);
  }

  return { year, month, day };
}

function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function calendarDateMs(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

function assertTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
  } catch {
    throw new McpPeriodValidationError("invalid_timezone", "Informe um fuso horário IANA válido.");
  }
}

function timeZoneOffsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instantMs));

  const values = new Map(parts.map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(
    Number(values.get("year")),
    Number(values.get("month")) - 1,
    Number(values.get("day")),
    Number(values.get("hour")),
    Number(values.get("minute")),
    Number(values.get("second")),
  );
  return representedAsUtc - Math.floor(instantMs / 1000) * 1000;
}

function localMidnightToUtc(date: CalendarDate, timeZone: string): Date {
  const localAsUtc = calendarDateMs(date);
  let resolvedMs = localAsUtc - timeZoneOffsetMs(localAsUtc, timeZone);
  const correctedOffset = timeZoneOffsetMs(resolvedMs, timeZone);
  resolvedMs = localAsUtc - correctedOffset;
  return new Date(resolvedMs);
}

export function resolveMcpPeriodWindow(params: {
  startDate: string;
  endDate: string;
  timeZone: string;
  maxDays?: number;
}) {
  const start = parseCalendarDate(params.startDate, "startDate");
  const end = parseCalendarDate(params.endDate, "endDate");
  const startCalendarMs = calendarDateMs(start);
  const endCalendarMs = calendarDateMs(end);
  if (endCalendarMs < startCalendarMs) {
    throw new McpPeriodValidationError(
      "invalid_date_range",
      "endDate deve ser igual ou posterior a startDate.",
    );
  }

  const inclusiveDays = Math.floor((endCalendarMs - startCalendarMs) / 86_400_000) + 1;
  const maxDays = Math.max(1, Math.floor(params.maxDays ?? 366));
  if (inclusiveDays > maxDays) {
    throw new McpPeriodValidationError(
      "period_too_large",
      `O período pode ter no máximo ${maxDays} dias.`,
    );
  }

  assertTimeZone(params.timeZone);
  const startInclusive = localMidnightToUtc(start, params.timeZone);
  const endExclusive = localMidnightToUtc(addCalendarDays(end, 1), params.timeZone);

  return {
    startDate: params.startDate,
    endDate: params.endDate,
    timeZone: params.timeZone,
    inclusiveDays,
    startInclusive,
    endExclusive,
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function compactText(value: unknown, maxLength: number): string | null {
  const normalized = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!normalized) return null;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizeFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readMetric(stats: Record<string, unknown>, key: McpPeriodMetricKey): number | null {
  if (key === "views") {
    return normalizeFiniteNumber(stats.views) ?? normalizeFiniteNumber(stats.video_views);
  }
  return normalizeFiniteNumber(stats[key]);
}

export function resolveMcpContentFormat(document: McpPeriodMetricDocument): McpResolvedContentFormat {
  const type = typeof document.type === "string" ? document.type.trim().toUpperCase() : "";
  const formats = normalizeStringArray(document.format).map((value) => value.toLowerCase());

  if (type === "REEL" || type === "VIDEO" || formats.some((value) => value === "reel" || value === "long_video")) {
    return "reel";
  }
  if (type === "CAROUSEL_ALBUM" || formats.includes("carousel")) return "carousel";
  if (type === "IMAGE" || formats.includes("photo") || formats.includes("image")) return "photo";
  return "other";
}

function hasClassification(document: McpPeriodMetricDocument): boolean {
  if (document.classificationStatus === "completed") return true;
  return [
    document.proposal,
    document.context,
    document.tone,
    document.references,
    document.contentIntent,
    document.narrativeForm,
    document.stance,
    document.proofStyle,
  ].some((value) => normalizeStringArray(value).length > 0);
}

function hasSceneAnalysis(document: McpPeriodMetricDocument): boolean {
  if (!document.sceneElements || typeof document.sceneElements !== "object") return false;
  const scene = document.sceneElements as Record<string, unknown>;
  return Boolean(
    hasText(scene.provider) ||
      hasText(scene.openingLine) ||
      hasText(scene.screenTitle) ||
      normalizeStringArray(scene.subjects).length ||
      normalizeStringArray(scene.objects).length ||
      normalizeStringArray(scene.framingIds).length,
  );
}

function coverageSignal(available: number, total: number): CoverageSignal {
  return {
    available,
    total,
    ratio: total > 0 ? Number((available / total).toFixed(4)) : 0,
  };
}

export function buildMcpPeriodAnalysis(params: {
  startDate: string;
  endDate: string;
  timeZone: string;
  startInclusive: Date;
  endExclusive: Date;
  format: McpPeriodContentFormat;
  evidenceLimit: number;
  documents: McpPeriodMetricDocument[];
  generatedAt?: Date;
}) {
  const generatedAt = params.generatedAt ?? new Date();
  const sortedDocuments = [...params.documents].sort((left, right) => {
    const leftMs = toIsoDate(left.postDate) ? new Date(toIsoDate(left.postDate)!).getTime() : 0;
    const rightMs = toIsoDate(right.postDate) ? new Date(toIsoDate(right.postDate)!).getTime() : 0;
    return rightMs - leftMs;
  });
  const total = sortedDocuments.length;
  const evidenceLimit = Math.max(1, Math.floor(params.evidenceLimit));
  const evidenceDocuments = sortedDocuments.slice(0, evidenceLimit);

  const byFormat: Record<McpResolvedContentFormat, number> = {
    reel: 0,
    carousel: 0,
    photo: 0,
    other: 0,
  };
  for (const document of sortedDocuments) byFormat[resolveMcpContentFormat(document)] += 1;

  const metricsCoverage = Object.fromEntries(
    MCP_PERIOD_METRIC_KEYS.map((key) => {
      const available = sortedDocuments.reduce((count, document) => {
        const stats = document.stats && typeof document.stats === "object"
          ? (document.stats as Record<string, unknown>)
          : {};
        return count + (readMetric(stats, key) != null ? 1 : 0);
      }, 0);
      return [key, coverageSignal(available, total)];
    }),
  ) as Record<McpPeriodMetricKey, CoverageSignal>;

  const captionsAvailable = sortedDocuments.filter((document) => hasText(document.description)).length;
  const classificationsAvailable = sortedDocuments.filter(hasClassification).length;
  const scenesAvailable = sortedDocuments.filter(hasSceneAnalysis).length;
  const transcriptsAvailable = sortedDocuments.filter((document) => hasText(document.text_content)).length;
  const updatedDates = sortedDocuments.map((document) => toIsoDate(document.updatedAt)).filter(Boolean) as string[];
  const postDates = sortedDocuments.map((document) => toIsoDate(document.postDate)).filter(Boolean) as string[];

  const posts = evidenceDocuments.map((document) => {
    const stats = document.stats && typeof document.stats === "object"
      ? (document.stats as Record<string, unknown>)
      : {};
    const metricValues = Object.fromEntries(
      MCP_PERIOD_METRIC_KEYS.map((key) => [key, readMetric(stats, key)]),
    ) as Record<McpPeriodMetricKey, number | null>;
    const postLink = hasText(document.postLink) ? String(document.postLink).trim() : null;

    return {
      id: String(document._id),
      instagramMediaId: hasText(document.instagramMediaId) ? String(document.instagramMediaId).trim() : null,
      postDate: toIsoDate(document.postDate),
      format: resolveMcpContentFormat(document),
      type: hasText(document.type) ? String(document.type).trim() : null,
      captionPreview: compactText(document.description, 320),
      url: postLink,
      metrics: metricValues,
      evidence: {
        hasCaption: hasText(document.description),
        hasClassification: hasClassification(document),
        hasSceneAnalysis: hasSceneAnalysis(document),
        hasTranscript: hasText(document.text_content),
      },
    };
  });

  const warnings: string[] = [];
  if (total === 0) warnings.push("no_posts_in_period");
  if (evidenceDocuments.length < total) warnings.push("evidence_list_truncated");
  if (total > 0 && classificationsAvailable < total) warnings.push("classification_coverage_partial");
  if (total > 0 && scenesAvailable < total) warnings.push("scene_analysis_coverage_partial");
  if (total > 0 && transcriptsAvailable < total) warnings.push("transcript_coverage_partial");

  return {
    schemaVersion: MCP_PERIOD_ANALYSIS_VERSION,
    requestedPeriod: {
      startDate: params.startDate,
      endDate: params.endDate,
      timeZone: params.timeZone,
      startInclusiveUtc: params.startInclusive.toISOString(),
      endExclusiveUtc: params.endExclusive.toISOString(),
    },
    filters: {
      format: params.format,
    },
    inventory: {
      totalPosts: total,
      byFormat,
      firstPostDate: postDates.length ? postDates[postDates.length - 1]! : null,
      lastPostDate: postDates.length ? postDates[0]! : null,
      evidenceReturned: posts.length,
      evidenceTruncated: posts.length < total,
    },
    coverage: {
      counting: {
        complete: true,
        method: "all_metric_documents_in_exact_utc_window",
      },
      captions: coverageSignal(captionsAvailable, total),
      classifications: coverageSignal(classificationsAvailable, total),
      sceneAnalysis: coverageSignal(scenesAvailable, total),
      transcripts: coverageSignal(transcriptsAvailable, total),
      metrics: metricsCoverage,
      warnings,
    },
    posts,
    receipt: {
      generatedAt: generatedAt.toISOString(),
      source: "data2content_metric_inventory",
      requestFingerprint: `${params.startDate}:${params.endDate}:${params.timeZone}:${params.format}`,
      totalEvidencePosts: total,
      returnedEvidencePostIds: posts.map((post) => post.id),
      lastDataUpdateAt: updatedDates.sort().at(-1) ?? null,
      mustNotEstimate: true,
    },
  };
}
