"use client";

import { useCallback, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";

import Board from "@/app/dashboard/components/Board";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { startInstagramReconnect } from "@/app/lib/instagram/client/startInstagramReconnect";
import { redirectToGoogleConsentLogin } from "@/lib/auth/googleLogin";
import { track } from "@/lib/track";
import {
  PAYWALL_AUTOSTART_PARAM,
  PAYWALL_CONTEXT_PARAM,
  PAYWALL_RETURN_STORAGE_KEY,
  PAYWALL_URL_PARAM,
} from "@/types/paywall";
import { openPaywallModal } from "@/utils/paywallModal";

import BoardPinButton from "./BoardPinButton";
import type { PostCreationFunnelStage } from "./postCreationFunnel";
import PostCreationFunnelBoardShell from "./PostCreationFunnelBoardShell";

export default function PostCreationPinnedBoard({
  initialTab,
  isHighlighted = false,
}: {
  initialTab?: "planner" | "scripts";
  isHighlighted?: boolean;
}) {
  const { data: session, status } = useSession();
  const billing = useBillingStatus();
  const hasPro = billing.hasPremiumAccess;

  const sessionUser = session?.user as
    | {
        id?: string | null;
        role?: string | null;
        name?: string | null;
        instagramConnected?: boolean | null;
        accountState?: "pre_signup" | "registered" | "merged" | null;
        postCreationTrial?: {
          startedAt?: string | null;
          analysisUsedAt?: string | null;
          pautaUsedAt?: string | null;
          firstDraftId?: string | null;
          instagramAccountId?: string | null;
          completedSignupAt?: string | null;
          subscribedAt?: string | null;
          source?: string | null;
        } | null;
      }
    | undefined;
  const [activationPending, setActivationPending] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  const viewer = useMemo(
    () => ({
      id: sessionUser?.id ?? "",
      role: sessionUser?.role ?? null,
      name: sessionUser?.name ?? null,
      instagramConnected: sessionUser?.instagramConnected ?? false,
      accountState: sessionUser?.accountState ?? null,
      postCreationTrial: sessionUser?.postCreationTrial ?? null,
    }),
    [
      sessionUser?.accountState,
      sessionUser?.id,
      sessionUser?.instagramConnected,
      sessionUser?.name,
      sessionUser?.postCreationTrial,
      sessionUser?.role,
    ],
  );

  const isPreviewMode =
    status === "unauthenticated" &&
    !(typeof sessionUser?.id === "string" && sessionUser.id.trim().length > 0);

  const getCurrentReturnTo = useCallback(() => {
    const callbackUrl =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}${window.location.hash}`
        : "/calendar";
    return callbackUrl;
  }, []);

  const postAcquisitionEvent = useCallback(
    (eventName: string, targetUserId?: string | null, metadata?: Record<string, unknown>) => {
      const creatorId = targetUserId || viewer.id || null;
      track(eventName, {
        creator_id: creatorId,
        source: metadata?.source || "post_creation_board_trial",
        account_state: viewer.accountState,
        instagram_connected: viewer.instagramConnected,
        ...metadata,
      } as any);

      if (!creatorId) return;
      void fetch("/api/post-creation/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          eventName,
          stage: "path",
          source: String(metadata?.source || "post_creation_board_trial"),
          targetUserId: creatorId,
          metadata: {
            accountState: viewer.accountState,
            instagramConnected: viewer.instagramConnected,
            ...metadata,
          },
        }),
      }).catch(() => undefined);
    },
    [viewer.accountState, viewer.id, viewer.instagramConnected],
  );

  const buildSignupPaywallReturnTo = useCallback(
    (source?: string) => {
      const returnTo = getCurrentReturnTo();
      const paywallSource = source || "post_creation_board_account_gate";

      if (typeof window === "undefined") {
        return `/calendar?${PAYWALL_URL_PARAM}=1&${PAYWALL_CONTEXT_PARAM}=planning&${PAYWALL_AUTOSTART_PARAM}=1`;
      }

      try {
        window.sessionStorage.setItem(
          PAYWALL_RETURN_STORAGE_KEY,
          JSON.stringify({
            context: "planning",
            source: paywallSource,
            returnTo,
            ts: Date.now(),
          }),
        );
      } catch (_) {
        // sessão pode estar indisponível em modo privado; o callbackUrl ainda preserva o contexto.
      }

      const callback = new URL(returnTo || "/calendar", window.location.origin);
      callback.searchParams.set(PAYWALL_URL_PARAM, "1");
      callback.searchParams.set(PAYWALL_CONTEXT_PARAM, "planning");
      callback.searchParams.set(PAYWALL_AUTOSTART_PARAM, "1");
      return `${callback.pathname}${callback.search}${callback.hash}`;
    },
    [getCurrentReturnTo],
  );

  const handleActivateBoard = useCallback(async (acceptedLegal = false) => {
    if (activationPending || status === "loading") return;
    if (!acceptedLegal) {
      setActivationError("Aceite os Termos e a Política de Privacidade para conectar o Instagram.");
      postAcquisitionEvent("post_creation_legal_consent_missing", null, {
        source: "post_creation_board_trial",
      });
      return;
    }
    setActivationPending(true);
    setActivationError(null);
    let trialUserId: string | null = sessionUser?.id || null;
    postAcquisitionEvent("post_creation_trial_connect_clicked", trialUserId, {
      source: "post_creation_board_trial",
      acceptedLegal: true,
    });
    try {
      if (!sessionUser?.id) {
        const response = await fetch("/api/post-creation/trial/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acceptedLegal: true }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok || !data?.loginToken) {
          throw new Error(data?.error || "Não foi possível iniciar o teste.");
        }
        trialUserId = typeof data?.userId === "string" ? data.userId : null;
        const result = await signIn("credentials", {
          redirect: false,
          boardTrialToken: data.loginToken,
        } as any);
        if (result?.error) {
          throw new Error("Não foi possível criar a sessão de teste.");
        }
        postAcquisitionEvent("post_creation_trial_started", trialUserId, {
          source: "post_creation_board_trial",
          accountState: "pre_signup",
        });
      } else {
        await fetch("/api/post-creation/trial/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acceptedLegal: true }),
        }).catch(() => null);
        postAcquisitionEvent("post_creation_trial_started", trialUserId, {
          source: "post_creation_board_trial",
          accountState: viewer.accountState,
        });
      }

      postAcquisitionEvent("post_creation_instagram_connect_started", trialUserId, {
        source: "post_creation_board_trial",
      });
      await startInstagramReconnect({
        nextTarget: "post-creation",
        source: "post_creation_board_trial",
      });
    } catch (error) {
      console.error("[post-creation] Falha ao iniciar trial do board:", error);
      postAcquisitionEvent("post_creation_instagram_connect_failed", trialUserId, {
        source: "post_creation_board_trial",
        message: error instanceof Error ? error.message : "unknown",
      });
      setActivationError(
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível abrir a conexão do Instagram. Tente novamente.",
      );
    } finally {
      setActivationPending(false);
    }
  }, [
    activationPending,
    postAcquisitionEvent,
    sessionUser?.id,
    status,
    viewer.accountState,
  ]);

  const handleRequestAccountGate = useCallback(
    (source?: string) => {
      postAcquisitionEvent("post_creation_account_gate_opened", viewer.id, {
        source: source || "post_creation_board_account_gate",
      });
      redirectToGoogleConsentLogin(buildSignupPaywallReturnTo(source));
    },
    [buildSignupPaywallReturnTo, postAcquisitionEvent, viewer.id],
  );

  const handleRequestPaywall = useCallback(
    (source?: string) => {
      postAcquisitionEvent("post_creation_paywall_opened", viewer.id, {
        source: source || "post_creation_board_gate",
      });
      openPaywallModal({
        context: "planning",
        source: source || "post_creation_board_gate",
        returnTo: getCurrentReturnTo(),
      });
    },
    [getCurrentReturnTo, postAcquisitionEvent, viewer.id],
  );

  const initialFocusStage: PostCreationFunnelStage =
    initialTab === "scripts" ? "script" : "path";
  const shouldShowPinAction =
    !isPreviewMode && !(viewer.accountState === "pre_signup" && !viewer.instagramConnected);

  return (
    <Board
      title="Criação de Post"
      headerClassName="hidden sm:block"
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
      contentClassName="bg-white"
      titleClassName="text-zinc-950"
      isHighlighted={isHighlighted}
    >
      <PostCreationFunnelBoardShell
        viewer={viewer}
        canInteract={hasPro}
        viewerPending={status === "loading" || activationPending}
        previewMode={isPreviewMode}
        initialInstagramConnected={Boolean(sessionUser?.instagramConnected)}
        isHighlighted={isHighlighted}
        initialFocusStage={initialFocusStage}
        surfaceMode="board"
        onActivatePreview={handleActivateBoard}
        onRequestAccountGate={handleRequestAccountGate}
        onRequestPaywall={handleRequestPaywall}
        activationPending={activationPending}
        activationError={activationError}
      />
    </Board>
  );
}
