"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Board from "@/app/dashboard/components/Board";
import ThreadsTabs from "@/app/dashboard/components/ThreadsTabs";
import useBoardMobileViewport from "@/app/dashboard/hooks/useBoardMobileViewport";
import type { DiscoverSection } from "./discoverFeedUtils";
import type { LandingCreatorHighlight } from "@/types/landing";

function DiscoverPostsTabLoading({
  compactView = false,
}: {
  compactView?: boolean;
}) {
  return (
    <div className={compactView ? "space-y-4 p-4" : "space-y-5 p-4 sm:p-5"}>
      <div className="space-y-3">
        <div className="h-3 w-28 animate-pulse rounded-full bg-zinc-200" />
        <div className="flex flex-wrap gap-2">
          <div className="h-9 w-24 animate-pulse rounded-full bg-zinc-100" />
          <div className="h-9 w-24 animate-pulse rounded-full bg-zinc-100" />
          <div className="h-9 w-24 animate-pulse rounded-full bg-zinc-100" />
        </div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: compactView ? 2 : 3 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <div className="h-4 w-40 animate-pulse rounded-full bg-zinc-200" />
            <div className="flex gap-2 overflow-hidden">
              <div className={`animate-pulse rounded-[1.4rem] bg-zinc-100 ${compactView ? "h-[190px] w-[132px]" : "h-[250px] w-[180px]"}`} />
              <div className={`animate-pulse rounded-[1.4rem] bg-zinc-100 ${compactView ? "h-[190px] w-[132px]" : "h-[250px] w-[180px]"}`} />
              <div className={`animate-pulse rounded-[1.4rem] bg-zinc-100 ${compactView ? "h-[190px] w-[132px]" : "h-[250px] w-[180px]"}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PlanningDiscoverPostsBoardContent = dynamic(() => import("./PlanningDiscoverPostsBoardContent"), {
  loading: () => <DiscoverPostsTabLoading />,
});

const DiscoverCreatorsBoardContent = dynamic(
  () => import("./DiscoverCreatorsBoardContent"),
  {
    loading: () => null,
  },
);

const CommunityConversionSection = dynamic(
  () => import("./CommunityConversionSection"),
  {
    loading: () => null,
  },
);

type DiscoverCreatorResponse = {
  creators?: LandingCreatorHighlight[];
};

type TabId = "posts" | "creators" | "mentoria";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "posts", label: "Posts" },
  { id: "creators", label: "Criadores" },
  { id: "mentoria", label: "Mentoria" },
];

function isAbortLikeError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String((error as { name?: unknown }).name || "") : "";
  const message = "message" in error ? String((error as { message?: unknown }).message || "") : "";
  return (
    name === "AbortError" ||
    message === "signal is aborted without reason" ||
    message.toLowerCase().includes("aborted")
  );
}

export default function PlanningDiscoverBoard({
  initialSections,
  initialAllowedPersonalized,
}: {
  initialSections: DiscoverSection[];
  initialAllowedPersonalized: boolean;
}) {
  const isBoardMobileViewport = useBoardMobileViewport();
  const useMobileAppView = isBoardMobileViewport;
  const useCompactLayout = useMobileAppView;
  const [activeTab, setActiveTab] = React.useState<TabId>("posts");
  const [creatorsLoading, setCreatorsLoading] = React.useState(false);
  const [creatorsError, setCreatorsError] = React.useState<string | null>(null);
  const [creators, setCreators] = React.useState<LandingCreatorHighlight[]>([]);
  const [creatorsLoaded, setCreatorsLoaded] = React.useState(false);

  const boardSections = React.useMemo(
    () => (Array.isArray(initialSections) ? initialSections : []),
    [initialSections],
  );

  const loadCreators = React.useCallback(async (signal: AbortSignal) => {
    if (creatorsLoaded) return;

    setCreatorsLoading(true);
    setCreatorsError(null);

    try {
      const params = new URLSearchParams({
        mode: "full",
        surface: useCompactLayout ? "board" : "full",
      });
      const response = await fetch(`/api/landing/casting?${params.toString()}`, {
        cache: "no-store",
        signal,
      });

      if (!response.ok) {
        throw new Error("Não foi possível carregar os criadores agora.");
      }

      const payload = (await response.json()) as DiscoverCreatorResponse;
      if (signal.aborted) return;

      setCreators(Array.isArray(payload.creators) ? payload.creators : []);
      setCreatorsLoaded(true);
    } catch (error) {
      if (signal.aborted || isAbortLikeError(error)) return;
      setCreatorsError(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os criadores agora.",
      );
    } finally {
      if (!signal.aborted) {
        setCreatorsLoading(false);
      }
    }
  }, [creatorsLoaded, useCompactLayout]);

  React.useEffect(() => {
    if (activeTab !== "creators" || creatorsLoaded) return;
    const controller = new AbortController();
    void loadCreators(controller.signal);
    return () => {
      controller.abort();
    };
  }, [activeTab, creatorsLoaded, loadCreators]);

  return (
    <Board
      title="Comunidade"
      promoteHeaderOnMobile
      mobilePresentation={useMobileAppView ? "flat" : "surface"}
      showTitleMarker={false}
      titleMarkerVariant="chip"
      variant="card"
      desktopWidthClassName="lg:max-w-[1640px]"
      showChevron={false}
      showOptions={false}
      disableMobilePaddingTop={useMobileAppView}
      contentClassName={useMobileAppView ? "bg-transparent" : "bg-[linear-gradient(180deg,rgba(255,255,255,0.26),rgba(248,248,249,0.72))]"}
    >
      <div
        className={`sticky top-0 z-30 ${
          useMobileAppView
            ? "bg-[linear-gradient(180deg,rgba(243,244,246,0.96),rgba(243,244,246,0.92)_74%,rgba(243,244,246,0))] px-2 pt-0 pb-1.5 backdrop-blur-xl"
            : "border-b border-zinc-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,255,255,0.94))] px-5 pt-2.5 pb-2.5 backdrop-blur-md"
        }`}
      >
        <ThreadsTabs
          tabs={TABS}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
          compact={useCompactLayout}
          segmentedTheme={useCompactLayout ? "mono" : "default"}
          className={
            useMobileAppView
              ? "w-full bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(247,247,248,0.94))] shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_10px_24px_rgba(24,24,27,0.035)] ring-1 ring-white/75"
              : "w-full"
          }
        />
      </div>

      {activeTab === "posts" ? (
        <PlanningDiscoverPostsBoardContent
          sections={boardSections}
          primaryKey={boardSections[0]?.key}
          compactView={useCompactLayout}
          desktopCompactPreview={false}
        />
      ) : activeTab === "creators" ? (
        <DiscoverCreatorsBoardContent
          creators={creators}
          loading={creatorsLoading}
          error={creatorsError}
          compactView={useCompactLayout}
        />
      ) : (
        <div className={useCompactLayout ? "p-4" : "p-4 sm:p-5"}>
          <CommunityConversionSection compactView={useCompactLayout} />
        </div>
      )}
    </Board>
  );
}
