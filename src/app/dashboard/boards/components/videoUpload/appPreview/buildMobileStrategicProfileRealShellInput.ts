import type { MobileStrategicProfileInput } from "../../../videoUpload/mobileStrategicProfileMapping";
import { buildMobileStrategicProfilePreviewFixture } from "./buildMobileStrategicProfilePreviewFixture";
import { buildMobileStrategicProfileExistingDataAdapter } from "../../../videoUpload/mobileStrategicProfileExistingDataAdapter";
import { buildVideoNarrativeAppPreviewScenario } from "../buildVideoNarrativeAppPreviewScenario";

function resolveOverrideLevel(stateQuery: string): {
  access: "free" | "premium" | "instagram_optimized";
  instagram: "connected" | "disconnected";
} | null {
  if (stateQuery === "instagram_optimized" || stateQuery === "media_kit_available") {
    return { access: "instagram_optimized", instagram: "connected" };
  }
  if (stateQuery === "premium_without_instagram") {
    return { access: "premium", instagram: "disconnected" };
  }
  if (stateQuery === "first_reading_free") {
    return { access: "free", instagram: "disconnected" };
  }
  return null;
}

export function buildMobileStrategicProfileRealShellInput(params: {
  session: any;
  stateQuery?: string | null;
}): MobileStrategicProfileInput {
  const user = params.session?.user;
  const isAuthenticated = Boolean(user);

  if (!isAuthenticated) {
    const res = buildMobileStrategicProfileExistingDataAdapter({
      sessionUser: null,
      profileHref: "/dashboard/boards/mobile-profile",
      analyzeVideoHref: "/dashboard/boards/mobile-profile",
      communityHref: "/dashboard/community",
    });
    return {
      ...res.profileInput,
      loginHref: "/login?intent=strategic_profile",
    };
  }

  // Se o query param 'state' estiver definido, carregamos a fixture para fins de teste/QA sob a feature flag
  if (params.stateQuery) {
    const fixture = buildMobileStrategicProfilePreviewFixture({ state: params.stateQuery });
    
    const res = buildMobileStrategicProfileExistingDataAdapter({
      sessionUser: {
        name: user.name,
        email: user.email,
        image: user.image,
        instagramConnected: Boolean(user.instagramConnected || user.isInstagramConnected),
        instagramUsername: user.instagramUsername,
        planStatus: user.planStatus,
      },
      diagnosisOverrideState: params.stateQuery,
      profileHref: "/dashboard/boards/mobile-profile",
      analyzeVideoHref: "/dashboard/boards/mobile-profile",
      communityHref: "/dashboard/community",
    });

    const override = resolveOverrideLevel(params.stateQuery);
    let diagnosisPresentation = null;
    if (override) {
      const scenario = buildVideoNarrativeAppPreviewScenario({
        stage: "diagnosis_ready",
        scenario: override.access === "premium" ? "brand" : "skincare",
        access: override.access,
        instagram: override.instagram,
      });
      diagnosisPresentation = scenario.diagnosisPresentation;
    }

    return {
      ...res.profileInput,
      diagnosisPresentation,
      state: {
        ...res.profileInput.state,
        ...fixture.profile.state,
      },
    };
  }

  const res = buildMobileStrategicProfileExistingDataAdapter({
    sessionUser: {
      name: user.name,
      email: user.email,
      image: user.image,
      instagramConnected: Boolean(user.instagramConnected || user.isInstagramConnected),
      instagramUsername: user.instagramUsername,
      planStatus: user.planStatus,
    },
    profileHref: "/dashboard/boards/mobile-profile",
    analyzeVideoHref: "/dashboard/boards/mobile-profile",
    communityHref: "/dashboard/community",
  });

  return res.profileInput;
}
