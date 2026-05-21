import {
  resolveMobileStrategicProfileState,
  type MobileStrategicProfilePrimaryIntent,
} from "../../../videoUpload/mobileStrategicProfileStateContract";
import {
  buildMobileStrategicProfile,
  type MobileStrategicProfile,
} from "../../../videoUpload/mobileStrategicProfileMapping";
import { MOBILE_COMMUNITY_ROUTE } from "../../../videoUpload/mobileStrategicProfileRoutes";
import type { VideoNarrativeDiagnosisAccessLevel } from "../../../videoUpload/videoNarrativeDiagnosisLearningModel";
import { buildVideoNarrativeAppPreviewScenario } from "../buildVideoNarrativeAppPreviewScenario";

export type MobileStrategicProfilePreviewFixtureState =
  | "anonymous_view_profile"
  | "anonymous_analyze_video"
  | "account_only"
  | "first_reading_free"
  | "premium_without_instagram"
  | "instagram_optimized"
  | "media_kit_available";

export const MOBILE_STRATEGIC_PROFILE_PREVIEW_STATES: MobileStrategicProfilePreviewFixtureState[] = [
  "anonymous_view_profile",
  "anonymous_analyze_video",
  "account_only",
  "first_reading_free",
  "premium_without_instagram",
  "instagram_optimized",
  "media_kit_available",
];

export interface MobileStrategicProfilePreviewFixture {
  id: MobileStrategicProfilePreviewFixtureState;
  label: string;
  profile: MobileStrategicProfile;
}

function first(value?: string | string[] | null): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function resolveFixtureState(value?: string | string[] | null): MobileStrategicProfilePreviewFixtureState {
  const id = first(value);
  return MOBILE_STRATEGIC_PROFILE_PREVIEW_STATES.find((state) => state === id) ?? "first_reading_free";
}

function scenarioFor(access: VideoNarrativeDiagnosisAccessLevel, instagram: "connected" | "disconnected") {
  return buildVideoNarrativeAppPreviewScenario({
    stage: "diagnosis_ready",
    scenario: access === "premium" ? "brand" : "skincare",
    access,
    instagram,
  });
}

function buildAnonymousFixture(params: {
  id: MobileStrategicProfilePreviewFixtureState;
  label: string;
  intent: MobileStrategicProfilePrimaryIntent;
}): MobileStrategicProfilePreviewFixture {
  const state = resolveMobileStrategicProfileState({
    isAuthenticated: false,
    primaryIntent: params.intent,
    userName: "Creator",
  });

  return {
    id: params.id,
    label: params.label,
    profile: buildMobileStrategicProfile({
      state,
      loginHref: "/login",
      profileHref: "/dashboard/profile",
      analyzeVideoHref: "/dashboard/boards/mobile-strategic-profile-preview?state=account_only",
      communityHref: MOBILE_COMMUNITY_ROUTE,
      createdAt: "2026-05-19T00:00:00.000Z",
    }),
  };
}

function buildAuthenticatedFixture(params: {
  id: MobileStrategicProfilePreviewFixtureState;
  label: string;
  accessLevel?: VideoNarrativeDiagnosisAccessLevel;
  instagramConnected?: boolean;
  hasPremiumAccess?: boolean;
  hasMediaKit?: boolean;
  mediaKitShareUrl?: string | null;
}): MobileStrategicProfilePreviewFixture {
  const preview = params.accessLevel
    ? scenarioFor(params.accessLevel, params.instagramConnected ? "connected" : "disconnected")
    : null;
  const state = resolveMobileStrategicProfileState({
    isAuthenticated: true,
    userName: "Ana Creator",
    userHandle: "@ana.creator",
    userImage: null,
    instagramConnected: params.instagramConnected ?? false,
    instagramUsername: params.instagramConnected ? "@ana.creator" : null,
    accessLevel: params.accessLevel ?? null,
    hasPremiumAccess: params.hasPremiumAccess ?? false,
    diagnosisPresentation: preview?.diagnosisPresentation ?? null,
    hasMediaKit: params.hasMediaKit ?? false,
    mediaKitShareUrl: params.mediaKitShareUrl ?? null,
    createdAt: "2026-05-19T00:00:00.000Z",
  });

  return {
    id: params.id,
    label: params.label,
    profile: buildMobileStrategicProfile({
      state,
      diagnosisPresentation: preview?.diagnosisPresentation ?? null,
      creatorBio: "Diagnóstico vivo em evolução para posicionamento, narrativa e próximo passo.",
      mediaKitShareUrl: params.mediaKitShareUrl ?? null,
      mediaKitEditUrl: params.hasMediaKit ? "/dashboard/media-kit" : null,
      mediaKitPublicUrl: params.hasMediaKit ? "/mediakit/ana-preview" : null,
      profileHref: "/dashboard/profile",
      analyzeVideoHref: "/dashboard/boards/video-narrative-app-preview",
      communityHref: MOBILE_COMMUNITY_ROUTE,
      createdAt: "2026-05-19T00:00:00.000Z",
    }),
  };
}

export function buildMobileStrategicProfilePreviewFixture(params: {
  state?: string | string[] | null;
} = {}): MobileStrategicProfilePreviewFixture {
  const selected = resolveFixtureState(params.state);

  if (selected === "anonymous_view_profile") {
    return buildAnonymousFixture({
      id: selected,
      label: "Anônimo — Perfil",
      intent: "view_profile",
    });
  }

  if (selected === "anonymous_analyze_video") {
    return buildAnonymousFixture({
      id: selected,
      label: "Anônimo — Analisar vídeo",
      intent: "analyze_video",
    });
  }

  if (selected === "account_only") {
    return buildAuthenticatedFixture({
      id: selected,
      label: "Conta criada",
    });
  }

  if (selected === "premium_without_instagram") {
    return buildAuthenticatedFixture({
      id: selected,
      label: "Premium sem Instagram",
      accessLevel: "premium",
      hasPremiumAccess: true,
      instagramConnected: false,
    });
  }

  if (selected === "instagram_optimized") {
    return buildAuthenticatedFixture({
      id: selected,
      label: "Instagram otimizado",
      accessLevel: "instagram_optimized",
      hasPremiumAccess: true,
      instagramConnected: true,
    });
  }

  if (selected === "media_kit_available") {
    return buildAuthenticatedFixture({
      id: selected,
      label: "Mídia Kit ativo",
      accessLevel: "instagram_optimized",
      hasPremiumAccess: true,
      instagramConnected: true,
      hasMediaKit: true,
      mediaKitShareUrl: "/mediakit/ana-preview",
    });
  }

  return buildAuthenticatedFixture({
    id: "first_reading_free",
    label: "Primeira leitura free",
    accessLevel: "free",
    instagramConnected: false,
  });
}
