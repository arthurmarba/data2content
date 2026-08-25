import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { resolveCreatorAvatar } from "@/app/lib/avatar/creatorAvatar";
import {
  buildViewerTokens,
  complementarityScore,
  findDistinctLabels,
  findSharedLabels,
} from "@/app/dashboard/boards/videoUpload/collabComplementarity";
import {
  computeCollabMode,
  generateCollabContext,
  type CollabMode,
} from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";
import CollabInterest from "@/app/models/CollabInterest";
import MapaSeed from "@/app/models/MapaSeed";
import UserModel from "@/app/models/User";
import { D2C_INTELLIGENCE_SCHEMA_VERSION } from "./intelligenceContract";

type AnyRecord = Record<string, any>;

function cleanStrings(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean))].slice(0, limit);
}

function recordingFallback(params: {
  topic: string;
  format: string;
  mode: CollabMode;
  shared: string[];
  distinct: string[];
}) {
  const common = params.shared[0] || params.topic || "o tema em comum";
  const complement = params.distinct[0] || "um ponto de vista complementar";
  if (params.mode === "presencial") {
    return `Gravem um ${params.format} juntos: um apresenta ${common} e o outro acrescenta ${complement}.`;
  }
  return `Cada creator grava sua parte do ${params.format}; a edição conecta ${common} a ${complement}.`;
}

