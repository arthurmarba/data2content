"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CircleCheck, Compass, Layers3, ScanSearch } from "lucide-react";

import Board from "@/app/dashboard/components/Board";
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
  showTitleMarker = true,
  isHighlighted = false,
  dedicatedView = false,
}: {
  showTitleMarker?: boolean;
  isHighlighted?: boolean;
  dedicatedView?: boolean;
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

  return (
    <Board
      title="Seu Mapa"
      showTitleMarker={showTitleMarker}
      titleMarkerVariant="chip"
      variant={dedicatedView ? "workspace" : "card"}
      showChevron={false}
      showOptions={false}
      hideTitleBar={dedicatedView}
      contentClassName={`bg-[#fffaf7] h-full ${dedicatedView ? "p-5 lg:p-7" : "flex flex-col p-5"}`}
      titleClassName="text-zinc-950"
      isHighlighted={isHighlighted}
    >
      {state === "loading" ? (
        <MapSkeleton />
      ) : state === "error" || !full ? (
        <EmptyMap onMount={goFull} />
      ) : dedicatedView ? (
        <div className="grid min-h-full gap-7 lg:grid-cols-[17rem_minmax(0,1fr)] xl:gap-9">
          <StrategicMapWorkspaceSummary
            full={full}
            mapaSeed={mapaSeedLocal}
            narrativeState={narrativeState}
            territoriesState={territoriesState}
            toneState={toneState}
          />
          <section
            aria-label="Editor do mapa estratégico"
            className="min-w-0 rounded-[28px] border border-zinc-200/70 bg-white/80 p-5 shadow-[0_18px_50px_rgba(24,24,27,0.055)] sm:p-6 lg:p-7"
          >
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
              noShell
              headerTitle="Editor do mapa"
            />
          </section>
        </div>
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
          noShell
        />
      )}
    </Board>
  );
}

const MATURITY_LABELS: Record<string, string> = {
  seed: "Mapa inicial",
  instagram_enriched: "Enriquecido pelo Instagram",
  video_enriched: "Enriquecido por vídeos",
};

function StrategicMapWorkspaceSummary({
  full,
  mapaSeed,
  narrativeState,
  territoriesState,
  toneState,
}: {
  full: StrategicMapFull;
  mapaSeed: IMapaData | null;
  narrativeState: ConfirmationState;
  territoriesState: ConfirmationState;
  toneState: ConfirmationState;
}) {
  const dimensions = [
    { label: "Narrativa", ready: narrativeState === "confirmed" },
    { label: "Territórios", ready: territoriesState === "confirmed" },
    { label: "Tom de voz", ready: toneState === "confirmed" },
    { label: "Vida real", ready: (mapaSeed?.assets?.length ?? 0) > 0 },
  ];
  const readyCount = dimensions.filter((dimension) => dimension.ready).length;
  const nextDimension = dimensions.find((dimension) => !dimension.ready) ?? null;
  const progress = Math.round((readyCount / dimensions.length) * 100);
  const maturity = mapaSeed?.maturidade
    ? MATURITY_LABELS[mapaSeed.maturidade] ?? "Em evolução"
    : "Em evolução";

  return (
    <aside className="min-w-0 lg:sticky lg:top-0 lg:self-start" aria-label="Resumo do mapa">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
          <Compass className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-rose-600">Status do mapa</p>
          <p className="mt-0.5 text-sm font-semibold text-zinc-950">{maturity}</p>
        </div>
      </div>

      <div className="mt-7 border-y border-zinc-200/80 py-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium text-zinc-500">Dimensões confirmadas</p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-zinc-950">
              {readyCount} de {dimensions.length}
            </p>
          </div>
          <span className="text-sm font-semibold text-rose-600">{progress}%</span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-200/80">
          <div
            className="h-full rounded-full bg-rose-500 transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <ul className="mt-5 space-y-1" aria-label="Dimensões do mapa">
        {dimensions.map((dimension) => (
          <li key={dimension.label} className="flex min-h-10 items-center justify-between gap-3 border-b border-zinc-200/60 py-2 last:border-0">
            <span className="text-sm text-zinc-700">{dimension.label}</span>
            <span className={dimension.ready ? "text-emerald-600" : "text-zinc-300"}>
              <CircleCheck className="h-[18px] w-[18px]" aria-hidden="true" />
              <span className="sr-only">{dimension.ready ? "Confirmada" : "Pendente"}</span>
            </span>
          </li>
        ))}
      </ul>

      {nextDimension ? (
        <div className="mt-5 border-l-2 border-rose-400 pl-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-rose-600">Próximo passo</p>
          <p className="mt-1 text-sm font-medium text-zinc-800">Confirme {nextDimension.label.toLocaleLowerCase("pt-BR")} no editor.</p>
        </div>
      ) : null}

      <dl className="mt-6 space-y-4">
        <div className="flex items-start gap-3">
          <ScanSearch className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">Análises</dt>
            <dd className="mt-1 text-sm font-medium text-zinc-800">{full.synthesis.analyzedReadingsCount} incorporadas</dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Layers3 className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">Fontes</dt>
            <dd className="mt-1 text-sm font-medium leading-5 text-zinc-800">
              {formatMapSources(mapaSeed?.fonte)}
            </dd>
          </div>
        </div>
      </dl>

      <p className="mt-7 text-[12px] leading-5 text-zinc-500">
        Edite os sinais ao lado. Suas escolhas passam a orientar pautas, collabs e recomendações.
      </p>
    </aside>
  );
}

function formatMapSources(sources?: IMapaData["fonte"]) {
  if (!sources?.length) return "Onboarding";
  const labels: Record<IMapaData["fonte"][number], string> = {
    onboarding_declarativo: "Onboarding",
    instagram: "Instagram",
    video: "Vídeos",
  };
  return sources.map((source) => labels[source]).join(" · ");
}

function EmptyMap({ onMount }: { onMount: () => void }) {
  return (
    <div style={{ padding: "8px 0" }}>
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
  const pulse = { background: "#e5e5e7", borderRadius: 8, animation: "d2c-map-pulse 1.1s ease-in-out infinite" } as const;
  return (
    <div style={{ padding: "8px 0" }}>
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
