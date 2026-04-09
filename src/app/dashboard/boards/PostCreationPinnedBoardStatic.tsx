"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import Board from "@/app/dashboard/components/Board";
import ThreadsTabs from "@/app/dashboard/components/ThreadsTabs";
import { useSidebarViewport } from "../components/sidebar/hooks";
import { redirectToGoogleConsentLogin } from "@/lib/auth/googleLogin";

import BoardPinButton from "./BoardPinButton";
import PostCreationPreviewOverlay from "./PostCreationPreviewOverlay";

const PlannerClientPage = dynamic(() => import("@/app/dashboard/planning/PlannerClientPage"), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[360px] w-full animate-pulse rounded-[1.4rem] border border-zinc-100/80 bg-zinc-50/70" />
  ),
});

const MyScriptsPage = dynamic(() => import("@/app/dashboard/scripts/MyScriptsPage"), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[360px] w-full animate-pulse rounded-[1.4rem] border border-zinc-100/80 bg-zinc-50/70" />
  ),
});

type PostCreationTabId = "planner" | "scripts";

type ViewerInfo = {
  id?: string | null;
  role?: string | null;
  name?: string | null;
};

function PostCreationTabSkeleton() {
  return (
    <div className="h-full min-h-[360px] w-full animate-pulse rounded-[1.4rem] border border-zinc-100/80 bg-zinc-50/70" />
  );
}

export default function PostCreationPinnedBoardStatic({
  initialTab,
  viewer,
  canInteract = false,
  viewerPending = false,
  previewMode = false,
  initialInstagramConnected = false,
}: {
  initialTab?: PostCreationTabId;
  viewer?: ViewerInfo;
  canInteract?: boolean;
  viewerPending?: boolean;
  previewMode?: boolean;
  initialInstagramConnected?: boolean;
}) {
  const { isMobile } = useSidebarViewport();
  const resolvedInitialTab: PostCreationTabId =
    initialTab === "planner" || initialTab === "scripts" ? initialTab : "scripts";
  const [activeTab, setActiveTab] = useState<PostCreationTabId>(resolvedInitialTab);
  const [activeTabReady, setActiveTabReady] = useState(false);
  useEffect(() => {
    setActiveTab(resolvedInitialTab);
  }, [resolvedInitialTab]);
  useEffect(() => {
    setActiveTabReady(false);
    const frame = window.requestAnimationFrame(() => {
      window.setTimeout(() => setActiveTabReady(true), 0);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [activeTab]);
  const normalizedViewer = useMemo(
    () => ({
      id: viewer?.id ?? "",
      role: viewer?.role ?? null,
      name: viewer?.name ?? null,
    }),
    [viewer?.id, viewer?.name, viewer?.role]
  );
  const isPreviewMode = previewMode && !normalizedViewer.id;

  const handleActivateBoard = () => {
    const callbackUrl =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}${window.location.hash}`
        : "/calendar";
    redirectToGoogleConsentLogin(callbackUrl);
  };

  return (
    <Board
      title="Criação de Post"
      titleInlineAction={
        <BoardPinButton
          boardId="post-creation"
          boardTitle="Criação de Post"
          redirectOnPin={false}
        />
      }
      variant="card"
      showChevron={false}
      showOptions={false}
      disableMobilePaddingTop={isMobile}
      contentClassName="bg-white"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className={`sticky top-0 z-30 shrink-0 backdrop-blur-md ${isMobile
          ? "bg-[linear-gradient(180deg,rgba(243,244,246,0.96),rgba(243,244,246,0.92)_74%,rgba(243,244,246,0))] px-2 pt-0.5 pb-1.5"
          : "border-b border-zinc-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,255,255,0.94))] px-3.5 pb-3 pt-2 shadow-[0_1px_0_rgba(228,228,231,0.7)]"
        }`}>
          <ThreadsTabs
            tabs={[
              { id: "planner", label: "Pautas de conteúdo" },
              { id: "scripts", label: "Meus Roteiros" },
            ]}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as "planner" | "scripts")}
            compact
            variant="segmented"
            segmentedTheme="mono"
            className="w-full bg-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]"
          />
        </div>

        <div className="relative min-h-0 flex-1">
          {!activeTabReady ? (
            <PostCreationTabSkeleton />
          ) : activeTab === "planner" ? (
            <div className="h-full px-3.5 pb-3 pt-1.5">
              <PlannerClientPage
                viewer={normalizedViewer}
                compactView
                onNavigateToScripts={() => setActiveTab("scripts")}
                viewerPending={viewerPending}
                previewMode={isPreviewMode}
                initialHasAccess={canInteract}
              />
            </div>
          ) : (
            <MyScriptsPage
              compactView
              viewer={normalizedViewer}
              canInteract={canInteract}
              showPreviewBanner={!isPreviewMode}
              viewerPending={viewerPending}
              previewMode={isPreviewMode}
              initialInstagramConnected={initialInstagramConnected}
            />
          )}
          {isPreviewMode ? (
            <PostCreationPreviewOverlay
              onActivate={() => {
                void handleActivateBoard();
              }}
            />
          ) : null}
        </div>
      </div>
    </Board>
  );
}
