"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

import PinnedBoardsHub from "../boards/PinnedBoardsHub";
import { isPinnableBoardId, type PinnableBoardId } from "../boards/boardRegistry";
import { usePinnedBoardsEnabled } from "../boards/usePinnedBoards";
import { useDashboardNotificationBadges } from "../hooks/useDashboardNotificationBadges";
import CampaignPriorityNotice from "./CampaignPriorityNotice";
import { prioritizeCampaignBoardIds } from "./campaignHomePriority";

const CampaignsOverviewBoard = dynamic(() => import("../boards/CampaignsOverviewBoard"), {
  ssr: false,
  loading: () => null,
});

const MediaKitOverviewBoard = dynamic(() => import("../boards/MediaKitOverviewBoard"), {
  ssr: false,
  loading: () => null,
});

const RecordedMeetingsPinnedBoard = dynamic(
  () => import("../boards/RecordedMeetingsPinnedBoard"),
  {
    ssr: false,
    loading: () => null,
  },
);

const StrategicMapOverviewBoard = dynamic(() => import("../boards/StrategicMapOverviewBoard"), {
  ssr: false,
  loading: () => null,
});

const CollabsOverviewBoard = dynamic(() => import("../boards/CollabsOverviewBoard"), {
  ssr: false,
  loading: () => null,
});

const AffiliatesOverviewBoard = dynamic(() => import("../boards/AffiliatesOverviewBoard"), {
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
  const { orderedPinnedBoards, isPinned, pinBoard, hydrated: pinsHydrated } =
    usePinnedBoardsEnabled(sessionUserId, true);
  const searchParams = useSearchParams();
  const highlightBoardId = searchParams?.get("highlight");
  const { campaignsUnreadCount } = useDashboardNotificationBadges();

  const [activeHighlight, setActiveHighlight] = React.useState<string | null>(null);

  // Baseline de propostas que o usuário já dispensou. O destaque de campanhas
  // reflete o número de não lidas atual (que cai sozinho quando as propostas
  // são lidas e o badge revalida) e some quando o usuário fecha o aviso.
  const [dismissedCampaignCount, setDismissedCampaignCount] = React.useState(0);
  const priorityCampaignCount =
    campaignsUnreadCount > dismissedCampaignCount ? campaignsUnreadCount : 0;

  React.useEffect(() => {
    // Zera o baseline quando não há mais não lidas, para que uma nova proposta
    // futura volte a destacar campanhas mesmo após um "dispensar" anterior.
    if (campaignsUnreadCount === 0 && dismissedCampaignCount !== 0) {
      setDismissedCampaignCount(0);
    }
  }, [campaignsUnreadCount, dismissedCampaignCount]);

  const handleDismissCampaignPriority = React.useCallback(() => {
    setDismissedCampaignCount(campaignsUnreadCount);
  }, [campaignsUnreadCount]);

  React.useEffect(() => {
    if (!highlightBoardId) return undefined;
    // Acessar via sidebar deve sempre revelar o board: se o usuário o havia
    // despinado, o highlight o traz de volta à central (a sidebar é o controle
    // de "pinar ou não"). Boards fixos já estão sempre presentes.
    if (pinsHydrated && isPinnableBoardId(highlightBoardId) && !isPinned(highlightBoardId)) {
      pinBoard(highlightBoardId);
    }
    setActiveHighlight(highlightBoardId);
    const timer = setTimeout(() => setActiveHighlight(null), 5000);
    return () => clearTimeout(timer);
  }, [highlightBoardId, pinsHydrated, isPinned, pinBoard]);

  const renderPinnedBoard = React.useCallback(
    (boardId: PinnableBoardId) => {
      switch (boardId) {
        case "strategic-map":
          return (
            <StrategicMapOverviewBoard
              isHighlighted={activeHighlight === "strategic-map"}
            />
          );
        case "collabs":
          return (
            <CollabsOverviewBoard
              isHighlighted={activeHighlight === "collabs"}
            />
          );
        case "campaigns":
          return (
            <CampaignsOverviewBoard
              unreadCount={campaignsUnreadCount}
              isHighlighted={activeHighlight === "campaigns"}
            />
          );
        case "recorded-meetings":
          return (
            <RecordedMeetingsPinnedBoard
              isHighlighted={activeHighlight === "recorded-meetings"}
            />
          );
        case "media-kit":
          return (
            <MediaKitOverviewBoard
              isHighlighted={activeHighlight === "media-kit"}
            />
          );
        case "affiliates":
          return (
            <AffiliatesOverviewBoard
              isHighlighted={activeHighlight === "affiliates"}
            />
          );
        default:
          return null;
      }
    },
    [activeHighlight, campaignsUnreadCount],
  );

  const boardIds = React.useMemo<PinnableBoardId[]>(
    () =>
      prioritizeCampaignBoardIds(
        orderedPinnedBoards.map((boardConfig) => boardConfig.id),
        priorityCampaignCount > 0,
      ),
    [orderedPinnedBoards, priorityCampaignCount],
  );
  const boardNavigationLabels = React.useMemo(
    () =>
      boardIds.map((boardId) => {
        const board = orderedPinnedBoards.find((item) => item.id === boardId);
        return board?.title ?? boardId;
      }),
    [boardIds, orderedPinnedBoards],
  );

  const homeRailBoardWidthClassName =
    "w-[min(390px,calc(100vw-28px))] lg:w-[390px] xl:w-[410px] 2xl:w-[420px]";
  const homeRailItemClassName = "h-full";
  const homeRailClassName = "items-start";
  const homeRailRestItemClassName = "self-start";

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <CampaignPriorityNotice
        count={priorityCampaignCount}
        creatorId={sessionUserId}
        onDismiss={handleDismissCampaignPriority}
      />
      <PinnedBoardsHub
        className="min-h-0 flex-1"
        boardWidthClassName={homeRailBoardWidthClassName}
        itemClassName={homeRailItemClassName}
        firstItemClassName={homeRailRestItemClassName}
        restItemClassName={homeRailRestItemClassName}
        railClassName={homeRailClassName}
        navigationLabels={boardNavigationLabels}
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
    </div>
  );
}
