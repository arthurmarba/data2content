import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import UserModel from "@/app/models/User";
import MetricModel from "@/app/models/Metric";
import AudienceDemographicSnapshotModel from "@/app/models/demographics/AudienceDemographicSnapshot";
import { getMcpAppBaseUrl } from "./config";
import {
  analyzeMcpCreatorPeriod,
  getMcpCreatorIntelligenceSnapshot,
  researchMcpInspirationContent,
  type McpInspirationResearchParams,
} from "./catalog";

const CREATOR_REF_PATTERN = /^creator:([a-f0-9]{24})$/i;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compactText(value: unknown, maxLength: number): string {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function isoDateOrNull(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function adminCreatorUrl(userId: string): string {
  return `${getMcpAppBaseUrl()}/admin/creators-management?creatorId=${encodeURIComponent(userId)}`;
}

export function parseAdminCreatorRef(value: string): string | null {
  const match = value.trim().match(CREATOR_REF_PATTERN);
  if (!match?.[1] || !mongoose.isValidObjectId(match[1])) return null;
  return match[1].toLowerCase();
}

export async function searchMcpAdminCreators(query: string, limit: number) {
  await connectToDatabase();
  const normalized = compactText(query, 160).replace(/^@/, "");
  if (normalized.length < 2) return [];

  const projection = {
    _id: 1,
    name: 1,
    username: 1,
    profile_picture_url: 1,
    followers_count: 1,
    isInstagramConnected: 1,
    planStatus: 1,
  } as const;
  const isObjectId = mongoose.isValidObjectId(normalized) && normalized.length === 24;
  const users = isObjectId
    ? await UserModel.find({ _id: new Types.ObjectId(normalized) }, projection).limit(1).lean()
    : await UserModel.find(
        {
          $or: [
            { name: new RegExp(escapeRegex(normalized), "i") },
            { username: new RegExp(escapeRegex(normalized), "i") },
            { email: new RegExp(escapeRegex(normalized), "i") },
          ],
        },
        projection,
      )
        .sort({ isInstagramConnected: -1, followers_count: -1, name: 1 })
        .limit(Math.min(20, Math.max(1, limit)))
        .lean();

  return users.map((user) => {
    const id = String(user._id);
    const username = compactText(user.username, 100) || null;
    const name = compactText(user.name, 160) || username || "Creator Data2Content";
    return {
      id: `creator:${id}`,
      title: username ? `${name} (@${username})` : name,
      url: adminCreatorUrl(id),
      metadata: {
        username,
        instagramConnected: Boolean(user.isInstagramConnected),
        followersCount: typeof user.followers_count === "number" ? user.followers_count : null,
        subscriptionStatus: compactText(user.planStatus, 60) || null,
      },
    };
  });
}

export async function getMcpAdminCreatorOverview(creatorRef: string) {
  const userId = parseAdminCreatorRef(creatorRef);
  if (!userId) return null;
  await connectToDatabase();
  const userObjectId = new Types.ObjectId(userId);
  const [user, totalContents, firstContent, latestContent, demographicSnapshot] = await Promise.all([
    UserModel.findById(userObjectId)
      .select(
        "name username biography profile_picture_url followers_count follows_count media_count " +
          "isInstagramConnected instagramAccountId planStatus currentPeriodEnd createdAt " +
          "lastInstagramSyncAttempt lastInstagramSyncSuccess",
      )
      .lean(),
    MetricModel.countDocuments({ user: userObjectId }),
    MetricModel.findOne({ user: userObjectId }).sort({ postDate: 1, _id: 1 }).select("postDate").lean(),
    MetricModel.findOne({ user: userObjectId })
      .sort({ postDate: -1, updatedAt: -1, _id: -1 })
      .select("postDate updatedAt")
      .lean(),
    AudienceDemographicSnapshotModel.findOne({ user: userObjectId })
      .sort({ recordedAt: -1, _id: -1 })
      .select("recordedAt")
      .lean(),
  ]);
  if (!user) return null;

  const instagramConnected = Boolean(user.isInstagramConnected && user.instagramAccountId);
  const lastDataUpdateAt = isoDateOrNull(latestContent?.updatedAt ?? latestContent?.postDate);
  const dataState = instagramConnected ? "connected" : totalContents > 0 ? "historical_only" : "no_content_data";
  const warnings = [
    ...(!instagramConnected ? ["instagram_disconnected"] : []),
    ...(totalContents === 0 ? ["no_content_records"] : []),
    ...(!demographicSnapshot ? ["audience_demographics_unavailable"] : []),
  ];

  return {
    schemaVersion: "admin_creator_overview_v1" as const,
    creator: {
      id: `creator:${userId}`,
      name: compactText(user.name, 160) || null,
      username: compactText(user.username, 100) || null,
      biography: compactText(user.biography, 1_000) || null,
      avatarUrl: compactText(user.profile_picture_url, 1_000) || null,
      followersCount: typeof user.followers_count === "number" ? user.followers_count : null,
      followsCount: typeof user.follows_count === "number" ? user.follows_count : null,
      instagramMediaCount: typeof user.media_count === "number" ? user.media_count : null,
      url: adminCreatorUrl(userId),
    },
    account: {
      instagramConnected,
      subscriptionStatus: compactText(user.planStatus, 60) || null,
      subscriptionValidUntil: isoDateOrNull(user.currentPeriodEnd),
      registrationDate: isoDateOrNull(user.createdAt),
      lastInstagramSyncAttempt: isoDateOrNull(user.lastInstagramSyncAttempt),
      lastInstagramSyncSucceeded:
        typeof user.lastInstagramSyncSuccess === "boolean" ? user.lastInstagramSyncSuccess : null,
    },
    coverage: {
      dataState,
      totalContentRecords: totalContents,
      firstContentDate: isoDateOrNull(firstContent?.postDate),
      lastContentDate: isoDateOrNull(latestContent?.postDate),
      lastDataUpdateAt,
      latestAudienceSnapshotAt: isoDateOrNull(demographicSnapshot?.recordedAt),
      warnings,
    },
    receipt: {
      generatedAt: new Date().toISOString(),
      source: "data2content_admin_creator_inventory" as const,
      targetCreatorId: userId,
      mustNotInferUnavailableData: true as const,
    },
  };
}

function sortedBreakdown(value: unknown) {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
    .sort((left, right) => right[1] - left[1])
    .slice(0, 25)
    .map(([label, value]) => ({ label, value }));
}

function sanitizeDemographicGroup(value: unknown) {
  const group = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    age: sortedBreakdown(group.age),
    gender: sortedBreakdown(group.gender),
    country: sortedBreakdown(group.country),
    city: sortedBreakdown(group.city),
  };
}

export async function getMcpAdminCreatorAudience(creatorRef: string) {
  const userId = parseAdminCreatorRef(creatorRef);
  if (!userId) return null;
  await connectToDatabase();
  const [userExists, snapshot] = await Promise.all([
    UserModel.exists({ _id: new Types.ObjectId(userId) }),
    AudienceDemographicSnapshotModel.findOne({ user: new Types.ObjectId(userId) })
      .sort({ recordedAt: -1, _id: -1 })
      .select("recordedAt demographics")
      .lean(),
  ]);
  if (!userExists) return null;

  const demographics = snapshot?.demographics as Record<string, unknown> | undefined;
  return {
    schemaVersion: "admin_creator_audience_v1" as const,
    creatorRef: `creator:${userId}`,
    recordedAt: isoDateOrNull(snapshot?.recordedAt),
    followerDemographics: sanitizeDemographicGroup(demographics?.follower_demographics),
    engagedAudienceDemographics: sanitizeDemographicGroup(demographics?.engaged_audience_demographics),
    coverage: {
      available: Boolean(snapshot),
      warnings: snapshot ? [] : ["audience_demographics_unavailable"],
    },
    receipt: {
      generatedAt: new Date().toISOString(),
      source: "data2content_audience_demographic_snapshot" as const,
      targetCreatorId: userId,
      aggregatedOnly: true as const,
      mustNotInferMissingBreakdowns: true as const,
    },
  };
}

export async function compareMcpAdminCreators(params: {
  creatorRefs: string[];
  startDate: string;
  endDate: string;
  timeZone: string;
}) {
  const targetIds = params.creatorRefs.map(parseAdminCreatorRef);
  if (targetIds.some((value) => !value)) return null;

  const rows = await Promise.all(
    (targetIds as string[]).map(async (userId) => {
      const [overview, period, intelligence] = await Promise.all([
        getMcpAdminCreatorOverview(`creator:${userId}`),
        analyzeMcpCreatorPeriod({
          userId,
          startDate: params.startDate,
          endDate: params.endDate,
          timeZone: params.timeZone,
          format: "all",
          evidenceLimit: 1,
        }),
        getMcpCreatorIntelligenceSnapshot({ userId, focus: "comparação administrativa", lookbackDays: 180 }),
      ]);
      if (!overview) return null;
      return {
        creator: overview.creator,
        accountCoverage: overview.coverage,
        period: {
          inventory: period.inventory,
          coverage: period.coverage,
          receipt: period.receipt,
        },
        intelligenceCoverage: intelligence.coverage,
      };
    }),
  );
  const creators = rows.filter((row): row is NonNullable<typeof row> => Boolean(row));
  return {
    schemaVersion: "admin_creator_comparison_v1" as const,
    requestedPeriod: {
      startDate: params.startDate,
      endDate: params.endDate,
      timeZone: params.timeZone,
    },
    creators,
    coverage: {
      requestedCreators: params.creatorRefs.length,
      comparedCreators: creators.length,
      warnings: creators.length === params.creatorRefs.length ? [] : ["one_or_more_creators_unavailable"],
    },
    receipt: {
      generatedAt: new Date().toISOString(),
      source: "data2content_admin_cross_creator_analysis" as const,
      mustNotRankWithoutComparableCoverage: true as const,
    },
  };
}

export async function researchMcpAdminCreatorInspirations(params: {
  creatorRef: string;
  mode: McpInspirationResearchParams["mode"];
  query: string;
  filters: McpInspirationResearchParams["filters"];
  periodDays: number;
  limit: number;
}) {
  const userId = parseAdminCreatorRef(params.creatorRef);
  if (!userId) return null;
  await connectToDatabase();
  const userExists = await UserModel.exists({ _id: new Types.ObjectId(userId) });
  if (!userExists) return null;
  return researchMcpInspirationContent({
    userId,
    mode: params.mode,
    query: params.query,
    filters: params.filters,
    periodDays: params.periodDays,
    limit: params.limit,
  });
}
