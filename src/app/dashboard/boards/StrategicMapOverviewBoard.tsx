"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Map } from "lucide-react";

import DashboardOverviewBoard from "./DashboardOverviewBoard";
import type { StrategicMapFull } from "@/app/lib/strategicMap/loadStrategicMapFull";

type LoadState = "idle" | "loading" | "ready" | "error";

const MATURITY_LABELS: Record<string, string> = {
  seed: "Mapa inicial",
  instagram_enriched: "Instagram conectado",
  video_enriched: "Evoluindo com vídeos",
};

export default function StrategicMapOverviewBoard({
  isHighlighted = false,
}: {
  isHighlighted?: boolean;
}) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const userId = session?.user?.id ?? null;
  const [state, setState] = React.useState<LoadState>("idle");
  const [full, setFull] = React.useState<StrategicMapFull | null>(null);

  React.useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!userId) {
      setState("error");
      return;
    }
    const controller = new AbortController();
    setState("loading");

    void fetch("/api/dashboard/strategic-map/full", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload.full) throw new Error("strategic_map_unavailable");
        setFull(payload.full as StrategicMapFull);
        setState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });

    return () => controller.abort();
  }, [sessionStatus, userId]);

  const synthesis = full?.synthesis ?? null;
  const mapaSeed = full?.mapaSeed ?? null;
  const narrative =
    mapaSeed?.narrativa_central?.trim() ||
    synthesis?.mainNarrative?.label?.trim() ||
    "Seu posicionamento começa a ganhar forma";
  const description =
    synthesis?.mainNarrative?.summary?.trim() ||
    "Reúna narrativa, territórios e sinais da sua vida real em uma direção clara de conteúdo.";
  const territories = (mapaSeed?.territorios?.length
    ? mapaSeed.territorios
    : synthesis?.narrativeTerritories.map((item) => item.label) ?? []
  ).slice(0, 3);
  const maturity = mapaSeed?.maturidade
    ? MATURITY_LABELS[mapaSeed.maturidade] ?? "Em evolução"
    : full?.hasReadings
      ? "Em evolução"
      : "Mapa inicial";

  return (
    <DashboardOverviewBoard
      title="Seu Mapa"
      eyebrow={state === "error" ? "Resumo indisponível" : "Direção estratégica"}
      headline={state === "error" ? "Abra seu mapa para continuar" : narrative}
      description={state === "error" ? "A página completa continua disponível para consulta e edição." : description}
      icon={Map}
      tone="rose"
      tags={territories}
      stats={[
        { label: "Leituras", value: String(synthesis?.analyzedReadingsCount ?? 0) },
        { label: "Evolução", value: maturity },
      ]}
      actionLabel="Abrir mapa completo"
      onAction={() => router.push("/dashboard/strategic-map")}
      isHighlighted={isHighlighted}
      loading={state === "idle" || state === "loading"}
    />
  );
}
