"use client";

import { useEffect, useRef, useState } from "react";
import type { CreatorStrategicProfileSynthesis } from "@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesis";
import type {
  DiagnosticoCollabSuggestion,
  DiagnosticoCollabSuggestionsState,
  DiagnosticoCreatorDirectoryState,
} from "@/app/dashboard/boards/videoUpload/diagnosticoPageData";
import type { LandingCreatorHighlight } from "@/types/landing";
import { DiagnosticoCategoryDetailView } from "./DiagnosticoCategoryDetailView";
import { DiagnosticoDetailEmptyState } from "./DiagnosticoDetailEmptyState";
import { DiagnosticoCardShell, DiagCardHeader } from "./DiagnosticoCardShell";
import { CATEGORY_META } from "./DiagnosticoCategoryMeta";
import { CARD_P } from "./diagnosticoTokens";
import { StableCreatorAvatar } from "./StableCreatorAvatar";

/** Botão no canto direito do header — abre a tela de Comunidade, onde o paywall protege o grupo. */
function CommunityHeaderButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center justify-center rounded-full bg-[var(--ds-color-ink)] px-4 text-[12px] font-bold text-white transition-transform duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/60"
    >
      Entrar no Grupo
    </button>
  );
}

interface Props {
  synthesis: CreatorStrategicProfileSynthesis;
  instagramConnected?: boolean;
  suggestionsState?: DiagnosticoCollabSuggestionsState;
  creatorDirectory?: DiagnosticoCreatorDirectoryState;
  onConnectInstagram?: () => void;
  /** Called when a free-tier user taps "Ver criadores compatíveis" — opens paywall. */
  onUpgrade?: () => void;
  /** Opens the gated Community detail; the detail decides Pro vs paywall before exposing WhatsApp. */
  onOpenCommunity?: () => void;
  onNewReading?: () => void;
  onClose: () => void;
  /** Slide index to open the carousel at (used when clicking a specific creator from the summary card). */
  initialIndex?: number;
  /** Opens a creator's media kit inline instead of in a new tab. */
  onOpenCreatorMediaKit?: (slug: string) => void;
}

const EMPTY_SUGGESTIONS: DiagnosticoCollabSuggestionsState = {
  status: "idle",
  items: [],
  error: null,
};

const EMPTY_DIRECTORY: DiagnosticoCreatorDirectoryState = {
  status: "idle",
  creators: [],
  error: null,
};

export function DiagnosticoCollabsDetailView({
  synthesis: s,
  instagramConnected = false,
  suggestionsState = EMPTY_SUGGESTIONS,
  creatorDirectory = EMPTY_DIRECTORY,
  onConnectInstagram,
  onUpgrade,
  onOpenCommunity,
  onNewReading,
  onClose,
  initialIndex = 0,
  onOpenCreatorMediaKit,
}: Props) {
  const meta = CATEGORY_META.collabs;
  const isUpgradeRequired = suggestionsState.status === "upgrade_required";
  const instagramRequired =
    !isUpgradeRequired && (!instagramConnected || suggestionsState.status === "blocked");

  // Slugs dos creators curados — usados para destacá-los no diretório da comunidade.
  const matchedSlugs = new Set(
    suggestionsState.items
      .map((i) => i.mediaKitSlug)
      .filter((s): s is string => Boolean(s)),
  );

  return (
    <DiagnosticoCategoryDetailView
      title={meta.title}
      iconBg={meta.iconBg}
      iconSlot={meta.icon}
      onClose={onClose}
      actionSlot={<CommunityHeaderButton onClick={onOpenCommunity} />}
    >
      {isUpgradeRequired ? (
        <UpgradeRequiredCard onUpgrade={onUpgrade} />
      ) : instagramRequired ? (
        <InstagramRequiredCard onConnectInstagram={onConnectInstagram} />
      ) : (
        <SuggestedCollabsSection
          state={suggestionsState}
          onNewReading={onNewReading}
          initialIndex={initialIndex}
          onOpenCreatorMediaKit={onOpenCreatorMediaKit}
        />
      )}

      <CreatorDirectorySection directory={creatorDirectory} matchedSlugs={matchedSlugs} onOpenCreatorMediaKit={onOpenCreatorMediaKit} />
    </DiagnosticoCategoryDetailView>
  );
}

