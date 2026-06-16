"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

import PinnedBoardsHub from "../boards/PinnedBoardsHub";
import type { PinnableBoardId } from "../boards/boardRegistry";
import { usePinnedBoardsEnabled } from "../boards/usePinnedBoards";

const CampaignsBoard = dynamic(() => import("@/app/(dashboard)/campaigns/CampaignsBoard"), {
  ssr: false,
  loading: () => null,
});

const DiscoverBoard = dynamic(() => import("../discover/DiscoverBoard"), {
  ssr: false,
  loading: () => null,
});

const MediaKitPinnedBoard = dynamic(() => import("../boards/MediaKitPinnedBoard"), {
  ssr: false,
  loading: () => null,
});

const PostCreationPinnedBoard = dynamic(() => import("../boards/PostCreationPinnedBoard"), {
  ssr: false,
  loading: () => null,
});

const PlanningChartsPage = dynamic(() => import("../planning/PlanningChartsPage"), {
  ssr: false,
  loading: () => null,
});

const StrategicMapPinnedBoard = dynamic(() => import("../boards/StrategicMapPinnedBoard"), {
  ssr: false,
  loading: () => null,
});

const CollabsPinnedBoard = dynamic(() => import("../boards/CollabsPinnedBoard"), {
  ssr: false,
  loading: () => null,
});

const BOARD_IDLE_DELAYS_MS = [0, 0, 750, 1450, 2200];

function BoardLoadingShell() {
  return (
    <div
      className="flex h-full min-h-[560px] items-center justify-center rounded-[2rem] border border-zinc-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,246,247,0.92))] px-6 py-8 text-sm text-zinc-500 shadow-[0_24px_56px_rgba(24,24,27,0.06)]"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-zinc-200" />
        <p>Carregando painel…</p>
      </div>
    </div>
  );
}

function DeferredRealBoardMount({
  children,
  priority,
  immediate = false,
}: {
  children: React.ReactNode;
  priority: number;
  immediate?: boolean;
}) {
  const [isMounted, setIsMounted] = React.useState(immediate);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (immediate) {
      setIsMounted(true);
      return;
    }
    setIsMounted(false);
  }, [immediate]);

  React.useEffect(() => {
    if (isMounted) return;
    if (typeof window === "undefined") {
      setIsMounted(true);
      return;
    }

    let timeoutId: number | null = null;
    let idleId: number | null = null;
    let observer: IntersectionObserver | null = null;

    const activate = () => {
      setIsMounted((current) => (current ? current : true));
    };

    const delay =
      BOARD_IDLE_DELAYS_MS[Math.min(priority, BOARD_IDLE_DELAYS_MS.length - 1)] ??
      BOARD_IDLE_DELAYS_MS[BOARD_IDLE_DELAYS_MS.length - 1];

    if (typeof IntersectionObserver === "function" && containerRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (!entry?.isIntersecting) return;
          activate();
          observer?.disconnect();
          observer = null;
        },
        {
          rootMargin: "0px 720px 0px 720px",
          threshold: 0.01,
        },
      );
      observer.observe(containerRef.current);
    }

    const queueIdleMount = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(activate, { timeout: 1400 });
        return;
      }
      activate();
    };

    timeoutId = window.setTimeout(queueIdleMount, delay);

    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      observer?.disconnect();
    };
  }, [isMounted, priority]);

  return <div ref={containerRef} className="h-full">{isMounted ? children : <BoardLoadingShell />}</div>;
}

