"use client";

import Image from "next/image";
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
import { HC, CARD_P } from "./diagnosticoTokens";

interface Props {
  synthesis: CreatorStrategicProfileSynthesis;
  instagramConnected?: boolean;
  suggestionsState?: DiagnosticoCollabSuggestionsState;
  creatorDirectory?: DiagnosticoCreatorDirectoryState;
  onConnectInstagram?: () => void;
  /** Called when a free-tier user taps "Ver criadores compatíveis" — opens paywall. */
  onUpgrade?: () => void;
  onNewReading?: () => void;
  onClose: () => void;
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
  onNewReading,
  onClose,
}: Props) {
  const meta = CATEGORY_META.collabs;
  const hasFormats = s.collabTerritories.length > 0;

  // Fase C: "upgrade_required" is distinct from "blocked" (no Instagram).
  // upgrade_required = free tier blocked by plan; blocked = Instagram not connected.
  const isUpgradeRequired = suggestionsState.status === "upgrade_required";
  const instagramRequired =
    !isUpgradeRequired && (!instagramConnected || suggestionsState.status === "blocked");

  return (
    <DiagnosticoCategoryDetailView
      title={meta.title}
      iconBg={meta.iconBg}
      iconSlot={meta.icon}
      onClose={onClose}
    >
      {isUpgradeRequired ? (
        <UpgradeRequiredCard onUpgrade={onUpgrade} />
      ) : instagramRequired ? (
        <InstagramRequiredCard onConnectInstagram={onConnectInstagram} />
      ) : (
        <SuggestedCollabsSection
          state={suggestionsState}
          onNewReading={onNewReading}
        />
      )}

      {hasFormats && <CollabFormatsCard synthesis={s} />}

      <CreatorDirectorySection directory={creatorDirectory} />
    </DiagnosticoCategoryDetailView>
  );
}

/* ── Upgrade-required state (free tier) ─────────────────────────────── */

function UpgradeRequiredCard({ onUpgrade }: { onUpgrade?: () => void }) {
  return (
    <DiagnosticoCardShell>
      <div className="flex flex-col gap-4 p-6">
        <DiagCardHeader
          iconBg={HC.hypothesis.bg}
          iconSlot={<CollabIcon />}
          category="Collabs indicadas"
          catColor={HC.hypothesis.text}
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
          iconBg={HC.hypothesis.bg}
          iconSlot={<CollabIcon />}
          category="Collabs indicadas"
          catColor={HC.hypothesis.text}
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
            className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-indigo-500 bg-white py-3 text-[14px] font-semibold text-indigo-600 active:bg-indigo-50"
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
}: {
  state: DiagnosticoCollabSuggestionsState;
  onNewReading?: () => void;
}) {
  if (state.status === "loading" || state.status === "idle") {
    return (
      <DiagnosticoCardShell>
        <div className={CARD_P}>
          <DiagCardHeader
            iconBg={HC.hypothesis.bg}
            iconSlot={<CollabIcon />}
            category="Collabs indicadas"
            catColor={HC.hypothesis.text}
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
        iconBg="bg-indigo-50"
        iconSlot={<CollabIcon stroke="#6366f1" size={24} />}
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
        iconBg="bg-indigo-50"
        iconSlot={<CollabIcon stroke="#6366f1" size={24} />}
        title="Collabs aparecem com mais leituras"
        description="A D2C identifica criadores com narrativa compatível depois de detectar consistência no seu conteúdo — geralmente a partir da 3ª análise."
        ctaLabel="Analisar vídeo"
        onCta={onNewReading}
      />
    );
  }

  return <SuggestedCollabsCard items={state.items} />;
}

/**
 * Calm Edition creator cards — one per creator, breathing room.
 * Removed: #N rank badges, aggressive black "Mídia kit" pill.
 * Added: pipe-separated metrics, subtle text-link CTA, soft hierarchy.
 */
function SuggestedCollabsCard({ items }: { items: DiagnosticoCollabSuggestion[] }) {
  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg={HC.hypothesis.bg}
          iconSlot={<CollabIcon />}
          category="Collabs indicadas"
          catColor={HC.hypothesis.text}
        />
        <p className="text-[20px] font-bold leading-tight tracking-tight text-zinc-950">
          Criadores com fit narrativo
        </p>
        <p className="mt-1 text-[13px] text-zinc-500">
          Baseado nas suas leituras + Instagram
        </p>

        <div className="mt-5 flex flex-col">
          {items.map((creator, i) => (
            <CollabCreatorRow key={creator.id} creator={creator} isFirst={i === 0} />
          ))}
        </div>
      </div>
    </DiagnosticoCardShell>
  );
}

