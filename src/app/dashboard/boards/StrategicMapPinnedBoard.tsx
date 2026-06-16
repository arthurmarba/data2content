"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { MapaCard } from "@/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoPage";
import { resolveDiagnosticoLeadingNarrativeSignal } from "@/app/dashboard/boards/videoUpload/diagnosticoNarrativeSignals";
import type { StrategicMapFull } from "@/app/lib/strategicMap/loadStrategicMapFull";
import type { IMapaData, AssetGroupOverride } from "@/app/models/MapaSeed";
import type {
  ConfirmationState,
  ConfirmationResponse,
  AssetConfirmationResponse,
} from "@/app/dashboard/boards/components/videoUpload/appPreview/diagnosticoConfirmationTypes";

const FULL_MAP_ROUTE = "/dashboard/boards/mobile-strategic-profile";
const FULL_API = "/api/dashboard/strategic-map/full";
const MAP_SEED_API = "/api/dashboard/mobile-strategic-profile/map-seed";
const CONFIRM_API = "/api/dashboard/mobile-strategic-profile/confirm-map-dimension";

type LifeAssetGroup = "cenario" | "objeto" | "vida";
type LoadState = "loading" | "error" | "ready";

/**
 * Board "Seu Mapa" na central de controle do desktop. Renderiza o MESMO MapaCard
 * do mobile (paridade total — seções, chips editáveis com ×/+Adicionar, header com
 * Aprimorar), alimentado pela cozinha completa (GET strategic-map/full) e com a
 * edição persistida via PATCH map-seed (otimista, igual ao mobile). Sem wrapper
 * <Board>: o MapaCard já traz o próprio card.
 */