/* ── Upgrade-required state (free tier) ─────────────────────────────── */

function UpgradeRequiredCard({ onUpgrade }: { onUpgrade?: () => void }) {
  return (
    <DiagnosticoCardShell>
      <div className="flex flex-col gap-4 p-6">
        <DiagCardHeader
          iconBg="bg-teal-600"
          iconSlot={<CollabIcon />}
          category="Indicadas pra você"
          catColor="text-teal-700"
        />
        <div>
          <p className="text-[24px] font-bold leading-[1.1] tracking-tight text-zinc-950">
            Seu mapa tem criadores compatíveis
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-zinc-500">
            Com Pro, a D2C sugere criadores cuja narrativa complementa a sua — a partir do seu mapa confirmado, sem depender de métricas.
          </p>
        </div>
        {onUpgrade && (
          <button
            type="button"
            onClick={onUpgrade}
            className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-zinc-950 py-3 text-[14px] font-semibold text-white active:bg-zinc-800"
          >
            Ver criadores compatíveis
          </button>
        )}
      </div>
    </DiagnosticoCardShell>
  );
}

/* ── Instagram-required state ────────────────────────────────────────── */

function InstagramRequiredCard({ onConnectInstagram }: { onConnectInstagram?: () => void }) {
  return (
    <DiagnosticoCardShell>
      <div className="flex flex-col gap-4 p-6">
        <DiagCardHeader
          iconBg="bg-teal-600"
          iconSlot={<CollabIcon />}
          category="Indicadas pra você"
          catColor="text-teal-700"
        />
        <div>
          <p className="text-[24px] font-bold leading-[1.1] tracking-tight text-zinc-950">
            Conecte o Instagram para ver matches
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-zinc-500">
            A D2C cruza sua narrativa com performance real antes de sugerir criadores para collab.
          </p>
        </div>
        {onConnectInstagram && (
          <button
            type="button"
            onClick={onConnectInstagram}
            className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-teal-500 bg-white py-3 text-[14px] font-semibold text-teal-700 active:bg-teal-50"
          >
            Conectar Instagram
          </button>
        )}
      </div>
    </DiagnosticoCardShell>
  );
}

/* ── Suggested collabs section ───────────────────────────────────────── */

function SuggestedCollabsSection({
  state,
  onNewReading,
  initialIndex,
  onOpenCreatorMediaKit,
}: {
  state: DiagnosticoCollabSuggestionsState;
  onNewReading?: () => void;
  initialIndex: number;
  onOpenCreatorMediaKit?: (slug: string) => void;
}) {
  if (state.status === "loading" || state.status === "idle") {
    return (
      <DiagnosticoCardShell>
        <div className={CARD_P}>
          <DiagCardHeader
            iconBg="bg-teal-600"
            iconSlot={<CollabIcon />}
            category="Indicadas pra você"
            catColor="text-teal-700"
          />
          <div className="mt-4 flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex animate-pulse items-center gap-3">
                <div className="h-14 w-14 rounded-full bg-zinc-100" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-32 rounded-full bg-zinc-100" />
                  <div className="h-2.5 w-44 rounded-full bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </DiagnosticoCardShell>
    );
  }

  if (state.status === "error") {
    return (
      <DiagnosticoDetailEmptyState
        iconBg="bg-teal-50"
        iconSlot={<CollabIcon stroke="#0d9488" size={24} />}
        title="Não consegui carregar os matches"
        description={state.error || "As collabs dependem da leitura do Instagram. Tente novamente."}
        ctaLabel={onNewReading ? "Analisar vídeo" : undefined}
        onCta={onNewReading}
      />
    );
  }

  if (!state.items.length) {
    return (
      <DiagnosticoDetailEmptyState
        iconBg="bg-teal-50"
        iconSlot={<CollabIcon stroke="#0d9488" size={24} />}
        title="Collabs aparecem com mais leituras"
        description="A D2C identifica criadores com narrativa compatível depois de detectar consistência no seu conteúdo — geralmente a partir da 3ª análise."
        ctaLabel="Analisar vídeo"
        onCta={onNewReading}
      />
    );
  }

  return <SuggestedCollabsCarousel items={state.items} initialIndex={initialIndex} onOpenCreatorMediaKit={onOpenCreatorMediaKit} />;
}

