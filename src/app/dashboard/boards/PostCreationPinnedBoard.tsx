"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

import Board from "@/app/dashboard/components/Board";
import ThreadsTabs from "@/app/dashboard/components/ThreadsTabs";
import PlannerClientPage from "@/app/dashboard/planning/PlannerClientPage";
import MyScriptsPage from "@/app/dashboard/scripts/MyScriptsPage";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { redirectToGoogleConsentLogin } from "@/lib/auth/googleLogin";

import BoardPinButton from "./BoardPinButton";
import PostCreationPreviewOverlay from "./PostCreationPreviewOverlay";

type PostCreationTabId = "planner" | "scripts";

export default function PostCreationPinnedBoard({
  initialTab,
}: {
  initialTab?: PostCreationTabId;
}) {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const billing = useBillingStatus();
  const hasPro = billing.hasPremiumAccess;

  const sessionUser = session?.user as
    | {
        id?: string | null;
        role?: string | null;
        name?: string | null;
      }
    | undefined;
  const viewer = useMemo(
    () => ({
      id: sessionUser?.id ?? "",
      role: sessionUser?.role ?? null,
      name: sessionUser?.name ?? null,
    }),
    [sessionUser?.id, sessionUser?.name, sessionUser?.role],
  );
  const requestedTab = searchParams.get("tab");
  const resolvedInitialTab: PostCreationTabId =
    requestedTab === "planner" || requestedTab === "scripts"
      ? requestedTab
      : initialTab === "planner" || initialTab === "scripts"
        ? initialTab
        : "scripts";
  const [activeTab, setActiveTab] = useState<PostCreationTabId>(resolvedInitialTab);
  useEffect(() => {
    setActiveTab(resolvedInitialTab);
  }, [resolvedInitialTab]);
  const isPreviewMode =
    status === "unauthenticated" &&
    !(typeof sessionUser?.id === "string" && sessionUser.id.trim().length > 0);

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
      contentClassName="bg-white"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="sticky top-0 z-30 shrink-0 border-b border-zinc-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,255,255,0.94))] px-3.5 pb-3 pt-2 backdrop-blur-md shadow-[0_1px_0_rgba(228,228,231,0.7)]">
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
          {activeTab === "planner" ? (
            <div className="h-full px-3.5 pb-3 pt-1.5">
              <PlannerClientPage
                viewer={viewer}
                compactView
                onNavigateToScripts={() => setActiveTab("scripts")}
              />
            </div>
          ) : (
            <MyScriptsPage
              compactView
              viewer={viewer}
              canInteract={hasPro}
              showPreviewBanner={!isPreviewMode}
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
