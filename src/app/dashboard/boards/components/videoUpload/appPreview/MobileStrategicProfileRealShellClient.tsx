"use client";

import { useCallback, useEffect, useState } from "react";
import { buildMobileStrategicProfileRealShellInput } from "./buildMobileStrategicProfileRealShellInput";
import { buildMobileStrategicProfile, type MobileStrategicProfile } from "../../../videoUpload/mobileStrategicProfileMapping";
import { buildMobileStrategicProfileExistingDataAdapter } from "../../../videoUpload/mobileStrategicProfileExistingDataAdapter";
import { buildMobileStrategicProfileFromSnapshot } from "../../../videoUpload/mobileStrategicProfileSnapshotMapping";
import { MobileStrategicProfilePreview } from "./MobileStrategicProfilePreview";
import { fetchHomeSummaryCached } from "../../../../home/homeSummaryClient";
import { requestUploadSession } from "./mobileStrategicProfileUploadSessionClient";
import { uploadVideoToTemporarySignedUrl } from "./mobileStrategicProfileDirectUploadClient";

interface MobileStrategicProfileRealShellClientProps {
  session: any;
  stateQuery: string | null;
  initialSnapshotPayload?: any; // MobileStrategicProfileSnapshotPayload
}

export function MobileStrategicProfileRealShellClient({
  session,
  stateQuery,
  initialSnapshotPayload,
}: MobileStrategicProfileRealShellClientProps) {
  // 1. Calcular o perfil inicial (Session-only, snapshot ou fixture via stateQuery)
  const [profile, setProfile] = useState<MobileStrategicProfile>(() => {
    if (stateQuery) {
      const input = buildMobileStrategicProfileRealShellInput({
        session,
        stateQuery,
      });
      return buildMobileStrategicProfile(input);
    }
    const input = buildMobileStrategicProfileFromSnapshot({
      sessionUser: session?.user ? {
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        instagramConnected: Boolean(session.user.instagramConnected || session.user.isInstagramConnected),
        instagramUsername: session.user.instagramUsername,
        planStatus: session.user.planStatus,
      } : null,
      snapshotPayload: initialSnapshotPayload || null,
      accessLevel: session?.user?.planStatus === "active" ? "premium" : "free",
    });
    return buildMobileStrategicProfile(input);
  });

  const [isHydrating, setIsHydrating] = useState(false);

  useEffect(() => {
    // Se for anônimo, não precisamos hidratar
    if (!session?.user) return;

    let active = true;

    async function hydrate() {
      setIsHydrating(true);
      try {
        const summary = await fetchHomeSummaryCached("all");
        if (!active) return;

        if (summary) {
          // Recalcula o perfil usando o adapter com os dados do summary
          const res = buildMobileStrategicProfileExistingDataAdapter({
            sessionUser: {
              name: session.user.name,
              email: session.user.email,
              image: session.user.image,
              instagramConnected: Boolean(session.user.instagramConnected || session.user.isInstagramConnected),
              instagramUsername: session.user.instagramUsername,
              planStatus: session.user.planStatus,
            },
            homeSummary: summary,
            diagnosisOverrideState: stateQuery,
            profileHref: "/dashboard/boards/mobile-profile",
            analyzeVideoHref: "/dashboard/boards/mobile-profile",
          });

          let diagnosisPresentation = res.profileInput.diagnosisPresentation;
          let extraState = {};

          // Carrega a apresentação a partir do snapshot persistido
          if (initialSnapshotPayload) {
            const { mapSnapshotToDiagnosisPresentation } = await import("../../../videoUpload/mobileStrategicProfileSnapshotMapping");
            diagnosisPresentation = mapSnapshotToDiagnosisPresentation(initialSnapshotPayload);
          }

          // Se estivermos em modo override de teste QA, mesclamos o estado da fixture
          if (stateQuery) {
            const { buildMobileStrategicProfileRealShellInput } = await import("./buildMobileStrategicProfileRealShellInput");
            const initialInput = buildMobileStrategicProfileRealShellInput({
              session,
              stateQuery,
            });
            diagnosisPresentation = initialInput.diagnosisPresentation || diagnosisPresentation;

            const { buildMobileStrategicProfilePreviewFixture } = await import("./buildMobileStrategicProfilePreviewFixture");
            const fixture = buildMobileStrategicProfilePreviewFixture({ state: stateQuery });
            extraState = fixture.profile.state;
          }

          const hydratedInput = {
            ...res.profileInput,
            diagnosisPresentation,
            state: {
              ...res.profileInput.state,
              ...extraState,
            },
          };

          setProfile(buildMobileStrategicProfile(hydratedInput));
        }
      } catch (err) {
        // Fallback silencioso em caso de erro no fetch
        console.error("Erro silencioso ao hidratar Perfil Estratégico:", err);
      } finally {
        if (active) {
          setIsHydrating(false);
        }
      }
    }

    hydrate();

    return () => {
      active = false;
    };
  }, [session, stateQuery, initialSnapshotPayload]);

  const handleAnalysisSubmit = useCallback(async (payload: {
    creatorGoal: string;
    selectedGoalOption: "authority" | "retention" | "format_test" | "sponsored_content";
    quickAnswers?: Array<{ id: string; value: string }>;
    mockScenario?: string;
  }) => {
    const response = await fetch("/api/dashboard/mobile-strategic-profile/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || "Erro ao conectar com o serviço de análise mockada.");
    }

    const data = await response.json();
    if (data.snapshot) {
      const { buildMobileStrategicProfileFromSnapshot } = await import("../../../videoUpload/mobileStrategicProfileSnapshotMapping");
      const input = buildMobileStrategicProfileFromSnapshot({
        sessionUser: session?.user ? {
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
          instagramConnected: Boolean(session.user.instagramConnected || session.user.isInstagramConnected),
          instagramUsername: session.user.instagramUsername,
          planStatus: session.user.planStatus,
        } : null,
        snapshotPayload: data.snapshot,
        accessLevel: session?.user?.planStatus === "active" ? "premium" : "free",
      });
      setProfile(buildMobileStrategicProfile(input));
    }
  }, [session]);

  const handleCleanupTemporaryUpload = useCallback(async (payload: {
    uploadSessionId: string;
    objectKey?: string;
    reason: "analysis_completed" | "analysis_failed" | "user_cancelled" | "expired";
  }) => {
    const response = await fetch("/api/dashboard/mobile-strategic-profile/upload-cleanup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uploadSessionId: payload.uploadSessionId,
        objectKey: payload.objectKey,
        reason: payload.reason,
      }),
    });

    if (!response.ok) {
      throw new Error("Cleanup temporário não foi confirmado.");
    }
  }, []);

  return (
    <div className="relative">
      {isHydrating && (
        <div
          className="absolute right-4 top-4 z-50 flex items-center gap-1.5 rounded-full bg-zinc-900/90 px-3 py-1.5 text-[10px] font-medium text-white shadow-sm backdrop-blur-sm transition-opacity duration-300 pointer-events-none animate-pulse"
          id="hydration-indicator"
        >
          <svg className="animate-spin h-3 w-3 text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Atualizando dados do Perfil...</span>
        </div>
      )}
      <MobileStrategicProfilePreview
        profile={profile}
        isRealShell={true}
        onSubmitAnalysis={handleAnalysisSubmit}
        onCreateUploadSession={requestUploadSession}
        onUploadToTemporarySignedUrl={uploadVideoToTemporarySignedUrl}
        onCleanupTemporaryUpload={handleCleanupTemporaryUpload}
      />
    </div>
  );
}