/* ── Hero carousel — Netflix featured banner style ───────────────────── */

function SuggestedCollabsCarousel({
  items,
  initialIndex,
  onOpenCreatorMediaKit,
}: {
  items: DiagnosticoCollabSuggestion[];
  initialIndex: number;
  onOpenCreatorMediaKit?: (slug: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(Math.min(initialIndex, items.length - 1));

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || initialIndex <= 0) return;
    el.scrollLeft = el.clientWidth * Math.min(initialIndex, items.length - 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(Math.max(0, Math.min(idx, items.length - 1)));
  }

  function scrollTo(i: number) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * i, behavior: "smooth" });
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      aria-label={`Carrossel de collabs, ${activeIndex + 1} de ${items.length}`}
    >
      {items.map((creator, i) => (
        <div key={creator.id} className="w-full flex-shrink-0 snap-center snap-always">
          <CollabCreatorSlide
            creator={creator}
            position={i + 1}
            total={items.length}
            isActive={i === activeIndex}
            onDotClick={scrollTo}
            onOpenCreatorMediaKit={onOpenCreatorMediaKit}
          />
        </div>
      ))}
    </div>
  );
}

/* ── Hero slide — foto full-bleed + gradient + conteúdo sobreposto ───── */

function CollabCreatorSlide({
  creator,
  position,
  total,
  onDotClick,
  onOpenCreatorMediaKit,
}: {
  creator: DiagnosticoCollabSuggestion;
  position: number;
  total: number;
  isActive: boolean;
  onDotClick: (i: number) => void;
  onOpenCreatorMediaKit?: (slug: string) => void;
}) {
  const handle = creator.username
    ? creator.username.startsWith("@")
      ? creator.username
      : `@${creator.username}`
    : null;
  const hasMediaKit = Boolean(creator.mediaKitSlug);
  const fitReason = creator.narrativeFitReason ?? getMatchLabel(creator);
  const sharedChip = creator.sharedSignal;

  return (
    <div className="relative h-[248px] w-full overflow-hidden rounded-3xl bg-zinc-800 ring-1 ring-black/[0.06]">

      {/* Foto de fundo full-bleed */}
      <StableCreatorAvatar
        name={creator.name}
        avatarUrl={creator.avatarUrl}
        creatorId={creator.id}
        mediaKitSlug={creator.mediaKitSlug}
        fallbackText={getInitials(creator.name)}
        fallbackClassName="text-[32px] font-bold text-zinc-500"
        imageStyle={{ objectPosition: "top" }}
        alt={creator.name ?? ""}
      />

      {/* Gradient: escuro embaixo, transparente no topo */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      {/* Badge top-left + contador top-right */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-4">
        <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/90 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
          ✦ Match narrativo
        </span>
        {total > 1 && (
          <span className="rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white/80 backdrop-blur-sm">
            {position} / {total}
          </span>
        )}
      </div>

      {/* Conteúdo inferior sobreposto */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 px-5 pb-4">

        {/* Nome + handle */}
        <div>
          <p className="text-[22px] font-bold leading-tight tracking-tight text-white">
            {creator.name}
          </p>
          {handle && (
            <p className="mt-0.5 text-[12px] text-white/55">{handle}</p>
          )}
        </div>

        {/* Fit reason */}
        <p className="text-[13px] italic leading-snug text-white/80 line-clamp-2">
          &ldquo;{fitReason}&rdquo;
        </p>

        {/* Chip de encontro — glassmorphism */}
        {sharedChip && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11.5px] font-medium text-white backdrop-blur-sm">
            <span aria-hidden="true">⊕</span> {sharedChip}
          </span>
        )}

        {/* Linha inferior: CTA + dots */}
        <div className="flex items-center justify-between pt-1">
          {hasMediaKit ? (
            <button
              type="button"
              onClick={() => {
                if (!creator.mediaKitSlug) return;
                if (onOpenCreatorMediaKit) {
                  onOpenCreatorMediaKit(creator.mediaKitSlug);
                } else {
                  window.open(`/mediakit/${creator.mediaKitSlug}`, "_blank", "noopener,noreferrer");
                }
              }}
              className="inline-flex items-center rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-zinc-900 active:opacity-80"
              aria-label={`Abrir mídia kit de ${creator.name}`}
            >
              Ver Mídia Kit →
            </button>
          ) : (
            <span />
          )}

          {/* Dots de paginação dentro do card */}
          {total > 1 && (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: total }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Ir para criador ${i + 1}`}
                  onClick={() => onDotClick(i)}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    i === position - 1
                      ? "w-5 bg-white"
                      : "w-1.5 bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Community directory ─────────────────────────────────────────────── */

export function CreatorDirectorySection({
  directory,
  matchedSlugs,
  onOpenCreatorMediaKit,
}: {
  directory: DiagnosticoCreatorDirectoryState;
  matchedSlugs: Set<string>;
  onOpenCreatorMediaKit?: (slug: string) => void;
}) {
  if (directory.status === "loading" || directory.status === "idle") {
    return (
      <section className="flex flex-col gap-4 mt-5">
        <div className="-mx-5 overflow-hidden">
          <div className="flex gap-2.5 px-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[140px] w-[100px] shrink-0 animate-pulse rounded-2xl bg-zinc-200" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (directory.status === "error" || directory.creators.length === 0) {
    return (
      <section className="mt-5">
        <DiagnosticoDetailEmptyState
          iconBg="bg-zinc-100"
          iconSlot={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="9" cy="8" r="3" stroke="var(--ds-color-text-muted)" strokeWidth="1.8" />
              <path d="M3 21v-1a6 6 0 0 1 6-6" stroke="var(--ds-color-text-muted)" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          }
          title="Comunidade indisponível"
          description={directory.error || "Não foi possível carregar os criadores agora."}
        />
      </section>
    );
  }

  // Remove creators já exibidos no carrossel — evita duplicação hero + diretório.
  const unmatched = directory.creators.filter(
    (c) => !c.mediaKitSlug || !matchedSlugs.has(c.mediaKitSlug),
  );
  const groups = groupCreatorsByNiche(unmatched);

  return (
    <section className="flex flex-col gap-7 mt-6">
      {groups.map(([niche, creators]) => (
        <DirectoryGroup key={niche} niche={niche} creators={creators} matchedSlugs={matchedSlugs} onOpenCreatorMediaKit={onOpenCreatorMediaKit} />
      ))}
    </section>
  );
}

function DirectoryGroup({
  niche,
  creators,
  matchedSlugs,
  onOpenCreatorMediaKit,
}: {
  niche: string;
  creators: LandingCreatorHighlight[];
  matchedSlugs: Set<string>;
  onOpenCreatorMediaKit?: (slug: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between px-1">
        <h3 className="text-[15px] font-bold text-zinc-900">{niche}</h3>
        <span className="text-[11px] text-zinc-400">
          {creators.length} {creators.length === 1 ? "criador" : "criadores"}
        </span>
      </div>
      <div className="-mx-5 overflow-x-auto overscroll-x-contain">
        <div className="flex gap-2.5 px-5 pb-1">
          {creators.map((creator) => (
            <DirectoryCreatorCard
              key={creator.id}
              creator={creator}
              isMatched={Boolean(creator.mediaKitSlug && matchedSlugs.has(creator.mediaKitSlug))}
              onOpenCreatorMediaKit={onOpenCreatorMediaKit}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* Poster estilo Netflix — foto tall, gradient inferior, texto sobreposto */
function DirectoryCreatorCard({
  creator,
  isMatched,
  onOpenCreatorMediaKit,
}: {
  creator: LandingCreatorHighlight;
  isMatched: boolean;
  onOpenCreatorMediaKit?: (slug: string) => void;
}) {
  // Primeiro nome — cabe melhor em cards estreitos que o @handle truncado
  const firstName = creator.name.split(/\s+/)[0] ?? creator.name;
  const followers = formatCompactMetric(creator.followers);
  const handle = creator.username
    ? creator.username.startsWith("@")
      ? creator.username
      : `@${creator.username}`
    : null;

  const handleClick = creator.mediaKitSlug
    ? () => {
        if (onOpenCreatorMediaKit) {
          onOpenCreatorMediaKit(creator.mediaKitSlug!);
        } else {
          window.open(`/mediakit/${creator.mediaKitSlug}`, "_blank", "noopener,noreferrer");
        }
      }
    : undefined;

  return (
    <div
      role={handleClick ? "button" : undefined}
      tabIndex={handleClick ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleClick ? (e) => { if (e.key === "Enter" || e.key === " ") handleClick(); } : undefined}
      aria-label={handleClick ? `Abrir mídia kit de ${creator.name}` : undefined}
      className="relative h-[148px] w-[104px] shrink-0 overflow-hidden rounded-2xl bg-zinc-800 active:opacity-90"
      style={{ cursor: handleClick ? "pointer" : "default" }}
    >
      {/* Foto de fundo — fill */}
      <StableCreatorAvatar
        name={creator.name}
        avatarUrl={creator.avatarUrl}
        creatorId={creator.id}
        mediaKitSlug={creator.mediaKitSlug}
        fallbackText={getInitials(creator.name)}
        fallbackClassName="text-[22px] font-bold text-zinc-300"
        alt={creator.name}
      />

      {/* Gradient inferior — texto legível sobre qualquer foto */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2.5 pb-3 pt-10">
        <p className="truncate text-[13px] font-bold leading-tight text-white">
          {firstName}
        </p>
        {handle && (
          <p className="mt-0.5 truncate text-[10px] leading-tight text-white/55">{handle}</p>
        )}
        {followers !== "—" && (
          <p className="mt-0.5 text-[10px] font-medium text-white/75">{followers} seg.</p>
        )}
      </div>

      {/* Badge de match — anel + chip teal */}
      {isMatched && (
        <>
          <div className="absolute inset-0 rounded-2xl ring-2 ring-teal-400 ring-inset pointer-events-none" />
          <span className="absolute top-1.5 right-1.5 flex items-center justify-center rounded-full bg-teal-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
            ✦
          </span>
        </>
      )}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function getMatchLabel(creator: DiagnosticoCollabSuggestion) {
  if (creator.matchedTheme) return "Tema parecido com o território narrativo das suas leituras.";
  switch (creator.matchType) {
    case "HIGH_REACH":
    case "AUDIENCE_SCALE":
      return "Narrativa próxima da sua — espaço para uma collab que soma.";
    case "CONSISTENT":
      return "Cria de forma constante em temas próximos aos seus.";
    case "HIGH_ENGAGEMENT":
      return "O jeito de comunicar tem afinidade com o seu.";
    default:
      return "Sinal de afinidade com a sua narrativa atual.";
  }
}

function formatCompactMetric(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return String(Math.round(value));
  }
}

function getInitials(value?: string | null) {
  const parts = (value || "D2C").trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return initials || "D2C";
}

function groupCreatorsByNiche(creators: LandingCreatorHighlight[]): [string, LandingCreatorHighlight[]][] {
  const buckets = new Map<string, LandingCreatorHighlight[]>();
  for (const c of creators) {
    const niche = (c.niches && c.niches[0]) || "Outros";
    const list = buckets.get(niche) ?? [];
    list.push(c);
    buckets.set(niche, list);
  }
  return [...buckets.entries()].sort((a, b) => {
    if (a[0] === "Outros") return 1;
    if (b[0] === "Outros") return -1;
    return b[1].length - a[1].length;
  });
}

function CollabIcon({ stroke = "white", size = 14 }: { stroke?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3" stroke={stroke} strokeWidth="1.8" />
      <path d="M3 21v-1a6 6 0 0 1 6-6" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.5" stroke={stroke} strokeWidth="1.8" />
      <path d="M13 21v-1a5 5 0 0 1 4-4.9" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