export default function StrategicMapPinnedBoard({
  isHighlighted = false,
}: {
  showTitleMarker?: boolean;
  isHighlighted?: boolean;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const userId = session?.user?.id ?? null;

  const [state, setState] = React.useState<LoadState>("loading");
  const [full, setFull] = React.useState<StrategicMapFull | null>(null);
  const [mapaSeedLocal, setMapaSeedLocal] = React.useState<IMapaData | null>(null);

  // Estados de confirmação por dimensão (otimistas; init quando full carrega).
  const [narrativeState, setNarrativeState] = React.useState<ConfirmationState>("pending");
  const [territoriesState, setTerritoriesState] = React.useState<ConfirmationState>("pending");
  const [toneState, setToneState] = React.useState<ConfirmationState>("pending");
  const [assetConfirmations, setAssetConfirmations] = React.useState<Map<string, "confirmed" | "dismissed">>(new Map());

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setState("loading");
    (async () => {
      try {
        const res = await fetch(FULL_API, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { ok?: boolean; full?: StrategicMapFull | null };
        if (cancelled) return;
        if (json?.ok && json.full) {
          setFull(json.full);
          setMapaSeedLocal(json.full.mapaSeed ?? null);
          setNarrativeState(json.full.narrativeState);
          setTerritoriesState(json.full.territoriesState);
          setToneState(json.full.toneState);
          const m = new Map<string, "confirmed" | "dismissed">();
          for (const a of json.full.assetConfirmations) {
            if (a.state === "confirmed" || a.state === "dismissed") m.set(a.label, a.state);
          }
          setAssetConfirmations(m);
          setState("ready");
        } else {
          setState("error");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Confirmação por dimensão — otimista local + PATCH confirm-map-dimension
  // (replica os callbacks da shell mobile; falha é silenciosa, UX nunca bloqueia).
  const patchConfirmation = React.useCallback((body: Record<string, string>) => {
    void fetch(CONFIRM_API, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }, []);

  const handleConfirmNarrative = React.useCallback((r: ConfirmationResponse) => {
    setNarrativeState(r === "no" ? "dismissed" : "confirmed");
    patchConfirmation({ dimension: "narrative", response: r });
  }, [patchConfirmation]);

  const handleConfirmTerritories = React.useCallback((r: ConfirmationResponse) => {
    setTerritoriesState(r === "no" ? "dismissed" : "confirmed");
    patchConfirmation({ dimension: "territories", response: r });
  }, [patchConfirmation]);

  const handleConfirmTone = React.useCallback((r: ConfirmationResponse) => {
    setToneState(r === "no" ? "dismissed" : "confirmed");
    patchConfirmation({ dimension: "tone", response: r });
  }, [patchConfirmation]);

  const handleConfirmAsset = React.useCallback((assetLabel: string, r: AssetConfirmationResponse) => {
    setAssetConfirmations((prev) => {
      const next = new Map(prev);
      next.set(assetLabel, r === "no" ? "dismissed" : "confirmed");
      return next;
    });
    patchConfirmation({ dimension: "asset", response: r, assetLabel });
  }, [patchConfirmation]);

  // Edição do mapa — otimista local + PATCH map-seed (replica handleMapSeedMutate
  // do DiagnosticoPage; o refresh do servidor reconcilia).
  const handleMapSeedMutate = React.useCallback(
    (section: string, op: "add" | "remove" | "set", value: string, group?: LifeAssetGroup) => {
      setMapaSeedLocal((prev) => {
        if (!prev) return prev;
        const clone = { ...prev } as Record<string, unknown>;
        if (op === "set") {
          clone[section] = value.slice(0, 200);
          return clone as unknown as IMapaData;
        }
        const arr = Array.isArray(clone[section]) ? [...(clone[section] as string[])] : [];
        if (op === "add") {
          if (!arr.some((v) => v.toLowerCase() === value.toLowerCase())) arr.push(value);
          clone[section] = arr;
        } else {
          clone[section] = arr.filter((v) => v.toLowerCase().trim() !== value.toLowerCase().trim());
        }
        if (section === "assets") {
          const key = value.toLowerCase().trim();
          const groups = (Array.isArray(clone.assetGroups) ? clone.assetGroups : []) as AssetGroupOverride[];
          const without = groups.filter((g) => g.label.toLowerCase().trim() !== key);
          clone.assetGroups = op === "add" && group ? [...without, { label: value, group }] : without;
        }
        return clone as unknown as IMapaData;
      });
      void fetch(MAP_SEED_API, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, op, value, ...(group ? { group } : {}) }),
      }).catch(() => {
        /* non-fatal — otimismo já aplicado; refresh reconcilia */
      });
    },
    [],
  );

  const goFull = React.useCallback(() => router.push(FULL_MAP_ROUTE), [router]);

  const ring = isHighlighted ? "ring-2 ring-orange-300 rounded-[20px]" : "";

  return (
    <div className={`dashboard-scrollbar h-full overflow-y-auto ${ring}`}>
      {state === "loading" ? (
        <MapSkeleton />
      ) : state === "error" || !full ? (
        <EmptyMap onMount={goFull} />
      ) : (
        <MapaCard
          synthesis={full.synthesis}
          leadingNarrative={resolveDiagnosticoLeadingNarrativeSignal(full.synthesis)}
          mapaSeed={mapaSeedLocal}
          onMapSeedMutate={handleMapSeedMutate}
          narrativeConfirmationState={narrativeState}
          onConfirmNarrative={handleConfirmNarrative}
          territoriesConfirmationState={territoriesState}
          onConfirmTerritories={handleConfirmTerritories}
          toneConfirmationState={toneState}
          onConfirmTone={handleConfirmTone}
          onConfirmAsset={handleConfirmAsset}
          assetConfirmations={assetConfirmations}
          endorsedHypotheses={full.endorsedHypotheses}
          dismissedHypotheses={full.dismissedHypotheses}
          adjacentNarrativesFromMap={full.adjacentNarratives as never}
          hasReadings={full.hasReadings}
          onNewReading={goFull}
          onOpenNarrative={goFull}
          onOpenNorte={goFull}
          mapEvolutionStatus={full.mapEvolutionStatus}
          lastReadingAt={full.lastReadingAt}
          hasPurpose={full.hasPurpose}
        />
      )}
    </div>
  );
}

function EmptyMap({ onMount }: { onMount: () => void }) {
  return (
    <div style={{ borderRadius: 20, background: "#fffaf7", padding: "20px 18px" }}>
      <p style={{ fontSize: 15, fontWeight: 700, color: "#18181b", margin: "0 0 6px" }}>Seu Mapa</p>
      <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.45, margin: "0 0 14px" }}>
        Monte seu mapa e sua narrativa, territórios e assets aparecem aqui.
      </p>
      <button
        type="button"
        onClick={onMount}
        style={{
          fontSize: 13, fontWeight: 600, color: "#fff", background: "#18181b",
          borderRadius: 999, padding: "9px 16px", border: "none", cursor: "pointer",
        }}
      >
        Montar meu mapa →
      </button>
    </div>
  );
}

function MapSkeleton() {
  const pulse = { background: "#f1ede9", borderRadius: 8, animation: "d2c-map-pulse 1.1s ease-in-out infinite" } as const;
  return (
    <div style={{ borderRadius: 20, background: "#fffaf7", padding: "18px" }}>
      <style>{`@keyframes d2c-map-pulse{0%,100%{opacity:1}50%{opacity:.55}}`}</style>
      <div style={{ ...pulse, height: 18, width: "85%", marginBottom: 8 }} />
      <div style={{ ...pulse, height: 18, width: "65%", marginBottom: 16 }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {[90, 70, 100, 80].map((w, i) => (
          <div key={i} style={{ ...pulse, height: 24, width: w, borderRadius: 999 }} />
        ))}
      </div>
    </div>
  );
}
