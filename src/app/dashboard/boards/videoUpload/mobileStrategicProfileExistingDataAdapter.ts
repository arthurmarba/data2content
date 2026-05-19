import type { HomeSummaryResponse, MediaKitCardData, HomeCommunitySummary, HomePlanSummary } from "../../home/types";
import type { MobileStrategicProfileInput } from "./mobileStrategicProfileMapping";
import {
  resolveMobileStrategicProfileState,
  sanitizeMobileStrategicProfileText,
} from "./mobileStrategicProfileStateContract";
import type { VideoNarrativeDiagnosisAccessLevel } from "./videoNarrativeDiagnosisLearningModel";

export interface MobileStrategicProfileExistingDataAdapterInput {
  sessionUser?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    instagramConnected?: boolean | null;
    instagramUsername?: string | null;
    planStatus?: string | null;
    proTrialStatus?: string | null;
    isNewUserForOnboarding?: boolean | null;
    onboardingCompletedAt?: string | null;
  } | null;
  homeSummary?: HomeSummaryResponse | null;
  mediaKit?: MediaKitCardData | null;
  community?: HomeCommunitySummary | null;
  plan?: HomePlanSummary | null;
  profileHref?: string | null;
  analyzeVideoHref?: string | null;
  communityHref?: string | null;
  mediaKitPublicUrl?: string | null;
  mediaKitEditUrl?: string | null;
  mediaKitShareUrl?: string | null;
  diagnosisOverrideState?: string | null;
  createdAt?: string | null;
}

export interface MobileStrategicProfileExistingDataAdapterResult {
  stateInput: any;
  profileInput: MobileStrategicProfileInput;
  resolvedDisplayName: string;
  resolvedHandle: string | null;
  resolvedAvatarUrl: string | null;
  resolvedBio: string;
  resolvedInstagramConnected: boolean;
  resolvedInstagramUsername: string | null;
  resolvedPlanStatus: string;
  resolvedHasPremiumAccess: boolean;
  resolvedMediaKitState: "available" | "unavailable" | "connect_instagram_required";
  resolvedMediaKitShareUrl: string | null;
  resolvedCommunityHref: string | null;
  sourceSummary: {
    usedSessionUser: boolean;
    usedHomeSummary: boolean;
    usedMediaKit: boolean;
    usedCommunity: boolean;
    usedPlan: boolean;
    usedOverride: boolean;
  };
  warnings: Array<
    | "missing_session_name"
    | "missing_instagram_username"
    | "missing_media_kit_link"
    | "media_kit_without_share_url"
    | "unsafe_avatar_url_ignored"
    | "no_existing_diagnosis"
  >;
  createdAt: string;
}

function clean(value: string | null | undefined): string {
  return (value || "").trim();
}

