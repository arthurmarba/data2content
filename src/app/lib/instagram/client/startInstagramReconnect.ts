import { signIn } from "next-auth/react";
import { track } from "@/lib/track";

export type InstagramReconnectNextTarget = "chat" | "media-kit" | "instagram-connection";

type StartInstagramReconnectOptions = {
  nextTarget: InstagramReconnectNextTarget;
  source?: string;
};

function buildCallbackUrl(nextTarget: InstagramReconnectNextTarget, flowId?: string | null): string {
  const flowIdParam = typeof flowId === "string" && flowId.trim().length > 0
    ? `&flowId=${encodeURIComponent(flowId)}`
    : "";
  return `/dashboard/instagram/connecting?instagramLinked=true&next=${nextTarget}${flowIdParam}`;
}

export async function startInstagramReconnect({
  nextTarget,
  source,
}: StartInstagramReconnectOptions): Promise<void> {
  try {
    if (source) {
      track("ig_reconnect_started", { source });
    }

    const response = await fetch("/api/auth/iniciar-vinculacao-fb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.message || "Falha ao preparar a vinculação.");
    }

    const callbackUrl = buildCallbackUrl(nextTarget, data?.flowId);
    await signIn("facebook", { callbackUrl });
  } catch (error) {
    if (source) {
      track("ig_reconnect_failed", { source, error_code: "UNKNOWN" });
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Erro inesperado ao iniciar a conexão com Facebook.");
  }
}
