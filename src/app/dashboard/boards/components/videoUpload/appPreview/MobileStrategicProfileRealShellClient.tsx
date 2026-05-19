"use client";

import { useEffect, useState } from "react";
import { buildMobileStrategicProfileRealShellInput } from "./buildMobileStrategicProfileRealShellInput";
import { buildMobileStrategicProfile, type MobileStrategicProfile } from "../../../videoUpload/mobileStrategicProfileMapping";
import { buildMobileStrategicProfileExistingDataAdapter } from "../../../videoUpload/mobileStrategicProfileExistingDataAdapter";
import { MobileStrategicProfilePreview } from "./MobileStrategicProfilePreview";
import { fetchHomeSummaryCached } from "../../../../home/homeSummaryClient";

interface MobileStrategicProfileRealShellClientProps {
  session: any;
  stateQuery: string | null;
}

export function MobileStrategicProfileRealShellClient({
  session,
  stateQuery,
}: MobileStrategicProfileRealShellClientProps) {
  // 1. Calcular o perfil inicial (Session-only ou fixture via stateQuery)
  const initialInput = buildMobileStrategicProfileRealShellInput({
    session,
    stateQuery,
  });

  const [profile, setProfile] = useState<MobileStrategicProfile>(() =>
    buildMobileStrategicProfile(initialInput)
  );

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
            // Não enviamos communityHref para permitir priorização dos links de convite do summary
          });

          // Se estivermos em modo override de teste QA, mesclamos o estado da fixture
          let diagnosisPresentation = res.profileInput.diagnosisPresentation;
          let extraState = {};
          if (stateQuery) {
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
  }, [session, stateQuery, initialInput.diagnosisPresentation]);

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
      />
    </div>
  );
}
