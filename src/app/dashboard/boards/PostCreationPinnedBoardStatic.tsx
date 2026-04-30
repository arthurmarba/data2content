"use client";

import { useCallback, useState } from "react";
import { signIn } from "next-auth/react";

import Board from "@/app/dashboard/components/Board";
import { startInstagramReconnect } from "@/app/lib/instagram/client/startInstagramReconnect";

import BoardPinButton from "./BoardPinButton";
import type { PostCreationFunnelStage } from "./postCreationFunnel";
import PostCreationFunnelBoardShell from "./PostCreationFunnelBoardShell";

type ViewerInfo = {
  id?: string | null;
  role?: string | null;
  name?: string | null;
};

export default function PostCreationPinnedBoardStatic({
  initialTab,
  viewer,
  canInteract = false,
  viewerPending = false,
  previewMode = false,
  initialInstagramConnected = false,
}: {
  initialTab?: "planner" | "scripts";
  viewer?: ViewerInfo;
  canInteract?: boolean;
  viewerPending?: boolean;
  previewMode?: boolean;
  initialInstagramConnected?: boolean;
}) {
  const [activationPending, setActivationPending] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const initialFocusStage: PostCreationFunnelStage =
    initialTab === "scripts" ? "script" : "path";

  const handleActivateBoard = useCallback(async (acceptedLegal = false) => {
    if (activationPending) return;
    if (!acceptedLegal) {
      setActivationError("Aceite os Termos e a Política de Privacidade para conectar o Instagram.");
      return;
    }
    setActivationPending(true);
    setActivationError(null);
    try {
      if (!viewer?.id) {
        const response = await fetch("/api/post-creation/trial/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acceptedLegal: true }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok || !data?.loginToken) {
          throw new Error(data?.error || "Não foi possível iniciar o teste.");
        }
        const result = await signIn("credentials", {
          redirect: false,
          boardTrialToken: data.loginToken,
        } as any);
        if (result?.error) {
          throw new Error("Não foi possível criar a sessão de teste.");
        }
      }

      await startInstagramReconnect({
        nextTarget: "post-creation",
        source: "post_creation_board_trial",
      });
    } catch (error) {
      setActivationError(
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível abrir a conexão do Instagram. Tente novamente.",
      );
    } finally {
      setActivationPending(false);
    }
  }, [activationPending, viewer?.id]);

  const shouldShowPinAction = !previewMode && initialInstagramConnected;

  return (
    <Board
      title="Criação de Post"
      titleInlineAction={
        shouldShowPinAction ? (
          <BoardPinButton
            boardId="post-creation"
            boardTitle="Criação de Post"
            redirectOnPin={false}
          />
        ) : null
      }
      showTitleMarker={false}
      variant="card"
      showChevron={false}
      showOptions={false}
      className="mx-auto h-full"
      contentClassName="bg-[#0a0a0b]"
      titleClassName="text-zinc-950"
    >
      <PostCreationFunnelBoardShell
        viewer={viewer}
        canInteract={canInteract}
        viewerPending={viewerPending}
        previewMode={previewMode}
        initialInstagramConnected={initialInstagramConnected}
        initialFocusStage={initialFocusStage}
        surfaceMode="board"
        onActivatePreview={handleActivateBoard}
        activationPending={activationPending}
        activationError={activationError}
      />
    </Board>
  );
}
