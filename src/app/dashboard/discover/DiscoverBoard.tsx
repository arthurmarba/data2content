"use client";

import React from "react";
import dynamic from "next/dynamic";
import Board from "@/app/dashboard/components/Board";
import ThreadsTabs from "@/app/dashboard/components/ThreadsTabs";
import type { DiscoverSection } from "./discoverFeedUtils";
import { prepareDiscoverSections } from "./discoverFeedUtils";
import type { LandingCreatorHighlight } from "@/types/landing";
import useBoardMobileViewport from "@/app/dashboard/hooks/useBoardMobileViewport";

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

const DiscoverBoardContent = dynamic(() => import("./DiscoverBoardContent"), {
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

type DiscoverFeedResponse = {
  ok?: boolean;
  sections?: DiscoverSection[];
  allowedPersonalized?: boolean;
};

type DiscoverCreatorResponse = {
  creators?: LandingCreatorHighlight[];
};

type TabId = "posts" | "creators" | "mentoria";

const DISCOVER_CLIENT_CACHE_TTL_MS = 60_000;

const discoverFeedCache = new Map<
  string,
  { data: DiscoverFeedResponse; expiresAt: number }
>();
const discoverFeedInFlight = new Map<string, Promise<DiscoverFeedResponse>>();

const discoverCreatorsCache = new Map<
  string,
  { data: DiscoverCreatorResponse; expiresAt: number }
>();
const discoverCreatorsInFlight = new Map<string, Promise<DiscoverCreatorResponse>>();

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "posts", label: "Posts" },
  { id: "creators", label: "Criadores" },
  { id: "mentoria", label: "Mentoria" },
];

function canWarmDiscoverSecondaryContent(useMobileAppView: boolean) {
  if (typeof window === "undefined" || typeof navigator === "undefined") return !useMobileAppView;
  if (useMobileAppView) return false;

  const navConnection = (navigator as {
    connection?: {
      saveData?: boolean;
      effectiveType?: string;
    };
    deviceMemory?: number;
  }).connection;

  if (navConnection?.saveData) return false;

  const effectiveType = String(navConnection?.effectiveType || "").toLowerCase();
  if (effectiveType === "slow-2g" || effectiveType === "2g" || effectiveType === "3g") {
    return false;
  }

  const deviceMemory = Number((navigator as { deviceMemory?: number }).deviceMemory);
  if (Number.isFinite(deviceMemory) && deviceMemory > 0 && deviceMemory <= 2) {
    return false;
  }

  return true;
}

function readCachedDiscoverValue<T>(
  cache: Map<string, { data: T; expiresAt: number }>,
  key: string,
) {
  const cached = cache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.data;
}

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