export async function suggestMcpCollabCreators(params: {
  userId: string;
  topic?: string;
  goal?: string;
  format?: "reel" | "carousel" | "photo" | "story" | "any";
  mode?: "any" | CollabMode;
  limit?: number;
}) {
  if (!Types.ObjectId.isValid(params.userId)) return null;
  await connectToDatabase();
  const viewerId = new Types.ObjectId(params.userId);
  const limit = Math.max(1, Math.min(5, Math.trunc(params.limit ?? 3)));
  const [viewerSeed, viewerUser, dismissed, historicallyInterested] = await Promise.all([
    MapaSeed.findOne({ userId: viewerId })
      .select("mapa.narrativa_central mapa.territorios mapa.temas mapa.assets mapa.tom mapa.formatos")
      .lean<AnyRecord | null>(),
    UserModel.findById(viewerId).select("location").lean<AnyRecord | null>(),
    CollabInterest.find({
      user: viewerId,
      decision: "dismissed",
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).select("partner").lean<AnyRecord[]>(),
    CollabInterest.distinct("user", {
      decision: "interested",
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }),
  ]);
  const viewerMap = viewerSeed?.mapa;
  const viewerNarrative = typeof viewerMap?.narrativa_central === "string" ? viewerMap.narrativa_central.trim() : "";
  const viewerTerritories = cleanStrings(viewerMap?.territorios);
  if (!viewerNarrative && viewerTerritories.length === 0) {
    return {
      schemaVersion: "mcp_collab_suggestions_v1",
      intelligenceSchemaVersion: D2C_INTELLIGENCE_SCHEMA_VERSION,
      items: [],
      reason: "creator_map_required",
    };
  }

  const dismissedIds = dismissed.map((item) => item.partner).filter(Boolean);
  const candidateUsers = await UserModel.find({
    _id: { $ne: viewerId, ...(dismissedIds.length ? { $nin: dismissedIds } : {}) },
    planStatus: { $in: ["active", "non_renewing"] },
    $or: [
      { collabDiscoveryOptIn: true },
      { _id: { $in: historicallyInterested } },
    ],
  })
    .select("_id name username instagramUsername image providerImage profile_picture_url isInstagramConnected mediaKitSlug location")
    .limit(200)
    .lean<AnyRecord[]>();
  if (candidateUsers.length === 0) {
    return {
      schemaVersion: "mcp_collab_suggestions_v1",
      intelligenceSchemaVersion: D2C_INTELLIGENCE_SCHEMA_VERSION,
      items: [],
      reason: "no_opted_in_candidates",
      eligibility: { activeSubscriber: true, explicitCollabOptIn: true },
    };
  }

  const byId = new Map(candidateUsers.map((user) => [String(user._id), user]));
  const seeds = await MapaSeed.find({
    userId: { $in: candidateUsers.map((user) => user._id) },
    "mapa.narrativa_central": { $exists: true, $ne: "" },
  })
    .select("userId mapa.narrativa_central mapa.territorios mapa.temas mapa.assets mapa.tom mapa.formatos")
    .lean<AnyRecord[]>();

  const topic = (params.topic ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
  const format = params.format && params.format !== "any" ? params.format : "reel";
  const viewerLabels = [...viewerTerritories, ...cleanStrings(viewerMap?.temas), topic].filter(Boolean);
  const viewerTokens = buildViewerTokens([viewerNarrative, ...viewerLabels]);
  const ranked = seeds.flatMap((seed) => {
    const user = byId.get(String(seed.userId));
    if (!user) return [];
    const avatarUrl = resolveCreatorAvatar(user);
    if (!avatarUrl) return [];
    const narrative = typeof seed.mapa?.narrativa_central === "string" ? seed.mapa.narrativa_central.trim() : "";
    const territories = cleanStrings(seed.mapa?.territorios);
    const themes = cleanStrings(seed.mapa?.temas);
    if (!narrative || territories.length === 0) return [];
    const candidateText = [narrative, ...territories, ...themes].join(" ");
    const score = complementarityScore(viewerTokens, candidateText)
      + (topic && buildViewerTokens([candidateText]).size > 0
        ? complementarityScore(buildViewerTokens([topic]), candidateText)
        : 0);
    const mode = computeCollabMode(viewerUser?.location ?? null, user.location ?? null);
    if (params.mode && params.mode !== "any" && params.mode !== mode) return [];
    return [{ user, seed, narrative, territories, themes, avatarUrl, score, mode }];
  }).sort((a, b) => b.score - a.score).slice(0, limit);

  const items = await Promise.all(ranked.map(async (candidate) => {
    const sharedSignals = findSharedLabels(viewerLabels, [candidate.narrative, ...candidate.territories].join(" "), 3);
    const complementarySignals = findDistinctLabels(viewerLabels, [...candidate.territories, ...candidate.themes], 3);
    const fallbackFit = sharedSignals.length
      ? `Vocês se encontram em ${sharedSignals[0]}; a outra pessoa acrescenta ${complementarySignals[0] || "um ponto de vista complementar"}.`
      : `As narrativas se complementam pelo contraste de experiências em ${topic || candidate.territories[0]}.`;
    const fallbackRecording = recordingFallback({
      topic,
      format,
      mode: candidate.mode,
      shared: sharedSignals,
      distinct: complementarySignals,
    });
    const generated = await generateCollabContext(
      viewerNarrative,
      candidate.narrative,
      topic || sharedSignals[0] || viewerTerritories[0] || "",
      fallbackFit,
    );
    const username = candidate.user.username ?? candidate.user.instagramUsername ?? null;
    return {
      publicProfile: {
        name: candidate.user.name ?? "Creator",
        username,
        avatarUrl: candidate.avatarUrl,
        mediaKitUrl: candidate.user.mediaKitSlug
          ? `https://data2content.ai/mediakit/${candidate.user.mediaKitSlug}`
          : null,
      },
      fitReason: generated.fitReason,
      sharedSignals,
      complementarySignals,
      recordingDirection: generated.recordingIdea || fallbackRecording,
      mode: candidate.mode,
      suggestedFormat: format,
      confidence: candidate.score >= 9 ? "high" : candidate.score >= 5 ? "medium" : "low",
      evidence: {
        sharedSignalsCount: sharedSignals.length,
        complementarySignalsCount: complementarySignals.length,
        source: "confirmed_creator_maps",
      },
    };
  }));

  return {
    schemaVersion: "mcp_collab_suggestions_v1",
    intelligenceSchemaVersion: D2C_INTELLIGENCE_SCHEMA_VERSION,
    request: { topic: topic || null, goal: params.goal ?? null, format, mode: params.mode ?? "any", limit },
    items,
    eligibility: {
      activeSubscriber: true,
      explicitCollabOptIn: true,
      preciseLocationExposed: false,
      privateMetricsExposed: false,
    },
    coverage: {
      optedInCandidates: candidateUsers.length,
      candidatesWithMap: seeds.length,
      returned: items.length,
    },
  };
}
