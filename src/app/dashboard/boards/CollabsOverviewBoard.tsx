"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { UsersRound } from "lucide-react";

import DashboardOverviewBoard from "./DashboardOverviewBoard";
import type { ContentIdeaListItem } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";

type LoadState = "idle" | "loading" | "ready" | "error";

export default function CollabsOverviewBoard({
  isHighlighted = false,
}: {
  isHighlighted?: boolean;
}) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const userId = session?.user?.id ?? null;
  const [state, setState] = React.useState<LoadState>("idle");
  const [ideas, setIdeas] = React.useState<ContentIdeaListItem[]>([]);

  React.useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!userId) {
      setState("error");
      return;
    }
    const controller = new AbortController();
    setState("loading");

    void fetch("/api/dashboard/mobile-strategic-profile/content-ideas", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) throw new Error("content_ideas_unavailable");
        setIdeas(Array.isArray(payload.ideas) ? payload.ideas : []);
        setState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });

    return () => controller.abort();
  }, [sessionStatus, userId]);

  const leadingIdea = ideas[0] ?? null;
  const savedCount = ideas.filter((idea) => idea.status === "saved").length;
  const headline = state === "error"
    ? "Suas ideias continuam na página completa"
    : leadingIdea?.title ?? "Pronto para criar suas primeiras ideias?";
  const description = state === "error"
    ? "Não foi possível atualizar o resumo agora."
    : leadingIdea?.whyItFits || leadingIdea?.angle || "Veja ideias ligadas ao seu mapa e sugestões de parceria quando outra pessoa realmente acrescenta algo.";
  const tags = leadingIdea
    ? [leadingIdea.territory, leadingIdea.suggestedFormat, leadingIdea.tone ?? ""].filter(Boolean)
    : [];

  return (
    <DashboardOverviewBoard
      title="Collabs"
      eyebrow={leadingIdea ? "Ideia recomendada" : "Ideias e parcerias"}
      headline={headline}
      description={description}
      icon={UsersRound}
      tone="violet"
      tags={tags}
      stats={[
        { label: "Ideias disponíveis", value: String(ideas.length) },
        { label: "Ideias salvas", value: String(savedCount) },
      ]}
      actionLabel={leadingIdea ? "Explorar todas as ideias" : "Criar ideias"}
      onAction={() => router.push("/dashboard/collabs")}
      isHighlighted={isHighlighted}
      loading={state === "idle" || state === "loading"}
    />
  );
}
