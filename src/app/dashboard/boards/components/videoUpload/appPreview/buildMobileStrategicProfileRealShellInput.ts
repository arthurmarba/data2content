import type { MobileStrategicProfileInput } from "../../../videoUpload/mobileStrategicProfileMapping";
import {
  resolveMobileStrategicProfileState,
  type MobileStrategicProfilePrimaryIntent,
} from "../../../videoUpload/mobileStrategicProfileStateContract";
import { buildMobileStrategicProfile } from "../../../videoUpload/mobileStrategicProfileMapping";
import type { VideoNarrativeDiagnosisAccessLevel } from "../../../videoUpload/videoNarrativeDiagnosisLearningModel";
import { buildMobileStrategicProfilePreviewFixture } from "./buildMobileStrategicProfilePreviewFixture";

export function buildMobileStrategicProfileRealShellInput(params: {
  session: any;
  stateQuery?: string | null;
}): MobileStrategicProfileInput {
  const user = params.session?.user;
  const isAuthenticated = Boolean(user);

  if (!isAuthenticated) {
    const state = resolveMobileStrategicProfileState({
      isAuthenticated: false,
      primaryIntent: "view_profile",
      userName: "Creator",
    });

    return {
      state,
      loginHref: "/login?intent=strategic_profile",
      profileHref: "/dashboard/boards/mobile-profile",
      analyzeVideoHref: "/dashboard/boards/mobile-profile",
      communityHref: "/dashboard/community",
      createdAt: new Date().toISOString(),
    };
  }

  // Se o query param 'state' estiver definido, carregamos a fixture para fins de teste/QA sob a feature flag
  if (params.stateQuery) {
    const fixture = buildMobileStrategicProfilePreviewFixture({ state: params.stateQuery });
    // Ajusta dados dinâmicos da sessão sobre a fixture para ficar honesto
    fixture.profile.header.identity.displayName = user.name || fixture.profile.header.identity.displayName;
    fixture.profile.header.title = user.name || fixture.profile.header.title;
    return {
      state: fixture.profile.state,
      diagnosisPresentation: fixture.profile.state.profileAvailability === "active" ? fixture.profile.sections[0]?.cards ? {
        hero: {
          title: fixture.profile.sections[0].cards[0]?.title || "Diagnóstico ativo",
          subtitle: fixture.profile.sections[0].cards[0]?.body || "",
        },
        priorityCards: [],
        sections: [],
        createdAt: new Date().toISOString(),
      } : null : null,
      creatorBio: "Diagnóstico em evolução para posicionamento, narrativa e próximo passo.",
      mediaKitShareUrl: user.instagramConnected ? "/mediakit/real-user" : null,
      mediaKitEditUrl: user.instagramConnected ? "/dashboard/media-kit" : null,
      mediaKitPublicUrl: user.instagramConnected ? `/mediakit/${user.instagramUsername || "user"}` : null,
      profileHref: "/dashboard/boards/mobile-profile",
      analyzeVideoHref: "/dashboard/boards/mobile-profile",
      communityHref: "/dashboard/community",
      createdAt: new Date().toISOString(),
    };
  }

  const instagramConnected = Boolean(user.instagramConnected || user.isInstagramConnected);
  const instagramUsername = user.instagramUsername || null;

  const planStatus = user.planStatus ? String(user.planStatus).toLowerCase().trim() : "inactive";
  const hasPremiumAccess =
    user.role === "admin" ||
    (planStatus !== "inactive" && planStatus !== "canceled" && planStatus !== "");

  let accessLevel: VideoNarrativeDiagnosisAccessLevel = "free";
  if (hasPremiumAccess) {
    accessLevel = instagramConnected ? "instagram_optimized" : "premium";
  }

  const state = resolveMobileStrategicProfileState({
    isAuthenticated: true,
    userName: user.name || "Criador D2C",
    userHandle: instagramUsername ? `@${instagramUsername}` : null,
    userImage: user.image || null,
    instagramConnected,
    instagramUsername,
    accessLevel,
    planStatus,
    hasPremiumAccess,
    diagnosisPresentation: null, // Sem diagnóstico real persistido ainda no MVP
    hasMediaKit: instagramConnected,
    mediaKitShareUrl: instagramConnected ? `/mediakit/${instagramUsername || "user"}` : null,
    createdAt: new Date().toISOString(),
  });

  return {
    state,
    diagnosisPresentation: null,
    creatorBio: "Seu diagnóstico vivo começa aqui.",
    mediaKitShareUrl: instagramConnected ? `/mediakit/${instagramUsername || "user"}` : null,
    mediaKitEditUrl: instagramConnected ? "/dashboard/media-kit" : null,
    mediaKitPublicUrl: instagramConnected ? `/mediakit/${instagramUsername || "user"}` : null,
    profileHref: "/dashboard/boards/mobile-profile",
    analyzeVideoHref: "/dashboard/boards/mobile-profile",
    communityHref: "/dashboard/community",
    createdAt: new Date().toISOString(),
  };
}