export default function HomeDesktopBoards() {
  const { data: session } = useSession();
  const sessionUserId = session?.user?.id ?? null;
  const sessionUserRole = session?.user?.role ?? null;
  const sessionUserName = session?.user?.name ?? null;
  const sessionUserPlanStatus =
    (session?.user as { planStatus?: string | null } | undefined)?.planStatus ?? null;
  const sessionAffiliateCode =
    (session?.user as { affiliateCode?: string | null } | undefined)?.affiliateCode ?? null;
  const { orderedPinnedBoards } = usePinnedBoardsEnabled(sessionUserId, true);
  const searchParams = useSearchParams();
  const highlightBoardId = searchParams?.get("highlight");

  const [activeHighlight, setActiveHighlight] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!highlightBoardId) return undefined;
    setActiveHighlight(highlightBoardId);
    const timer = setTimeout(() => setActiveHighlight(null), 5000);
    return () => clearTimeout(timer);
  }, [highlightBoardId]);

  const compactCampaignViewer = React.useMemo(
    () => ({
      id: sessionUserId,
      role: sessionUserRole,
      name: sessionUserName,
      planStatus: sessionUserPlanStatus,
    }),
    [sessionUserId, sessionUserName, sessionUserPlanStatus, sessionUserRole],
  );

  const compactPlanningViewer = React.useMemo(
    () => ({
      id: sessionUserId ?? "",
      role: sessionUserRole,
      name: sessionUserName,
      affiliateCode: sessionAffiliateCode,
    }),
    [sessionAffiliateCode, sessionUserId, sessionUserName, sessionUserRole],
  );

  const renderPinnedBoard = React.useCallback(
    (boardId: PinnableBoardId) => {
      switch (boardId) {
        case "strategic-map":
          return (
            <StrategicMapPinnedBoard
              showTitleMarker={false}
              isHighlighted={activeHighlight === "strategic-map"}
            />
          );
        case "collabs":
          return (
            <CollabsPinnedBoard
              showTitleMarker={false}
              isHighlighted={activeHighlight === "collabs"}
            />
          );
        case "campaigns":
          return (
            <CampaignsBoard
              viewer={compactCampaignViewer}
              compactView
              showTitleMarker={false}
              isHighlighted={activeHighlight === "campaigns"}
            />
          );
        case "discover":
          return (
            <DiscoverBoard
              compactView
              showTitleMarker={false}
              allowCompactWarmup={false}
              isHighlighted={activeHighlight === "discover"}
            />
          );
        case "media-kit":
          return (
            <MediaKitPinnedBoard
              showTitleMarker={false}
              isHighlighted={activeHighlight === "media-kit"}
            />
          );
        case "post-creation":
          return (
            <PostCreationPinnedBoard
              isHighlighted={activeHighlight === "post-creation"}
            />
          );
        case "profile-analysis":
          return (
            <PlanningChartsPage
              viewer={compactPlanningViewer}
              showPinButton
              pinButtonRedirectOnPin={false}
              compactView
              isHighlighted={activeHighlight === "profile-analysis"}
            />
          );
        default:
          return null;
      }
    },
    [activeHighlight, compactCampaignViewer, compactPlanningViewer],
  );

  const boardIds = React.useMemo<PinnableBoardId[]>(
    () => orderedPinnedBoards.map((boardConfig) => boardConfig.id),
    [orderedPinnedBoards],
  );

  const homeRailBoardWidthClassName =
    "w-[min(415px,calc(100vw-28px))] lg:w-[450px] xl:w-[470px]";
  const homeRailPrimaryItemClassName =
    "w-[min(760px,calc(100vw-28px))] lg:w-[min(760px,55vw)] xl:w-[min(840px,58vw)]";
  const homeRailItemClassName = "lg:-mt-[2.75rem] lg:h-[calc(100%+2.75rem)]";
  const homeRailClassName = "items-start";
  const homeRailRestItemClassName = "self-start";
  const homeRailFirstItemClassName =
    boardIds.length > 0 ? homeRailRestItemClassName : homeRailPrimaryItemClassName;

  return (
    <PinnedBoardsHub
      boardWidthClassName={homeRailBoardWidthClassName}
      itemClassName={homeRailItemClassName}
      firstItemClassName={homeRailFirstItemClassName}
      restItemClassName={homeRailRestItemClassName}
      railClassName={homeRailClassName}
    >
      {boardIds.map((boardId, index) => (
        <DeferredRealBoardMount
          key={boardId}
          priority={index}
          immediate={index < 2}
        >
          {renderPinnedBoard(boardId)}
        </DeferredRealBoardMount>
      ))}
    </PinnedBoardsHub>
  );
}