function CollabCreatorRow({
  creator,
  isFirst,
}: {
  creator: DiagnosticoCollabSuggestion;
  isFirst: boolean;
}) {
  const handle = creator.username
    ? creator.username.startsWith("@")
      ? creator.username
      : `@${creator.username}`
    : null;
  const matchLabel = getMatchLabel(creator);
  const avatarUrl = getStableCreatorAvatarUrl(creator);
  const hasMediaKit = Boolean(creator.mediaKitSlug);
  // Fase C: narrative match path hides audience metrics
  const isNarrativeMatch = Boolean(creator.narrativeMatch);

  return (
    <div
      className={`flex flex-col gap-3 py-5 ${isFirst ? "pt-0" : "border-t border-zinc-100/80"}`}
    >
      {/* Top row: avatar + identity */}
      <div className="flex items-center gap-3.5">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-indigo-50">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={creator.name} fill sizes="56px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[15px] font-semibold text-indigo-500">
              {getInitials(creator.name)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold leading-tight text-zinc-950">
            {creator.name}
          </p>
          {handle && (
            <p className="mt-0.5 truncate text-[13px] text-zinc-400">{handle}</p>
          )}
        </div>
      </div>

      {/* Fit reason — narrative match uses AI reason; Instagram path uses matchLabel */}
      <p className="text-[14px] leading-relaxed text-zinc-700 line-clamp-2">
        {creator.narrativeFitReason ?? matchLabel}
      </p>

      {/* Narrative example — only for narrative match path (Fase C) */}
      {isNarrativeMatch && creator.narrativeExample && (
        <p className="text-[12.5px] leading-snug text-zinc-500 line-clamp-2 italic">
          {creator.narrativeExample}
        </p>
      )}

      {/* Bottom row — narrative match: média kit link only; Instagram: metrics + link */}
      {isNarrativeMatch ? (
        hasMediaKit && (
          <div className="pt-1">
            <a
              href={`/mediakit/${creator.mediaKitSlug}`}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] font-semibold text-indigo-600 no-underline active:opacity-70"
              aria-label={`Abrir mídia kit de ${creator.name}`}
            >
              Ver Mídia Kit →
            </a>
          </div>
        )
      ) : (
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[12px] text-zinc-500">
            <span className="font-semibold text-zinc-700">{formatCompactMetric(creator.avgReach)}</span> alcance
            <span className="mx-1.5 text-zinc-300">·</span>
            <span className="font-semibold text-zinc-700">{formatCompactMetric(creator.avgInteractions)}</span> interações
          </p>
          {hasMediaKit && (
            <a
              href={`/mediakit/${creator.mediaKitSlug}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-[13px] font-semibold text-indigo-600 no-underline active:opacity-70"
              aria-label={`Abrir mídia kit de ${creator.name}`}
            >
              Ver Mídia Kit →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Collab formats card ─────────────────────────────────────────────── */

function CollabFormatsCard({ synthesis: s }: { synthesis: CreatorStrategicProfileSynthesis }) {
  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg={HC.hypothesis.bg}
          iconSlot={<CollabIcon />}
          category="Formatos de collab"
          catColor={HC.hypothesis.text}
        />
        <p className="text-[20px] font-bold leading-tight tracking-tight text-zinc-950">
          {s.collabTerritories.length === 1 ? "1 formato sugerido" : `${s.collabTerritories.length} formatos sugeridos`}
        </p>
        <p className="mt-1 text-[13px] text-zinc-500">
          Derivados da leitura comercial dos seus vídeos
        </p>

        <ul className="mt-5 flex flex-col gap-4">
          {s.collabTerritories.map((t) => (
            <li key={t.label} className="flex items-start gap-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-snug text-zinc-900">{t.label}</p>
                {t.summary !== t.label && (
                  <p className="mt-1 text-[13px] leading-snug text-zinc-500">{t.summary}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </DiagnosticoCardShell>
  );
}

/* ── Community directory ─────────────────────────────────────────────── */

function CreatorDirectorySection({ directory }: { directory: DiagnosticoCreatorDirectoryState }) {
  if (directory.status === "loading" || directory.status === "idle") {
    return (
      <section className="flex flex-col gap-3 mt-2">
        <DirectoryHeader />
        <DiagnosticoCardShell>
          <div className={CARD_P}>
            <div className="flex animate-pulse flex-col gap-3">
              <div className="h-3 w-32 rounded-full bg-zinc-100" />
              <div className="flex gap-3 overflow-hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <div className="h-16 w-16 rounded-2xl bg-zinc-100" />
                    <div className="h-2 w-12 rounded-full bg-zinc-100" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DiagnosticoCardShell>
      </section>
    );
  }

  if (directory.status === "error" || directory.creators.length === 0) {
    return (
      <section className="flex flex-col gap-3 mt-2">
        <DirectoryHeader />
        <DiagnosticoDetailEmptyState
          iconBg="bg-zinc-100"
          iconSlot={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="9" cy="8" r="3" stroke="#a1a1aa" strokeWidth="1.8" />
              <path d="M3 21v-1a6 6 0 0 1 6-6" stroke="#a1a1aa" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          }
          title="Diretório indisponível"
          description={directory.error || "Não foi possível carregar os criadores agora."}
        />
      </section>
    );
  }

  const groups = groupCreatorsByNiche(directory.creators);

  return (
    <section className="flex flex-col gap-5 mt-2">
      <DirectoryHeader subtitle={`${directory.creators.length} criadores em diversos nichos`} />
      {groups.map(([niche, creators]) => (
        <DirectoryGroup key={niche} niche={niche} creators={creators} />
      ))}
    </section>
  );
}

function DirectoryHeader({ subtitle }: { subtitle?: string }) {
  return (
    <div className="px-1">
      <p className="text-[12px] font-medium text-zinc-400">Comunidade</p>
      <h2 className="mt-0.5 text-[22px] font-bold tracking-tight text-zinc-950">
        Criadores D2C
      </h2>
      {subtitle && (
        <p className="mt-1 text-[13px] text-zinc-500">{subtitle}</p>
      )}
    </div>
  );
}

function DirectoryGroup({
  niche,
  creators,
}: {
  niche: string;
  creators: LandingCreatorHighlight[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between px-1">
        <h3 className="text-[16px] font-semibold text-zinc-900">{niche}</h3>
        <span className="text-[12px] text-zinc-500">
          {creators.length} {creators.length === 1 ? "criador" : "criadores"}
        </span>
      </div>
      <div className="-mx-5 overflow-x-auto overscroll-x-contain">
        <div className="flex gap-3 px-5 pb-1">
          {creators.map((creator) => (
            <DirectoryCreatorCard key={creator.id} creator={creator} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DirectoryCreatorCard({ creator }: { creator: LandingCreatorHighlight }) {
  const handle = creator.username
    ? creator.username.startsWith("@")
      ? creator.username
      : `@${creator.username}`
    : creator.name;
  const followers = formatCompactMetric(creator.followers);
  const avatarUrl = getStableLandingCreatorAvatarUrl(creator);

  const Wrapper = creator.mediaKitSlug ? "a" : "div";
  const wrapperProps = creator.mediaKitSlug
    ? {
        href: `/mediakit/${creator.mediaKitSlug}`,
        target: "_blank" as const,
        rel: "noreferrer",
        "aria-label": `Abrir mídia kit de ${creator.name}`,
      }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="flex w-[112px] shrink-0 flex-col items-center gap-2 no-underline active:opacity-80"
    >
      <div className="relative h-[80px] w-[80px] shrink-0 overflow-hidden rounded-3xl bg-indigo-50 shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
        {avatarUrl ? (
          <Image src={avatarUrl} alt={creator.name} fill sizes="80px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[18px] font-semibold text-indigo-500">
            {getInitials(creator.name)}
          </div>
        )}
      </div>
      <div className="flex w-full flex-col items-center text-center">
        <p className="w-full truncate text-[12px] font-semibold text-zinc-900">{handle}</p>
        {followers !== "—" && (
          <p className="mt-0.5 text-[11px] text-zinc-500">{followers} seguidores</p>
        )}
      </div>
    </Wrapper>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function getMatchLabel(creator: DiagnosticoCollabSuggestion) {
  if (creator.matchedTheme) return "Tema parecido com o território narrativo desta leitura.";
  switch (creator.matchType) {
    case "HIGH_REACH":
      return "Bom alcance médio para amplificar uma pauta em conjunto.";
    case "AUDIENCE_SCALE":
      return "Audiência maior para uma collab com ganho de distribuição.";
    case "CONSISTENT":
      return "Performance consistente em recortes parecidos.";
    case "HIGH_ENGAGEMENT":
      return "Boa resposta média da audiência em posts recentes.";
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

function getStableCreatorAvatarUrl(creator: Pick<DiagnosticoCollabSuggestion, "avatarUrl" | "mediaKitSlug">) {
  if (creator.mediaKitSlug) {
    return `/api/mediakit/${encodeURIComponent(creator.mediaKitSlug)}/avatar?v=20260430-avatar-v3`;
  }
  return creator.avatarUrl || null;
}

function getStableLandingCreatorAvatarUrl(creator: LandingCreatorHighlight) {
  if (creator.mediaKitSlug) {
    return `/api/mediakit/${encodeURIComponent(creator.mediaKitSlug)}/avatar?v=20260430-avatar-v3`;
  }
  return creator.avatarUrl || null;
}

/** Groups creators by their primary niche; falls back to "Outros". */
function groupCreatorsByNiche(creators: LandingCreatorHighlight[]): [string, LandingCreatorHighlight[]][] {
  const buckets = new Map<string, LandingCreatorHighlight[]>();
  for (const c of creators) {
    const niche = (c.niches && c.niches[0]) || "Outros";
    const list = buckets.get(niche) ?? [];
    list.push(c);
    buckets.set(niche, list);
  }
  // Sort: larger groups first, "Outros" always last
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
