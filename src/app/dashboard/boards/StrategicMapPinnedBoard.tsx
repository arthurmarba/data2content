"use client";

import React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import Board from "@/app/dashboard/components/Board";
import type { StrategicMapSummary } from "@/app/lib/strategicMap/loadStrategicMapSummary";

const FULL_MAP_ROUTE = "/dashboard/boards/mobile-strategic-profile";

// Tons da identidade "Seu Mapa" (Perfil mobile): card off-white quente + chips âmbar.
const CARD_BG = "#fffaf7";
const CHIP_BG = "#fef3c7";
const CHIP_TEXT = "#b45309";
const EYEBROW = "#d97706";

type FetchState =
  | { status: "loading" }
  | { status: "ready"; summary: StrategicMapSummary }
  | { status: "error" };

/**
 * Board "Seu Mapa" (vitrine / leitura) na central de controle do desktop.
 * Mostra narrativa + territórios + assets do mapa; clicar abre a experiência
 * completa. Read-only neste passo — a edição vem numa fase posterior.
 */
export default function StrategicMapPinnedBoard({
  showTitleMarker = true,
  isHighlighted = false,
}: {
  showTitleMarker?: boolean;
  isHighlighted?: boolean;
}) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const [state, setState] = React.useState<FetchState>({ status: "loading" });

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      try {
        const res = await fetch("/api/dashboard/strategic-map/summary", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { ok?: boolean; summary?: StrategicMapSummary };
        if (cancelled) return;
        if (json?.ok && json.summary) setState({ status: "ready", summary: json.summary });
        else setState({ status: "error" });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <Board
      title="Seu Mapa"
      showTitleMarker={showTitleMarker}
      titleMarkerVariant="chip"
      variant="card"
      showChevron={false}
      showOptions={false}
      contentClassName="bg-white"
      titleClassName="text-zinc-950"
      isHighlighted={isHighlighted}
    >
      <div style={{ borderRadius: 16, background: CARD_BG, padding: "16px 18px" }}>
        {state.status === "loading" ? (
          <MapSkeleton />
        ) : state.status === "error" || !state.summary.hasMap ? (
          <EmptyMap />
        ) : (
          <MapContent summary={state.summary} />
        )}
      </div>
    </Board>
  );
}

function MapContent({ summary }: { summary: StrategicMapSummary }) {
  return (
    <div>
      {summary.narrative ? (
        <p style={{ fontSize: 18, fontWeight: 700, color: "#18181b", lineHeight: 1.3, letterSpacing: -0.3, margin: "0 0 14px" }}>
          {summary.narrative}
        </p>
      ) : null}

      {summary.territories.length > 0 ? (
        <ChipGroup label="Assuntos" items={summary.territories} />
      ) : null}

      {summary.assets.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <ChipGroup label="Assets de vida" items={summary.assets} />
        </div>
      ) : null}

      <Link
        href={FULL_MAP_ROUTE}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginTop: 16,
          fontSize: 13, fontWeight: 600, color: "#18181b", textDecoration: "none",
        }}
      >
        Abrir mapa completo
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

function ChipGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: EYEBROW, margin: "0 0 7px" }}>
        {label.toUpperCase()}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((it) => (
          <span
            key={it}
            style={{
              fontSize: 12, padding: "4px 11px", borderRadius: 999,
              background: CHIP_BG, color: CHIP_TEXT,
            }}
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

function EmptyMap() {
  return (
    <div style={{ padding: "8px 0" }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: "#18181b", margin: "0 0 6px" }}>
        Seu mapa ainda não está montado
      </p>
      <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.45, margin: "0 0 14px" }}>
        Monte o mapa e sua narrativa, territórios e assets aparecem aqui — base das suas pautas e collabs.
      </p>
      <Link
        href={FULL_MAP_ROUTE}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 600, color: "#fff", background: "#18181b",
          borderRadius: 999, padding: "9px 16px", textDecoration: "none",
        }}
      >
        Montar meu mapa
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

function MapSkeleton() {
  const pulse = { background: "#f1ede9", borderRadius: 8, animation: "d2c-map-pulse 1.1s ease-in-out infinite" } as const;
  return (
    <div>
      <style>{`@keyframes d2c-map-pulse{0%,100%{opacity:1}50%{opacity:.55}}`}</style>
      <div style={{ ...pulse, height: 18, width: "90%", marginBottom: 8 }} />
      <div style={{ ...pulse, height: 18, width: "70%", marginBottom: 16 }} />
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ ...pulse, height: 24, width: 90, borderRadius: 999 }} />
        <div style={{ ...pulse, height: 24, width: 70, borderRadius: 999 }} />
        <div style={{ ...pulse, height: 24, width: 100, borderRadius: 999 }} />
      </div>
    </div>
  );
}