export function buildMobileStrategicProfileExistingDataAdapter(
  input: MobileStrategicProfileExistingDataAdapterInput,
): MobileStrategicProfileExistingDataAdapterResult {
  const warnings: MobileStrategicProfileExistingDataAdapterResult["warnings"] = [];
  const sourceSummary = {
    usedSessionUser: false,
    usedHomeSummary: false,
    usedMediaKit: false,
    usedCommunity: false,
    usedPlan: false,
    usedOverride: false,
  };

  const session = input.sessionUser;
  if (session) {
    sourceSummary.usedSessionUser = true;
  }
  if (input.homeSummary) {
    sourceSummary.usedHomeSummary = true;
  }
  if (input.mediaKit || input.homeSummary?.mediaKit) {
    sourceSummary.usedMediaKit = true;
  }
  if (input.community || input.homeSummary?.community) {
    sourceSummary.usedCommunity = true;
  }
  if (input.plan || input.homeSummary?.plan) {
    sourceSummary.usedPlan = true;
  }
  if (input.diagnosisOverrideState) {
    sourceSummary.usedOverride = true;
  }

  // 1. Resolve Display Name
  let resolvedDisplayName = "Creator";
  if (session?.name) {
    resolvedDisplayName = clean(session.name);
  } else if (session?.email) {
    const parts = session.email.split("@");
    if (parts[0]) {
      resolvedDisplayName = parts[0];
    }
    warnings.push("missing_session_name");
  } else {
    warnings.push("missing_session_name");
  }
  resolvedDisplayName = sanitizeMobileStrategicProfileText(resolvedDisplayName);

  // 2. Resolve Display Handle
  let resolvedHandle: string | null = null;
  const rawInstagramUsername = session?.instagramUsername || null;
  if (rawInstagramUsername) {
    resolvedHandle = `@${clean(rawInstagramUsername)}`;
  } else {
    warnings.push("missing_instagram_username");
  }

  // 3. Resolve Avatar Url
  let resolvedAvatarUrl: string | null = null;
  const rawImage = session?.image || null;
  if (rawImage) {
    if (rawImage.startsWith("data:") && rawImage.length > 1024) {
      warnings.push("unsafe_avatar_url_ignored");
    } else {
      resolvedAvatarUrl = clean(rawImage);
    }
  }

  // 4. Resolve Instagram Connection
  const resolvedInstagramConnected = Boolean(session?.instagramConnected);
  const resolvedInstagramUsername = rawInstagramUsername ? clean(rawInstagramUsername) : null;

  // 5. Resolve Plan and Premium Access
  let resolvedHasPremiumAccess = false;
  let resolvedPlanStatus = "inactive";

  const summaryPlan = input.plan || input.homeSummary?.plan;
  if (summaryPlan) {
    resolvedHasPremiumAccess = Boolean(
      summaryPlan.hasPremiumAccess ||
      summaryPlan.isPro ||
      summaryPlan.trial?.active
    );
    resolvedPlanStatus = clean(summaryPlan.status || summaryPlan.normalizedStatus || "inactive");
  } else if (session?.planStatus) {
    const status = clean(session.planStatus).toLowerCase();
    resolvedPlanStatus = status;
    resolvedHasPremiumAccess =
      status !== "inactive" &&
      status !== "canceled" &&
      status !== "cancelled" &&
      status !== "";
  }

  // 6. Resolve Mídia Kit
  let resolvedMediaKitState: MobileStrategicProfileExistingDataAdapterResult["resolvedMediaKitState"] = "unavailable";
  let resolvedMediaKitShareUrl: string | null = null;

  const summaryMediaKit = input.mediaKit || input.homeSummary?.mediaKit;
  const inputShareUrl = input.mediaKitShareUrl || input.mediaKitPublicUrl || null;

  if (summaryMediaKit) {
    resolvedMediaKitShareUrl = summaryMediaKit.shareUrl || inputShareUrl || null;
    if (summaryMediaKit.hasMediaKit) {
      if (resolvedMediaKitShareUrl) {
        resolvedMediaKitState = "available";
      } else {
        resolvedMediaKitState = "available";
        warnings.push("media_kit_without_share_url");
      }
    } else if (!resolvedInstagramConnected) {
      resolvedMediaKitState = "connect_instagram_required";
    } else {
      resolvedMediaKitState = "unavailable";
    }
  } else {
    // Fallback sem card do mídia kit
    resolvedMediaKitShareUrl = inputShareUrl;
    if (resolvedMediaKitShareUrl) {
      resolvedMediaKitState = "available";
    } else if (!resolvedInstagramConnected) {
      resolvedMediaKitState = "connect_instagram_required";
    } else {
      resolvedMediaKitState = "unavailable";
    }
  }

  if (resolvedMediaKitState === "available" && !resolvedMediaKitShareUrl) {
    warnings.push("missing_media_kit_link");
  }

  // 7. Resolve Comunidade Href
  let resolvedCommunityHref: string | null = null;
  const summaryCommunity = input.community || input.homeSummary?.community;
  if (input.communityHref) {
    resolvedCommunityHref = clean(input.communityHref);
  } else if (summaryCommunity?.vip?.inviteUrl) {
    resolvedCommunityHref = clean(summaryCommunity.vip.inviteUrl);
  } else if (summaryCommunity?.free?.inviteUrl) {
    resolvedCommunityHref = clean(summaryCommunity.free.inviteUrl);
  }

  // 8. Resolve Bio
  let resolvedBio = "Analise seu primeiro vídeo para começar seu diagnóstico como creator.";
  if (resolvedInstagramConnected || resolvedInstagramUsername) {
    resolvedBio = "Seu Perfil Estratégico mostra o que a D2C já entendeu sobre sua narrativa.";
  }
  resolvedBio = sanitizeMobileStrategicProfileText(resolvedBio);

  // 9. Resolve Access Level
  let accessLevel: VideoNarrativeDiagnosisAccessLevel = "free";
  if (resolvedHasPremiumAccess) {
    accessLevel = resolvedInstagramConnected ? "instagram_optimized" : "premium";
  }

  // 10. Diagnosis fallback and warnings
  warnings.push("no_existing_diagnosis");

  const createdAt = input.createdAt || new Date().toISOString();

  // Resolve o estado usando o contrato de estado do Perfil Estratégico
  const stateInput = {
    isAuthenticated: Boolean(session),
    userName: resolvedDisplayName,
    userHandle: resolvedHandle,
    userImage: resolvedAvatarUrl,
    instagramConnected: resolvedInstagramConnected,
    instagramUsername: resolvedInstagramUsername,
    accessLevel,
    planStatus: resolvedPlanStatus,
    hasPremiumAccess: resolvedHasPremiumAccess,
    diagnosisPresentation: null,
    hasMediaKit: resolvedMediaKitState === "available",
    mediaKitShareUrl: resolvedMediaKitShareUrl,
    createdAt,
  };

  const state = resolveMobileStrategicProfileState(stateInput);

  const profileInput: MobileStrategicProfileInput = {
    state,
    diagnosisPresentation: null,
    creatorBio: resolvedBio,
    mediaKitShareUrl: resolvedMediaKitShareUrl,
    mediaKitEditUrl: input.mediaKitEditUrl || (resolvedInstagramConnected ? "/dashboard/media-kit" : null),
    mediaKitPublicUrl: resolvedMediaKitShareUrl,
    profileHref: input.profileHref || "/dashboard/boards/mobile-profile",
    analyzeVideoHref: input.analyzeVideoHref || "/dashboard/boards/mobile-profile",
    communityHref: resolvedCommunityHref || "/dashboard/community",
    createdAt,
  };

  return {
    stateInput,
    profileInput,
    resolvedDisplayName,
    resolvedHandle,
    resolvedAvatarUrl,
    resolvedBio,
    resolvedInstagramConnected,
    resolvedInstagramUsername,
    resolvedPlanStatus,
    resolvedHasPremiumAccess,
    resolvedMediaKitState,
    resolvedMediaKitShareUrl,
    resolvedCommunityHref,
    sourceSummary,
    warnings,
    createdAt,
  };
}
