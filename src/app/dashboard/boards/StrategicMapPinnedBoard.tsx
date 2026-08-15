"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Compass, History, Layers3, ScanSearch } from "lucide-react";

import Board from "@/app/dashboard/components/Board";
import { useToast } from "@/app/components/ui/ToastA11yProvider";
import { MapaCard } from "@/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoPage";
import { resolveDiagnosticoLeadingNarrativeSignal } from "@/app/dashboard/boards/videoUpload/diagnosticoNarrativeSignals";
import { applyStrategicMapMutation } from "@/app/lib/strategicMap/applyStrategicMapMutation";
import type { StrategicMapFull } from "@/app/lib/strategicMap/loadStrategicMapFull";
import type { IMapaData } from "@/app/models/MapaSeed";
import type {
  ConfirmationState,
  ConfirmationResponse,
  AssetConfirmationResponse,
} from "@/app/dashboard/boards/components/videoUpload/appPreview/diagnosticoConfirmationTypes";
import { CREATOR_PROFILE_ROUTE } from "@/constants/routes";

const FULL_API = "/api/dashboard/strategic-map/full";
const MAP_SEED_API = "/api/dashboard/mobile-strategic-profile/map-seed";
const CONFIRM_API = "/api/dashboard/mobile-strategic-profile/confirm-map-dimension";