function createAbortSignalPromise(signal: AbortSignal) {
  return new Promise<never>((_, reject) => {
    if (signal.aborted) {
      reject(new DOMException("The operation was aborted.", "AbortError"));
      return;
    }

    const handleAbort = () => {
      signal.removeEventListener("abort", handleAbort);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };

    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

async function awaitAbortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }

  return Promise.race([promise, createAbortSignalPromise(signal)]);
}

async function fetchDiscoverFeedCached(
  key: string,
  url: string,
  signal: AbortSignal,
): Promise<DiscoverFeedResponse> {
  const cached = readCachedDiscoverValue(discoverFeedCache, key);
  if (cached) return cached;

  const existingRequest = discoverFeedInFlight.get(key);
  if (existingRequest) {
    return existingRequest;
  }

  const request = (async () => {
    const res = await fetch(url, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error("Não foi possível carregar o board de descoberta.");
    }

    const data = (await res.json()) as DiscoverFeedResponse;
    if (!data?.ok) {
      throw new Error("Não foi possível carregar o board de descoberta.");
    }

    discoverFeedCache.set(key, {
      data,
      expiresAt: Date.now() + DISCOVER_CLIENT_CACHE_TTL_MS,
    });

    return data;
  })();

  discoverFeedInFlight.set(key, request);

  try {
    return await awaitAbortable(request, signal);
  } finally {
    discoverFeedInFlight.delete(key);
  }
}

async function fetchDiscoverCreatorsCached(
  key: string,
  url: string,
  signal: AbortSignal,
): Promise<DiscoverCreatorResponse> {
  const cached = readCachedDiscoverValue(discoverCreatorsCache, key);
  if (cached) return cached;

  const existingRequest = discoverCreatorsInFlight.get(key);
  if (existingRequest) {
    return existingRequest;
  }

  const request = (async () => {
    const res = await fetch(url, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error("Não foi possível carregar os criadores agora.");
    }

    const data = (await res.json()) as DiscoverCreatorResponse;
    discoverCreatorsCache.set(key, {
      data,
      expiresAt: Date.now() + DISCOVER_CLIENT_CACHE_TTL_MS,
    });

    return data;
  })();

  discoverCreatorsInFlight.set(key, request);

  try {
    return await awaitAbortable(request, signal);
  } finally {
    discoverCreatorsInFlight.delete(key);
  }
}

export default function DiscoverBoard({
  compactView = false,
  mobileAppView = false,
  headerActions,
  showTitleMarker = true,
  allowCompactWarmup = true,
  isHighlighted = false,
}: {
  compactView?: boolean;
  mobileAppView?: boolean;
  headerActions?: React.ReactNode;
  showTitleMarker?: boolean;
  allowCompactWarmup?: boolean;
  isHighlighted?: boolean;
}) {
  const dedicatedDesktopWidthClassName = "lg:max-w-[1640px]";
  const isBoardMobileViewport = useBoardMobileViewport();
  const useMobileAppView = mobileAppView && isBoardMobileViewport;
  const useCompactLayout = compactView || useMobileAppView;
  const useDesktopCompactPreview = useCompactLayout && !useMobileAppView;
  const postsLimitPerRow = useCompactLayout ? 12 : 24;
  const postsWindowInDays = useCompactLayout ? 45 : 80;
  const creatorMode = "full";
  const creatorLimit = null;
  const [activeTab, setActiveTab] = React.useState<TabId>("posts");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sections, setSections] = React.useState<DiscoverSection[]>([]);
  const [allowedPersonalized, setAllowedPersonalized] = React.useState(false);
  const [creatorsLoading, setCreatorsLoading] = React.useState(false);
  const [creatorsError, setCreatorsError] = React.useState<string | null>(null);
  const [creators, setCreators] = React.useState<LandingCreatorHighlight[]>([]);
  const [creatorsLoaded, setCreatorsLoaded] = React.useState(false);
  const [fullFeedLoaded, setFullFeedLoaded] = React.useState(!useCompactLayout);
  const [allowSecondaryWarmup, setAllowSecondaryWarmup] = React.useState(
    !useCompactLayout && allowCompactWarmup,
  );
  const creatorsRequestInFlightRef = React.useRef(false);

  React.useEffect(() => {
    setFullFeedLoaded(!useCompactLayout);
  }, [postsLimitPerRow, postsWindowInDays, useCompactLayout]);

  React.useEffect(() => {
    setAllowSecondaryWarmup(
      allowCompactWarmup && canWarmDiscoverSecondaryContent(useMobileAppView),
    );
  }, [allowCompactWarmup, useMobileAppView]);

  React.useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          limitPerRow: String(postsLimitPerRow),
          days: String(postsWindowInDays),
          surface: useCompactLayout ? "board" : "full",
        });
        const queryString = params.toString();
        const data = await fetchDiscoverFeedCached(
          queryString,
          `/api/discover/feed?${queryString}`,
          controller.signal,
        );

        setSections(Array.isArray(data.sections) ? data.sections : []);
        setAllowedPersonalized(Boolean(data.allowedPersonalized));
        setFullFeedLoaded(!useCompactLayout);
      } catch (err) {
        if (controller.signal.aborted || isAbortLikeError(err)) return;
        setError(err instanceof Error ? err.message : "Não foi possível carregar o board de descoberta.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void load();

    return () => {
      controller.abort();
    };
  }, [postsLimitPerRow, postsWindowInDays, useCompactLayout]);

  React.useEffect(() => {
    if (!allowSecondaryWarmup || !useCompactLayout || fullFeedLoaded || loading || error) return;
    if (typeof window === "undefined") return;

    const controller = new AbortController();
    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const hydrateFullFeed = async () => {
      try {
        const params = new URLSearchParams({
          limitPerRow: String(postsLimitPerRow),
          days: String(postsWindowInDays),
          surface: "full",
        });
        const queryString = params.toString();
        const data = await fetchDiscoverFeedCached(
          queryString,
          `/api/discover/feed?${queryString}`,
          controller.signal,
        );
        if (controller.signal.aborted || !data?.ok) return;

        setSections(Array.isArray(data.sections) ? data.sections : []);
        setAllowedPersonalized(Boolean(data.allowedPersonalized));
        setFullFeedLoaded(true);
      } catch {
        // Mantém as prateleiras iniciais se a hidratação completa falhar.
      }
    };

    const queueHydration = () => {
      void hydrateFullFeed();
    };

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(queueHydration, { timeout: 1800 });
    } else {
      timeoutId = window.setTimeout(queueHydration, 950);
    }

    return () => {
      controller.abort();
      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    allowSecondaryWarmup,
    error,
    fullFeedLoaded,
    loading,
    postsLimitPerRow,
    postsWindowInDays,
    useCompactLayout,
  ]);

  const loadCreators = React.useCallback(
    async (signal: AbortSignal) => {
      if (creatorsLoaded || creatorsRequestInFlightRef.current) return;

      creatorsRequestInFlightRef.current = true;
      setCreatorsLoading(true);
      setCreatorsError(null);

      try {
        const params = new URLSearchParams({
          mode: creatorMode,
          surface: useCompactLayout ? "board" : "full",
        });
        if (creatorLimit) {
          params.set("limit", String(creatorLimit));
        }
        const queryString = params.toString();
        const data = await fetchDiscoverCreatorsCached(
          queryString,
          `/api/landing/casting?${queryString}`,
          signal,
        );
        if (signal.aborted) return;
        setCreators(Array.isArray(data.creators) ? data.creators : []);
        setCreatorsLoaded(true);
      } catch (err) {
        if (signal.aborted || isAbortLikeError(err)) return;
        setCreatorsError(err instanceof Error ? err.message : "Não foi possível carregar os criadores agora.");
      } finally {
        creatorsRequestInFlightRef.current = false;
        if (!signal.aborted) setCreatorsLoading(false);
      }
    },
    [creatorLimit, creatorMode, creatorsLoaded, useCompactLayout],
  );

  React.useEffect(() => {
    if (!allowSecondaryWarmup || !useCompactLayout || creatorsLoaded || loading || error) return;
    if (typeof window === "undefined") return;

    const controller = new AbortController();
    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const preloadCreators = () => {
      void loadCreators(controller.signal);
    };

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(preloadCreators, { timeout: 1600 });
    } else {
      timeoutId = window.setTimeout(preloadCreators, 700);
    }

    return () => {
      controller.abort();
      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [allowSecondaryWarmup, creatorsLoaded, error, loadCreators, loading, useCompactLayout]);

  React.useEffect(() => {
    if (activeTab !== "creators" || creatorsLoaded) return;
    const controller = new AbortController();
    void loadCreators(controller.signal);
    return () => {
      controller.abort();
    };
  }, [activeTab, creatorsLoaded, loadCreators]);

  const { featuredSection, secondarySections } = React.useMemo(
    () => prepareDiscoverSections(sections),
    [sections],
  );
  const boardSections = React.useMemo(
    () => (featuredSection ? [featuredSection, ...secondarySections] : secondarySections),
    [featuredSection, secondarySections],
  );

  return (
    <Board
      title="Comunidade"
      titleInlineAction={headerActions}
      promoteHeaderOnMobile
      mobilePresentation={useMobileAppView ? "flat" : "surface"}
      showTitleMarker={showTitleMarker}
      titleMarkerVariant="chip"
      variant="card"
      desktopWidthClassName={!useCompactLayout ? dedicatedDesktopWidthClassName : ""}
      showChevron={false}
      showOptions={false}
      disableMobilePaddingTop={useMobileAppView}
      isHighlighted={isHighlighted}
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
          className={useMobileAppView
            ? "w-full bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(247,247,248,0.94))] shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_10px_24px_rgba(24,24,27,0.035)] ring-1 ring-white/75"
            : "w-full"}
        />
      </div>

      {activeTab === "posts" ? (
        loading ? (
        <DiscoverPostsTabLoading compactView={useCompactLayout} />
        ) : error ? (
        <div className="p-4 sm:p-5">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            {error}
          </div>
        </div>
        ) : (
        <DiscoverBoardContent
          allowedPersonalized={allowedPersonalized}
          featuredSection={null}
          sections={boardSections}
          primaryKey={boardSections[0]?.key}
          showFloatingActionBar={false}
          compactView={useCompactLayout}
          desktopCompactPreview={useDesktopCompactPreview}
        />
        )
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