type LifeAssetGroup = "cenario" | "objeto" | "vida";
type LoadState = "loading" | "error" | "ready";
type SaveState = "idle" | "saving" | "saved" | "error";
type MapMutation = (
  section: string,
  op: "add" | "remove" | "set",
  value: string,
  group?: LifeAssetGroup,
) => void;

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
  const { toast } = useToast();
  const userId = session?.user?.id ?? null;

  const [state, setState] = React.useState<LoadState>("loading");
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [full, setFull] = React.useState<StrategicMapFull | null>(null);
  const [mapaSeedLocal, setMapaSeedLocal] = React.useState<IMapaData | null>(null);
  const loadRequestRef = React.useRef(0);
  const pendingSavesRef = React.useRef(0);
  const savedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutationRef = React.useRef<MapMutation>(() => {});

  // Estados de confirmação por dimensão (otimistas; init quando full carrega).
  const [narrativeState, setNarrativeState] = React.useState<ConfirmationState>("pending");
  const [territoriesState, setTerritoriesState] = React.useState<ConfirmationState>("pending");
  const [toneState, setToneState] = React.useState<ConfirmationState>("pending");
  const [assetConfirmations, setAssetConfirmations] = React.useState<Map<string, "confirmed" | "dismissed">>(new Map());

  const hydrateFull = React.useCallback((nextFull: StrategicMapFull) => {
    setFull(nextFull);
    setMapaSeedLocal(nextFull.mapaSeed ?? null);
    setNarrativeState(nextFull.narrativeState);
    setTerritoriesState(nextFull.territoriesState);
    setToneState(nextFull.toneState);
    const nextAssetConfirmations = new Map<string, "confirmed" | "dismissed">();
    for (const asset of nextFull.assetConfirmations) {
      if (asset.state === "confirmed" || asset.state === "dismissed") {
        nextAssetConfirmations.set(asset.label, asset.state);
      }
    }
    setAssetConfirmations(nextAssetConfirmations);
  }, []);

  const loadMap = React.useCallback(async (showLoading = true) => {
    if (!userId) return false;
    const requestId = ++loadRequestRef.current;
    if (showLoading) setState("loading");

    try {
      const response = await fetch(FULL_API, { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const json = (await response.json()) as { ok?: boolean; full?: StrategicMapFull | null };
      if (requestId !== loadRequestRef.current) return false;
      if (!json?.ok || !json.full) throw new Error("empty_map");
      hydrateFull(json.full);
      setState("ready");
      return true;
    } catch {
      if (requestId === loadRequestRef.current) setState("error");
      return false;
    }
  }, [hydrateFull, userId]);

  React.useEffect(() => {
    if (!userId) return;
    void loadMap();
  }, [loadMap, userId]);

  React.useEffect(() => () => {
    loadRequestRef.current += 1;
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, []);

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

  // Edição do mapa — resposta imediata na interface, confirmação explícita e
  // reconciliação com o servidor em qualquer falha.
  const handleMapSeedMutate = React.useCallback(
    (section: string, op: "add" | "remove" | "set", value: string, group?: LifeAssetGroup) => {
      setMapaSeedLocal((previous) => previous
        ? applyStrategicMapMutation(previous, section, op, value, group)
        : previous);

      pendingSavesRef.current += 1;
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      setSaveState("saving");

      void (async () => {
        try {
          const response = await fetch(MAP_SEED_API, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ section, op, value, ...(group ? { group } : {}) }),
          });
          if (!response.ok) throw new Error(String(response.status));

          pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
          if (pendingSavesRef.current === 0) {
            setSaveState("saved");
            savedTimerRef.current = setTimeout(() => setSaveState("idle"), 1800);
          }

          if (op === "remove") {
            toast({
              title: "Item removido do mapa.",
              variant: "info",
              priority: "low",
              action: {
                label: "Desfazer",
                closeOnAction: true,
                onClick: () => mutationRef.current(section, "add", value, group),
              },
            });
          }
        } catch {
          pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
          setSaveState("error");
          const restored = await loadMap(false);
          toast({
            title: "Não foi possível salvar o mapa.",
            description: restored
              ? "As informações salvas anteriormente foram restauradas."
              : "Tente novamente em alguns instantes.",
            variant: "error",
            priority: "high",
          });
        }
      })();
    },
    [loadMap, toast],
  );

  mutationRef.current = handleMapSeedMutate;

  const openProfileAction = React.useCallback((action: "analyze" | "north") => {
    router.push(`${CREATOR_PROFILE_ROUTE}?action=${action}`);
  }, [router]);
  const openAnalysis = React.useCallback(() => openProfileAction("analyze"), [openProfileAction]);
  const openNorth = React.useCallback(() => openProfileAction("north"), [openProfileAction]);

  return (
    <Board
      title="Seu Mapa"
      showTitleMarker={showTitleMarker}
      titleMarkerVariant="chip"
      variant={dedicatedView ? "workspace" : "card"}
      showChevron={false}
      showOptions={false}
      hideTitleBar={dedicatedView}
      contentClassName={`h-full ${dedicatedView ? "bg-[var(--ds-color-paper)] px-4 pb-8 pt-5 sm:px-5 lg:bg-[#fffaf7] lg:p-7" : "flex flex-col bg-[#fffaf7] p-5"}`}
      titleClassName="text-zinc-950"
      isHighlighted={isHighlighted}
    >
      {state === "loading" ? (
        <MapSkeleton />
      ) : state === "error" || !full ? (
        <MapLoadError onRetry={() => void loadMap()} />
      ) : dedicatedView ? (
        <div className="grid min-h-full gap-7 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-9 xl:grid-cols-[16rem_minmax(0,1fr)]">
          <StrategicMapWorkspaceSummary
            full={full}
            mapaSeed={mapaSeedLocal}
          />
          <section
            aria-label="Editor do mapa estratégico"
            className="order-1 min-w-0 lg:order-2 lg:rounded-[28px] lg:border lg:border-zinc-200/70 lg:bg-white/80 lg:p-7 lg:shadow-[0_18px_50px_rgba(24,24,27,0.055)]"
          >
            <StrategicMapMobileContext full={full} mapaSeed={mapaSeedLocal} />
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
              onNewReading={openAnalysis}
              onOpenNorte={openNorth}
              mapEvolutionStatus={full.mapEvolutionStatus}
              lastReadingAt={full.lastReadingAt}
              hasPurpose={full.hasPurpose}
              noShell
              headerTitle="Editar mapa"
              headerActionLabel="Analisar conteúdo"
              headerActionCompactLabel="Analisar"
              saveStatus={saveState}
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
          onNewReading={openAnalysis}
          onOpenNorte={openNorth}
          mapEvolutionStatus={full.mapEvolutionStatus}
          lastReadingAt={full.lastReadingAt}
          hasPurpose={full.hasPurpose}
          noShell
          saveStatus={saveState}
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
}: {
  full: StrategicMapFull;
  mapaSeed: IMapaData | null;
}) {
  const maturity = mapaSeed?.maturidade
    ? MATURITY_LABELS[mapaSeed.maturidade] ?? "Em evolução"
    : "Em evolução";

  return (
    <aside
      className="order-2 min-w-0 border-t border-zinc-200/80 pt-6 lg:order-1 lg:sticky lg:top-0 lg:self-start lg:border-0 lg:pt-0"
      aria-label="Sobre este mapa"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
          <Compass className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-rose-600">Sobre este mapa</p>
          <p className="mt-0.5 text-sm font-semibold text-zinc-950">{maturity}</p>
        </div>
      </div>

      <p className="mt-5 text-sm leading-6 text-zinc-600">
        {formatMapSourceSentence(mapaSeed?.fonte)} Ele evolui com o que você confirma e adiciona.
      </p>

      <dl className="mt-6 space-y-5 border-y border-zinc-200/80 py-5">
        <div className="flex items-start gap-3">
          <ScanSearch className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">Conteúdos analisados</dt>
            <dd className="mt-1 text-sm font-medium text-zinc-800">
              {full.synthesis.analyzedReadingsCount}
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <History className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">Última atualização</dt>
            <dd className="mt-1 text-sm font-medium text-zinc-800">{formatMapDate(full.updatedAt ?? full.lastReadingAt)}</dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Layers3 className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">Origem</dt>
            <dd className="mt-1 text-sm font-medium leading-5 text-zinc-800">
              {formatMapSources(mapaSeed?.fonte)}
            </dd>
          </div>
        </div>
      </dl>

      <p className="mt-7 text-[12px] leading-5 text-zinc-500">
        Suas edições ficam no mapa e orientam relatórios, pautas e recomendações.
      </p>
    </aside>
  );
}

function StrategicMapMobileContext({ full, mapaSeed }: { full: StrategicMapFull; mapaSeed: IMapaData | null }) {
  return (
    <div className="mb-6 border-b border-zinc-200/80 pb-5 lg:hidden">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-rose-600">Mapa em evolução</p>
      <p className="mt-1.5 text-sm leading-5 text-zinc-600">
        {formatMapSources(mapaSeed?.fonte)} · {full.synthesis.analyzedReadingsCount} {full.synthesis.analyzedReadingsCount === 1 ? "conteúdo analisado" : "conteúdos analisados"}
      </p>
    </div>
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

function formatMapSourceSentence(sources?: IMapaData["fonte"]) {
  if (sources?.includes("instagram") && sources.includes("video")) {
    return "Construído a partir do seu Norte, Instagram e conteúdos analisados.";
  }
  if (sources?.includes("instagram")) {
    return "Construído a partir do seu Norte e do Instagram.";
  }
  if (sources?.includes("video")) {
    return "Construído a partir do seu Norte e dos conteúdos analisados.";
  }
  return "Construído a partir do seu Norte.";
}

function formatMapDate(value?: string | null) {
  if (!value) return "Ainda sem atualização";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ainda sem atualização";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function MapLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto flex min-h-[16rem] max-w-md flex-col items-start justify-center py-10">
      <p className="text-lg font-semibold tracking-[-0.02em] text-zinc-950">
        Não foi possível abrir seu mapa.
      </p>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        Seus dados continuam salvos. Tente carregar novamente.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 min-h-11 rounded-full border border-rose-200 bg-rose-50 px-5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
      >
        Tentar novamente
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
