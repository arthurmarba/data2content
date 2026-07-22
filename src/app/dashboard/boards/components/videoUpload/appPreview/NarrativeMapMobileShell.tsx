"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { CreatorNarrativeMapReadingChapter, CreatorNarrativeMapReadingPresentation } from "../../../videoUpload/creatorNarrativeMapReadingChapters";
import type { NarrativeMapMobileOpportunityItem, NarrativeMapMobileReadingItem, NarrativeMapMobileViewModel } from "../../../videoUpload/narrativeMapMobileViewModel";
import type { VideoNarrativeSynthesisSnapshotWriteSummary } from "../../../videoUpload/videoNarrativeSafeResponseBuilder";
import { NarrativeMapReadingChapterModal } from "./NarrativeMapReadingChapterModal";
import { NarrativeMapReadingFullDiagnosisModal } from "./NarrativeMapReadingFullDiagnosisModal";
import { NarrativeMapSnapshotReviewPanel } from "./NarrativeMapSnapshotReviewPanel";
import { DiagnosticoAccountMenuSheet } from "./DiagnosticoAccountMenuSheet";
import {
  getNarrativeMapStatusCardContent,
  type NarrativeMapAccessState,
  type NarrativeMapReadingQuotaSnapshot,
} from "../../../videoUpload/narrativeMapAccessState";
import {
  MOBILE_COMMUNITY_ROUTE,
} from "../../../videoUpload/mobileStrategicProfileRoutes";
import { color, font, shadow } from "@/design-system";
import { d2cFontVariables } from "@/app/fonts/d2cFonts";

// ─── Design tokens ─────────────────────────────────────────────────────────

const GRADIENT_BG = `linear-gradient(180deg, ${color.paper} 0%, ${color.neutral} 100%)`;
const SOLID_BG = color.paper;

const CATEGORY_MAP = {
  diagnostico: { label: "Diagnóstico",          color: color.ink,     bg: color.neutral },
  foco:        { label: "Foco Estratégico",     color: color.success, bg: color.successSoft },
  narrativa:   { label: "Sua Narrativa",        color: color.brand,   bg: color.brandSoft },
  execucao:    { label: "Como Você Executa",    color: color.ink,     bg: color.neutral },
  instagram:   { label: "Instagram",            color: color.map,     bg: color.warningSoft },
  marcas:      { label: "Marcas Recomendadas",  color: color.ink,     bg: color.neutral },
  collabs:     { label: "Collabs Indicadas",    color: color.brand,   bg: color.brandSoft },
  analises:    { label: "Suas Análises",        color: color.ink,     bg: color.neutral },
} as const;

type CategoryKey = keyof typeof CATEGORY_MAP;

const TONE_TO_CATEGORY: Record<string, CategoryKey> = {
  mirror:      "narrativa",
  attention:   "diagnostico",
  action:      "foco",
  opportunity: "marcas",
  neutral:     "analises",
};

const EVOLUTION_HERO_TITLE: Record<string, string> = {
  first_reading:        "1ª análise registrada",
  signals_emerging:     "Sinais surgindo",
  pattern_in_formation: "Padrões detectados",
  profile_consistent:   "Perfil consistente",
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

// ─── SVG / visual primitives ──────────────────────────────────────────────

function Ring({
  size, pct, color, track, strokeW,
}: { size: number; pct: number; color: string; track: string; strokeW: number }) {
  const R = (size - strokeW - 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * R;
  const dash = C * Math.min(1, Math.max(0, pct));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={cx} cy={cy} r={R} stroke={track} strokeWidth={strokeW} fill="none" />
      <circle
        cx={cx} cy={cy} r={R} fill="none"
        stroke={color} strokeWidth={strokeW}
        strokeDasharray={`${dash} ${C}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </svg>
  );
}

function SparkBars({
  values, color, faint, height = 40,
}: { values: number[]; color: string; faint: string; height?: number }) {
  const max = Math.max(1, ...values);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3 }}>
      {values.map((v, i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: Math.max(4, (v / max) * height),
            borderRadius: 2,
            background: i === values.length - 1 ? color : faint,
            display: "block",
          }}
        />
      ))}
    </div>
  );
}

function GlyphClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function GlyphCheck({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 7.5l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GlyphPlay({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <path d="M4 2.5v9l7-4.5z" />
    </svg>
  );
}

function GlyphChevronRight() {
  return (
    <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ color: "var(--ds-color-line-strong)" }}>
      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GlyphProfile({ active }: { active: boolean }) {
  const c = active ? "var(--ds-color-ink)" : "var(--ds-color-text-secondary)";
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="11" cy="7.5" r="3.5" stroke={c} strokeWidth="1.6" fill={active ? c : "none"} />
      <path d="M3.5 19c1.6-3.4 4.4-5 7.5-5s5.9 1.6 7.5 5" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function GlyphCommunity({ active }: { active: boolean }) {
  const c = active ? "var(--ds-color-ink)" : "var(--ds-color-text-secondary)";
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="7" cy="8" r="2.8" stroke={c} strokeWidth="1.6" fill={active ? c : "none"} />
      <circle cx="15" cy="8" r="2.8" stroke={c} strokeWidth="1.6" fill={active ? c : "none"} />
      <path d="M2 18c0.8-2.4 2.7-3.6 5-3.6s4.2 1.2 5 3.6" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10 18c0.8-2.4 2.7-3.6 5-3.6s4.2 1.2 5 3.6" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// Apple Health-style white card shell
function HealthCard({
  children,
  onClick,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  const baseStyle: React.CSSProperties = {
    width: "100%",
    textAlign: "left",
    fontFamily: font.sans,
    padding: "20px 22px 22px",
    borderRadius: 22,
    background: color.surface,
    border: `1px solid ${color.line}`,
    boxShadow: shadow.raised,
    display: "flex",
    flexDirection: "column",
    minHeight: 136,
    ...style,
  };

  if (onClick) {
    return (
      <button type="button" onClick={onClick} style={{ ...baseStyle, cursor: "pointer" }}>
        {children}
      </button>
    );
  }
  return <div style={baseStyle}>{children}</div>;
}

// Category label: colored dot + text
function CategoryLabel({ category, label }: { category: string; label?: string }) {
  const cat = CATEGORY_MAP[category as CategoryKey] ?? CATEGORY_MAP.diagnostico;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span style={{ width: 10, height: 10, borderRadius: 9999, background: cat.color, flexShrink: 0 }} />
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: cat.color,
          letterSpacing: -0.15,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label ?? cat.label}
      </span>
    </span>
  );
}

// Apple Health card header row
function CardHeader({ category, time, label }: { category: string; time?: string; label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <CategoryLabel category={category} label={label} />
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {time ? (
          <span style={{ fontSize: 13, color: "var(--ds-color-text-muted)", fontWeight: 400, letterSpacing: -0.1 }}>
            {time}
          </span>
        ) : null}
        <GlyphChevronRight />
      </span>
    </div>
  );
}

// Section heading
function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div
      style={{
        padding: "32px 22px 10px",
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--ds-color-ink)", margin: 0, letterSpacing: -0.55 }}>
        {title}
      </h2>
      {action && onAction ? (
        <button
          type="button"
          onClick={onAction}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            color: "var(--ds-color-brand)",
            fontSize: 17,
            fontWeight: 400,
            cursor: "pointer",
            fontFamily: "inherit",
            letterSpacing: -0.3,
          }}
        >
          {action}
        </button>
      ) : null}
    </div>
  );
}

// ─── Opportunity detail sheet ────────────────────────────────────────────────

const OPPORTUNITY_CTA: Record<string, { label: string; href: string }> = {
  brand_territory: { label: "Ver propostas de marca", href: "/dashboard/proposals" },
  collab_type: { label: "Abrir Planner", href: "/planning/planner" },
  media_kit_bridge: { label: "Abrir Mídia Kit", href: "/dashboard/media-kit" },
  instagram_precision: { label: "Ver configurações", href: "/dashboard/settings" },
};

function OpportunityDetailSheet({
  item,
  onClose,
}: {
  item: NarrativeMapMobileOpportunityItem | null;
  onClose: () => void;
}) {
  if (!item) return null;
  const cta = OPPORTUNITY_CTA[item.type] ?? { label: "Ver mais", href: "/" };
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center ds-scrim"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="opportunity-sheet-title"
        className="ds-sheet ds-enter-sheet px-5 pb-7 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex justify-center">
          <div className="ds-sheet__handle !m-0" />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {item.badgeLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-500">
                {item.badgeLabel}
              </span>
            ) : null}
            <h3 id="opportunity-sheet-title" className="mt-2 font-display text-[1.5rem] font-bold leading-[1.05] tracking-[-0.035em] text-zinc-950">
              {item.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"
            aria-label="Fechar"
          >
            <GlyphClose />
          </button>
        </div>
        <div className="mt-4 rounded-[14px] bg-zinc-50 p-4">
          <p className="text-sm leading-[1.6] text-zinc-700">{item.preview}</p>
        </div>
        <div className="mt-4 rounded-[14px] bg-zinc-950 p-4 text-white">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-white/50">Como inserir</p>
          <p className="mt-1.5 text-sm leading-[1.6]">
            {item.insertionAngle ??
              (item.type === "brand_territory"
                ? "Abra uma proposta de campanha e use este território como referência para briefings com marcas alinhadas ao seu Perfil."
                : item.type === "collab_type"
                ? "Acesse o Planner e use este formato como ponto de partida para seu próximo calendário de conteúdo."
                : "Explore esta oportunidade no painel de crescimento da Data2Content.")}
          </p>
        </div>
        {item.suggestedDeliverables && item.suggestedDeliverables.length > 0 ? (
          <div className="mt-3 rounded-[14px] border border-zinc-100 bg-zinc-50 p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-zinc-400">Formatos sugeridos</p>
            <ul className="mt-2 grid gap-1.5">
              {item.suggestedDeliverables.slice(0, 4).map((deliverable) => (
                <li key={deliverable} className="text-[12.5px] leading-[1.5] text-zinc-700">• {deliverable}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <a
          href={cta.href}
          className="mt-4 flex w-full items-center justify-center rounded-full bg-zinc-950 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_-4px_rgba(9,9,11,0.4)]"
          onClick={onClose}
        >
          {cta.label}
        </a>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-full border border-zinc-200 py-3 text-sm font-semibold text-zinc-700"
        >
          Fechar
        </button>
      </section>
    </div>
  );
}

// ─── Reading detail sheet ────────────────────────────────────────────────────

function ReadingDetailModal({
  reading,
  onClose,
}: {
  reading: NarrativeMapMobileReadingItem | null;
  onClose: () => void;
}) {
  if (!reading) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center ds-scrim"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="reading-detail-title"
        className="ds-sheet ds-enter-sheet px-5 pb-7 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex justify-center">
          <div className="ds-sheet__handle !m-0" />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-zinc-400">
              {reading.dateLabel}
            </p>
            <h3 id="reading-detail-title" className="mt-1 font-display text-[1.5rem] font-bold leading-[1.05] tracking-[-0.035em] text-zinc-950">
              {reading.rememberedAs}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"
          >
            <GlyphClose />
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          <div className="rounded-[14px] bg-zinc-50 p-3">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-zinc-400">Contribuição</p>
            <p className="mt-1 text-sm font-semibold text-zinc-950">{reading.contributionLabel}</p>
          </div>
          <div className="rounded-[14px] bg-zinc-50 p-3">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-zinc-400">Como pesa no Perfil</p>
            <p className="mt-1 text-sm leading-[1.6] text-zinc-600">{reading.profileImpactPreview}</p>
          </div>
        </div>
        <div className="mt-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border border-zinc-200 py-3 text-sm font-semibold text-zinc-700"
          >
            Fechar
          </button>
        </div>
      </section>
    </div>
  );
}

// ─── Ghost skeleton row ───────────────────────────────────────────────────────

function GhostLine({ width }: { width: string }) {
  return (
    <div
      style={{
        height: 9,
        borderRadius: 4,
        background: "var(--ds-color-neutral)",
        width,
      }}
    />
  );
}

// ─── Main shell ───────────────────────────────────────────────────────────────

export function NarrativeMapMobileShell({
  viewModel,
  presentation,
  statusText,
  stateNav,
  snapshotReview,
  internalReview,
  accessState,
  readingQuota,
  onPrimaryAccessAction,
  onSecondaryAccessAction,
  onOpenMediaKit,
  profileUpdateNotice,
  profileSynthesisStatus,
  newestReadingThumbnail,
  localThumbnailsByDiagnosisId,
  profileImageUrl,
  userInfo,
  onSignOut,
  frameMode = "preview",
  initialAccountMenuView = "menu",
}: {
  viewModel: NarrativeMapMobileViewModel;
  presentation: CreatorNarrativeMapReadingPresentation;
  statusText?: string | null;
  stateNav?: ReactNode;
  snapshotReview?: VideoNarrativeSynthesisSnapshotWriteSummary | null;
  internalReview?: boolean;
  accessState?: NarrativeMapAccessState;
  readingQuota?: Partial<NarrativeMapReadingQuotaSnapshot> | null;
  onPrimaryAccessAction?: () => void;
  onSecondaryAccessAction?: () => void;
  onOpenMediaKit?: () => void;
  profileUpdateNotice?: boolean;
  profileSynthesisStatus?: string | null;
  newestReadingThumbnail?: string | null;
  localThumbnailsByDiagnosisId?: Record<string, string>;
  profileImageUrl?: string | null;
  userInfo?: { name: string | null; email: string | null; plan: string } | null;
  onSignOut?: () => void;
  frameMode?: "app" | "preview";
  initialAccountMenuView?: "menu" | "affiliates";
}) {
  const [activeChapter, setActiveChapter] = useState<CreatorNarrativeMapReadingChapter | null>(null);
  const [activeReading, setActiveReading] = useState<NarrativeMapMobileReadingItem | null>(null);
  const [activeOpportunity, setActiveOpportunity] = useState<NarrativeMapMobileOpportunityItem | null>(null);
  const [fullDiagnosisOpen, setFullDiagnosisOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(initialAccountMenuView === "affiliates");
  const [shareToast, setShareToast] = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [visibleReadings, setVisibleReadings] = useState(3);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const pullStartY = useRef(0);
  const router = useRouter();

  const visibleProfileImageUrl =
    profileImageUrl && !avatarLoadFailed ? profileImageUrl : null;

  const profileChapters = useMemo(() => viewModel.profile.chapters, [viewModel.profile.chapters]);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [profileImageUrl]);

  // Share: Web Share API with clipboard fallback
  const handleShare = useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Meu Perfil Narrativo | Data2Content", url });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareToast(true);
      }
    } catch {
      // cancelled or unsupported
    }
  }, []);

  useEffect(() => {
    if (!shareToast) return;
    const t = setTimeout(() => setShareToast(false), 3000);
    return () => clearTimeout(t);
  }, [shareToast]);

  // Pull-to-refresh
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const el = scrollAreaRef.current;
    if (el && el.scrollTop === 0) {
      pullStartY.current = e.touches[0]?.clientY ?? 0;
    } else {
      pullStartY.current = 0;
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!pullStartY.current) return;
      const deltaY = (e.changedTouches[0]?.clientY ?? 0) - pullStartY.current;
      if (deltaY > 64) {
        setIsPullRefreshing(true);
        router.refresh();
        setTimeout(() => setIsPullRefreshing(false), 1500);
      }
      pullStartY.current = 0;
    },
    [router],
  );

  // Derived: readings count
  const readingsCount = viewModel.profileHeader.metrics.find((m) => m.label === "Leituras")?.value ?? "0";
  const numericReadingsCount = Number.parseInt(String(readingsCount), 10);
  const hasReadings = Number.isFinite(numericReadingsCount) && numericReadingsCount > 0;

  // Derived: quota
  const adminUsedThisMonth =
    typeof readingQuota?.usedThisMonth === "number" && Number.isFinite(readingQuota.usedThisMonth)
      ? readingQuota.usedThisMonth
      : 0;
  const adminLimit =
    typeof readingQuota?.proMonthlyLimit === "number" && Number.isFinite(readingQuota.proMonthlyLimit)
      ? readingQuota.proMonthlyLimit
      : 10;

  // Derived: status card
  const rawStatusCard = accessState
    ? getNarrativeMapStatusCardContent({ state: accessState, quota: readingQuota })
    : null;
  const statusCard =
    rawStatusCard && accessState === "admin"
      ? {
          ...rawStatusCard,
          title: "Leituras do Perfil",
          description: `${adminUsedThisMonth}/${adminLimit} leituras disponíveis para testar o Perfil.`,
        }
      : rawStatusCard;

  const isUrgentState =
    accessState === "free_preview_used" ||
    accessState === "payment_pending" ||
    accessState === "payment_action_needed" ||
    accessState === "pro_quota_reached";

  const showStatusCard = statusCard && (isUrgentState || accessState === "pro_needs_instagram" || accessState === "admin");

  const isPro = accessState != null && !["free_unused", "free_preview_used"].includes(accessState);
  const isInstagramConnected =
    accessState === "pro_instagram_connected" ||
    accessState === "pro_quota_reached" ||
    accessState === "admin";

  // Derived: profile fields
  const initials = getInitials(viewModel.profileHeader.displayName);
  const firstName = viewModel.profileHeader.displayName.trim().split(/\s+/)[0] ?? viewModel.profileHeader.displayName;

  // Derived: opportunities
  const brandOpportunities = viewModel.opportunities.items.filter((i) => i.type === "brand_territory");
  const collabOpportunities = viewModel.opportunities.items.filter((i) => i.type === "collab_type");
  const precisionItems = viewModel.opportunities.items.filter((i) => i.type === "instagram_precision");

  const appFrame = frameMode === "app";

  const handlePrimaryStatusAction = () => {
    if (accessState === "pro_quota_reached") {
      // scroll to readings section — no tab to switch; just trigger action
    }
    onPrimaryAccessAction?.();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className={
        appFrame
          ? `d2c-mobile-app ${d2cFontVariables} relative h-dvh w-full overflow-hidden`
          : `d2c-mobile-app ${d2cFontVariables} relative mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] border border-zinc-200 bg-zinc-950 p-2 shadow-xl`
      }
      style={{
        fontFamily: font.sans,
        WebkitFontSmoothing: "antialiased",
        background: appFrame ? SOLID_BG : undefined,
      } as React.CSSProperties}
    >
      <div
        className={
          appFrame
            ? "relative h-full"
            : "relative min-h-[760px] overflow-hidden rounded-[1.5rem]"
        }
        style={{ background: SOLID_BG }}
      >
        {/* Pull-to-refresh indicator */}
        {isPullRefreshing ? (
          <div
            className="absolute left-0 right-0 z-50 flex items-center justify-center py-2"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
            aria-live="polite"
            aria-label="Atualizando..."
          >
            <svg className="h-5 w-5 animate-spin text-zinc-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : null}

        {/* ── Scroll container ─────────────────────────────────────────── */}
        <div
          ref={scrollAreaRef}
          onTouchStart={appFrame ? handleTouchStart : undefined}
          onTouchEnd={appFrame ? handleTouchEnd : undefined}
          className={
            appFrame
              ? "absolute bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] left-0 right-0 top-0 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none]"
              : "overflow-y-auto"
          }
        >
          {/* ── GRADIENT HEADER BAND ─────────────────────────────────── */}
          <div
            style={{
              background: GRADIENT_BG,
              position: "relative",
              paddingTop: appFrame ? "calc(env(safe-area-inset-top, 0px) + 3.5rem)" : "3.5rem",
            }}
          >
            {/* Gradient → solid fade at bottom */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 80,
                background: `linear-gradient(180deg, rgba(242,242,247,0) 0%, ${SOLID_BG} 100%)`,
                pointerEvents: "none",
              }}
            />

            {/* Top action bar: + button + avatar circle */}
            <div
              style={{
                padding: "8px 18px 0",
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={onPrimaryAccessAction}
                aria-label="Enviar vídeo"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 9999,
                  flexShrink: 0,
                  background: "rgba(255,255,255,0.9)",
                  color: "var(--ds-color-text)",
                  border: "1px solid rgba(255,255,255,0.6)",
                  backdropFilter: "blur(10px) saturate(180%)",
                  WebkitBackdropFilter: "blur(10px) saturate(180%)",
                  boxShadow: "0 1px 2px rgba(9,9,11,0.06), 0 6px 18px -8px rgba(9,9,11,0.18)",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "inherit",
                }}
              >
                <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M9 3.5v11M3.5 9h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setAccountMenuOpen(true)}
                aria-label="Conta e configurações"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 9999,
                  flexShrink: 0,
                  background: "var(--ds-color-ink)",
                  color: "var(--ds-color-on-brand)",
                  border: "2px solid rgba(255,255,255,0.7)",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: -0.2,
                  boxShadow: "0 6px 18px -6px rgba(9,9,11,0.4)",
                  overflow: "hidden",
                }}
              >
                {visibleProfileImageUrl ? (
                  <img
                    src={visibleProfileImageUrl}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 9999 }}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarLoadFailed(true)}
                  />
                ) : (
                  initials
                )}
              </button>
            </div>

            {/* Title row */}
            <div style={{ padding: "16px 22px 12px" }}>
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "var(--ds-color-ink)",
                  margin: 0,
                  letterSpacing: -0.4,
                  lineHeight: 1.15,
                }}
              >
                Resumo
              </h1>
              <p
                style={{
                  fontSize: 16,
                  color: "var(--ds-color-text-secondary)",
                  margin: "5px 0 0",
                  fontWeight: 400,
                  letterSpacing: -0.2,
                  lineHeight: 1.3,
                }}
              >
                Olá, {firstName}
              </p>
            </div>

            {/* Identity strip (glassmorphic) */}
            <div
              style={{
                margin: "0 18px",
                padding: "12px 14px",
                background: "rgba(255,255,255,0.55)",
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                border: "1px solid rgba(255,255,255,0.75)",
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 9999,
                  flexShrink: 0,
                  background: "var(--ds-color-ink)",
                  color: "var(--ds-color-on-brand)",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 600,
                  fontSize: 14,
                  letterSpacing: -0.3,
                  boxShadow: "0 2px 6px rgba(28,28,30,0.18)",
                  overflow: "hidden",
                }}
                aria-hidden="true"
              >
                {visibleProfileImageUrl ? (
                  <img
                    src={visibleProfileImageUrl}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  initials
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--ds-color-ink)",
                    margin: 0,
                    letterSpacing: -0.25,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {viewModel.profileHeader.displayName}
                </p>
                <p
                  style={{
                    fontSize: 12.5,
                    color: "var(--ds-color-text-secondary)",
                    margin: "1px 0 0",
                    letterSpacing: -0.1,
                    fontWeight: 400,
                  }}
                >
                  {viewModel.profileHeader.displayHandle}
                  {hasReadings ? (
                    <>
                      <span style={{ margin: "0 5px", color: "var(--ds-color-text-muted)" }}>·</span>
                      <span style={{ fontWeight: 500 }}>
                        {readingsCount} análise{numericReadingsCount !== 1 ? "s" : ""}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
              <span
                style={{
                  padding: "4px 11px",
                  borderRadius: 9999,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  textTransform: "uppercase",
                  flexShrink: 0,
                  background: isPro ? "rgba(52,199,89,0.18)" : "rgba(255,149,0,0.16)",
                  color: isPro ? "#1d8a3e" : "#b56700",
                }}
              >
                {isPro ? "Pro" : "Free"}
              </span>
            </div>

            {/* Gradient breathing room */}
            <div style={{ height: 40 }} />
          </div>

          {/* ── CONTENT BELOW GRADIENT ─────────────────────────────────── */}
          <div style={{ marginTop: -20, position: "relative" }}>

            {/* Upload CTA (free + no readings) */}
            {!hasReadings ? (
              <section style={{ padding: "12px 18px 0" }}>
                <div
                  style={{
                    padding: 16,
                    borderRadius: 20,
                    background: "var(--ds-color-ink)",
                    color: "var(--ds-color-on-brand)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.5)",
                      margin: 0,
                    }}
                  >
                    1 análise grátis
                  </p>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "var(--ds-color-on-brand)",
                      margin: "6px 0 0",
                      letterSpacing: -0.4,
                    }}
                  >
                    Envie seu primeiro vídeo
                  </h3>
                  <p
                    style={{
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: "rgba(255,255,255,0.65)",
                      margin: "6px 0 14px",
                    }}
                  >
                    A IA lê o vídeo e preenche os cards do seu Perfil.
                  </p>
                  <button
                    type="button"
                    onClick={onPrimaryAccessAction}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 18px",
                      borderRadius: 11,
                      background: "var(--ds-color-surface)",
                      color: "var(--ds-color-ink)",
                      border: "none",
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      letterSpacing: -0.2,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M8 11V3M5 5l3-3 3 3M3 11v2h10v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Enviar vídeo
                  </button>
                </div>
              </section>
            ) : null}

            {/* Status card (urgent / admin) */}
            {showStatusCard && statusCard ? (
              <section style={{ padding: "12px 18px 0" }} aria-label="Status do Perfil">
                <div
                  style={{
                    padding: 14,
                    borderRadius: 18,
                    background:
                      accessState === "payment_pending" || accessState === "pro_quota_reached"
                        ? "#fffbeb"
                        : "var(--ds-color-surface)",
                    border: `1px solid ${
                      accessState === "payment_pending" || accessState === "pro_quota_reached"
                        ? "#fef3c7"
                        : "var(--ds-color-neutral)"
                    }`,
                    boxShadow: "0 2px 8px rgba(9,9,11,0.05)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: "var(--ds-color-ink)",
                      margin: 0,
                      letterSpacing: -0.2,
                    }}
                  >
                    {statusCard.title}
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: "var(--ds-color-text-secondary)",
                      margin: "4px 0 0",
                    }}
                  >
                    {statusCard.description}
                  </p>
                  <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button
                      type="button"
                      onClick={handlePrimaryStatusAction}
                      style={{
                        height: 34,
                        padding: "0 16px",
                        borderRadius: 9999,
                        background: "var(--ds-color-ink)",
                        color: "var(--ds-color-on-brand)",
                        border: "none",
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {statusCard.primaryLabel}
                    </button>
                    {statusCard.secondaryLabel ? (
                      <button
                        type="button"
                        onClick={onSecondaryAccessAction}
                        style={{
                          height: 34,
                          padding: "0 16px",
                          borderRadius: 9999,
                          background: "var(--ds-color-surface)",
                          color: "var(--ds-color-ink)",
                          border: "1px solid var(--ds-color-line)",
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {statusCard.secondaryLabel}
                      </button>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            {/* Instagram connect inline card (pro + no IG) */}
            {isPro && !isInstagramConnected && !showStatusCard ? (
              <section style={{ padding: "12px 18px 0" }}>
                <button
                  type="button"
                  onClick={onPrimaryAccessAction}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    padding: 14,
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.78)",
                    border: "1px solid rgba(255,255,255,0.85)",
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    boxShadow: "0 1px 2px rgba(9,9,11,0.04)",
                  }}
                >
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      flexShrink: 0,
                      background: "linear-gradient(135deg, #fbbf24 0%, #ec4899 50%, #8b5cf6 100%)",
                      color: "var(--ds-color-on-brand)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                      <rect x="3" y="3" width="12" height="12" rx="3.5" stroke="currentColor" strokeWidth="1.6" />
                      <circle cx="9" cy="9" r="2.8" stroke="currentColor" strokeWidth="1.6" />
                      <circle cx="12.5" cy="5.5" r="0.8" fill="currentColor" />
                    </svg>
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: "var(--ds-color-text)",
                        margin: 0,
                        letterSpacing: -0.1,
                      }}
                    >
                      Conecte o Instagram
                    </p>
                    <p
                      style={{
                        fontSize: 11.5,
                        color: "var(--ds-color-text-secondary)",
                        margin: "2px 0 0",
                        lineHeight: 1.4,
                      }}
                    >
                      Refina a leitura com sinais reais da sua grade.
                    </p>
                  </div>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 14 14"
                    fill="none"
                    aria-hidden="true"
                    style={{ color: "var(--ds-color-text-muted)" }}
                  >
                    <path
                      d="M5 3l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </section>
            ) : null}

            {/* Profile updated notice */}
            {profileUpdateNotice ? (
              <div style={{ padding: "12px 18px 0" }}>
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: "rgba(220,252,231,0.75)",
                    border: "1px solid rgba(167,243,208,0.5)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 9999,
                      flexShrink: 0,
                      background: "#059669",
                      color: "var(--ds-color-on-brand)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <GlyphCheck size={11} />
                  </span>
                  <p
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "#065f46",
                      margin: 0,
                      letterSpacing: -0.1,
                    }}
                  >
                    Nova análise no Perfil — cards atualizados.
                  </p>
                </div>
              </div>
            ) : null}

            {/* ─── EM DESTAQUE ─────────────────────────────────────────── */}
            <SectionTitle title="Em destaque" />
            <div style={{ padding: "0 18px" }}>
              <HealthCard onClick={() => hasReadings && setFullDiagnosisOpen(true)}>
                <CardHeader category="diagnostico" time={hasReadings ? "Hoje" : undefined} />
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 14,
                    marginTop: 18,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 21,
                        fontWeight: 700,
                        color: hasReadings ? "var(--ds-color-ink)" : "var(--ds-color-text-muted)",
                        margin: 0,
                        letterSpacing: -0.5,
                        lineHeight: 1.15,
                      }}
                    >
                      {!hasReadings
                        ? "Sem sinais ainda"
                        : (EVOLUTION_HERO_TITLE[profileSynthesisStatus ?? ""] ?? "Sinais em formação")}
                    </p>
                    <p
                      style={{
                        fontSize: 14,
                        color: "var(--ds-color-text-muted)",
                        margin: "6px 0 0",
                        fontWeight: 400,
                        letterSpacing: -0.1,
                        lineHeight: 1.4,
                      }}
                    >
                      {!hasReadings
                        ? "Envie um vídeo para começar"
                        : `${numericReadingsCount} análise${numericReadingsCount !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <div style={{ flexShrink: 0, position: "relative" }}>
                    <Ring
                      size={56}
                      pct={hasReadings ? numericReadingsCount / Math.max(adminLimit, 10) : 0}
                      color="var(--ds-color-map)"
                      track="#ffe7d6"
                      strokeW={4.5}
                    />
                    <span
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 19,
                        fontWeight: 700,
                        color: hasReadings ? "var(--ds-color-map)" : "var(--ds-color-line)",
                        letterSpacing: -0.4,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {numericReadingsCount}
                    </span>
                  </div>
                </div>
              </HealthCard>
            </div>

            {/* ─── O QUE VOCÊ ESTÁ CONSTRUINDO ─────────────────────────── */}
            <SectionTitle title="O que você está construindo" />
            <div style={{ padding: "0 18px", display: "grid", gap: 10 }}>
              {hasReadings ? (
                profileChapters.slice(0, 3).map((chapter) => {
                  const tone = chapter.tone ?? "neutral";
                  const category = TONE_TO_CATEGORY[tone] ?? "analises";
                  return (
                    <HealthCard key={chapter.id} onClick={() => setActiveChapter(chapter)}>
                      <CardHeader category={category} time="Hoje" />
                      <div
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "flex-end",
                          marginTop: 18,
                        }}
                      >
                        <p
                          style={{
                            fontSize: 19,
                            fontWeight: 700,
                            color: "var(--ds-color-ink)",
                            margin: 0,
                            letterSpacing: -0.45,
                            lineHeight: 1.2,
                          }}
                        >
                          {chapter.title}
                        </p>
                        {chapter.preview ? (
                          <p
                            style={{
                              fontSize: 14,
                              color: "var(--ds-color-text-muted)",
                              margin: "6px 0 0",
                              fontWeight: 400,
                              letterSpacing: -0.1,
                              lineHeight: 1.4,
                              display: "-webkit-box",
                              WebkitBoxOrient: "vertical",
                              WebkitLineClamp: 2,
                              overflow: "hidden",
                            } as React.CSSProperties}
                          >
                            {chapter.preview}
                          </p>
                        ) : null}
                      </div>
                    </HealthCard>
                  );
                })
              ) : (
                // Ghost cards
                (
                  [
                    { category: "foco",     title: "Próximos experimentos a testar" },
                    { category: "narrativa", title: "Eixos narrativos do seu Perfil" },
                    { category: "execucao",  title: "Padrões de produção identificados" },
                  ] as { category: CategoryKey; title: string }[]
                ).map((ghost, i) => (
                  <HealthCard key={i} style={{ opacity: 0.7 }}>
                    <CardHeader category={ghost.category} />
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        marginTop: 18,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 19,
                          fontWeight: 700,
                          color: "var(--ds-color-line-strong)",
                          margin: 0,
                          letterSpacing: -0.45,
                          lineHeight: 1.2,
                        }}
                      >
                        {ghost.title}
                      </p>
                      <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                        <GhostLine width="88%" />
                        <GhostLine width="70%" />
                      </div>
                    </div>
                  </HealthCard>
                ))
              )}
            </div>

            {/* ─── SEUS SINAIS ─────────────────────────────────────────── */}
            <SectionTitle title="Seus sinais" />
            <div style={{ padding: "0 18px", display: "grid", gap: 10 }}>
              {/* Instagram card */}
              {isInstagramConnected ? (
                <HealthCard onClick={() => precisionItems[0] ? setActiveOpportunity(precisionItems[0]) : undefined}>
                  <CardHeader category="instagram" time="Hoje" />
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 14,
                      marginTop: 18,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 19,
                          fontWeight: 700,
                          color: "var(--ds-color-ink)",
                          margin: 0,
                          letterSpacing: -0.45,
                        }}
                      >
                        {precisionItems[0]?.title ?? "Grade conectada"}
                      </p>
                      <p
                        style={{
                          fontSize: 14,
                          color: "var(--ds-color-text-muted)",
                          margin: "6px 0 0",
                          fontWeight: 400,
                          letterSpacing: -0.1,
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                          overflow: "hidden",
                        } as React.CSSProperties}
                      >
                        {precisionItems[0]?.preview ?? "Instagram sincronizado com o Perfil"}
                      </p>
                    </div>
                    <SparkBars values={[3, 5, 4, 8, 18]} color="var(--ds-color-brand)" faint="#d6d4f7" />
                  </div>
                </HealthCard>
              ) : (
                <HealthCard onClick={onPrimaryAccessAction}>
                  <CardHeader category="instagram" />
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      marginTop: 18,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 19,
                        fontWeight: 700,
                        color: "var(--ds-color-ink)",
                        margin: 0,
                        letterSpacing: -0.45,
                      }}
                    >
                      Conecte o Instagram
                    </p>
                    <p
                      style={{
                        fontSize: 14,
                        color: "var(--ds-color-text-muted)",
                        margin: "6px 0 0",
                        fontWeight: 400,
                        letterSpacing: -0.1,
                        lineHeight: 1.4,
                      }}
                    >
                      Refina as leituras com sinais reais da sua grade.
                    </p>
                  </div>
                </HealthCard>
              )}

              {/* Análises card */}
              <HealthCard onClick={() => setFullDiagnosisOpen(true)}>
                <CardHeader
                  category="analises"
                  time={viewModel.readings.items[0]?.dateLabel ? `Há ${viewModel.readings.items[0].dateLabel}` : undefined}
                />
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 14,
                    marginTop: 18,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        display: "flex",
                        alignItems: "baseline",
                        gap: 6,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 28,
                          fontWeight: 700,
                          color: "var(--ds-color-ink)",
                          letterSpacing: -0.7,
                          lineHeight: 1.1,
                        }}
                      >
                        {numericReadingsCount}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          color: "var(--ds-color-text-muted)",
                          fontWeight: 400,
                          letterSpacing: -0.1,
                        }}
                      >
                        análises
                      </span>
                    </p>
                  </div>
                  <SparkBars
                    values={[2, 3, 2, 6, 4, numericReadingsCount > 0 ? Math.min(numericReadingsCount, 9) : 0]}
                    color="#48484a"
                    faint="#d1d1d6"
                  />
                </div>
              </HealthCard>
            </div>

            {/* Recent readings list (last 3, tappable) */}
            {hasReadings && viewModel.readings.items.length > 0 ? (
              <div style={{ padding: "10px 18px 0", display: "grid", gap: 8 }}>
                {viewModel.readings.items.slice(0, visibleReadings).map((reading, index) => {
                  const isNewest = index === 0;
                  const thumb =
                    (isNewest && newestReadingThumbnail)
                      ? newestReadingThumbnail
                      : (localThumbnailsByDiagnosisId?.[reading.diagnosisId] ?? reading.thumbnailUrl ?? null);
                  return (
                    <button
                      key={reading.id}
                      type="button"
                      onClick={() => setActiveReading(reading)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        padding: 0,
                        borderRadius: 18,
                        background: "var(--ds-color-surface)",
                        border: "none",
                        boxShadow: "0 1px 2px rgba(9,9,11,0.04)",
                        overflow: "hidden",
                      }}
                    >
                      {thumb ? (
                        <div style={{ overflow: "hidden" }}>
                          <img
                            src={thumb}
                            alt=""
                            style={{ width: "100%", objectFit: "cover", maxHeight: 120, aspectRatio: "16/9" as unknown as string, display: "block" }}
                            aria-hidden="true"
                          />
                        </div>
                      ) : null}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          padding: "12px 14px",
                        }}
                      >
                        {!thumb ? (
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 11,
                              flexShrink: 0,
                              background: "var(--ds-color-ink)",
                              color: "var(--ds-color-on-brand)",
                              display: "grid",
                              placeItems: "center",
                            }}
                          >
                            <GlyphPlay size={14} />
                          </div>
                        ) : null}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: 0.6,
                              textTransform: "uppercase",
                              color: "var(--ds-color-text-muted)",
                              margin: 0,
                            }}
                          >
                            {reading.dateLabel}
                          </p>
                          <p
                            style={{
                              fontSize: 13.5,
                              fontWeight: 600,
                              color: "var(--ds-color-ink)",
                              margin: "3px 0 0",
                              letterSpacing: -0.1,
                              lineHeight: 1.3,
                            }}
                          >
                            {reading.rememberedAs}
                          </p>
                          <p
                            style={{
                              fontSize: 12,
                              color: "var(--ds-color-text-muted)",
                              margin: "4px 0 0",
                              lineHeight: 1.5,
                            }}
                          >
                            {reading.profileImpactPreview}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {viewModel.readings.items.length > visibleReadings ? (
                  <button
                    type="button"
                    onClick={() => setVisibleReadings((n) => n + 5)}
                    style={{
                      width: "100%",
                      padding: "10px 0",
                      borderRadius: 12,
                      background: "transparent",
                      border: "none",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--ds-color-brand)",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      letterSpacing: -0.1,
                    }}
                  >
                    Ver mais {viewModel.readings.items.length - visibleReadings} análises
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* ─── OPORTUNIDADES ───────────────────────────────────────── */}
            <SectionTitle title="Oportunidades" />
            <div style={{ padding: "0 18px", display: "grid", gap: 10 }}>
              {/* Brand */}
              {brandOpportunities.length > 0 ? (
                brandOpportunities.slice(0, 2).map((item) => (
                  <HealthCard key={item.id} onClick={() => setActiveOpportunity(item)}>
                    <CardHeader category="marcas" time="Hoje" label="Marcas Recomendadas" />
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        marginTop: 18,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 19,
                          fontWeight: 700,
                          color: "var(--ds-color-ink)",
                          margin: 0,
                          letterSpacing: -0.45,
                          lineHeight: 1.2,
                        }}
                      >
                        {item.title}
                      </p>
                      <p
                        style={{
                          fontSize: 14,
                          color: "var(--ds-color-text-muted)",
                          margin: "6px 0 0",
                          fontWeight: 400,
                          letterSpacing: -0.1,
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                          overflow: "hidden",
                        } as React.CSSProperties}
                      >
                        {item.preview}
                      </p>
                    </div>
                  </HealthCard>
                ))
              ) : (
                <HealthCard style={{ opacity: 0.7 }}>
                  <CardHeader category="marcas" />
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      marginTop: 18,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 19,
                        fontWeight: 700,
                        color: "var(--ds-color-line-strong)",
                        margin: 0,
                        letterSpacing: -0.45,
                        lineHeight: 1.2,
                      }}
                    >
                      {hasReadings ? "Sem sinal comercial ainda" : "Sem sinal comercial"}
                    </p>
                    <p
                      style={{
                        fontSize: 14,
                        color: "var(--ds-color-line-strong)",
                        margin: "6px 0 0",
                        fontWeight: 400,
                        letterSpacing: -0.1,
                        lineHeight: 1.4,
                      }}
                    >
                      {hasReadings
                        ? "Continue analisando para revelar territórios."
                        : "Territórios aparecem com 3+ análises."}
                    </p>
                    <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                      <GhostLine width="76%" />
                      <GhostLine width="55%" />
                    </div>
                  </div>
                </HealthCard>
              )}

              {/* Collabs */}
              {collabOpportunities.length > 0 ? (
                collabOpportunities.slice(0, 1).map((item) => (
                  <HealthCard key={item.id} onClick={() => setActiveOpportunity(item)}>
                    <CardHeader category="collabs" time="Hoje" label="Collabs Indicadas" />
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        marginTop: 18,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 19,
                          fontWeight: 700,
                          color: "var(--ds-color-ink)",
                          margin: 0,
                          letterSpacing: -0.45,
                          lineHeight: 1.2,
                        }}
                      >
                        {item.title}
                      </p>
                      <p
                        style={{
                          fontSize: 14,
                          color: "var(--ds-color-text-muted)",
                          margin: "6px 0 0",
                          fontWeight: 400,
                          letterSpacing: -0.1,
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                          overflow: "hidden",
                        } as React.CSSProperties}
                      >
                        {item.preview}
                      </p>
                    </div>
                  </HealthCard>
                ))
              ) : (
                <HealthCard style={{ opacity: 0.7 }}>
                  <CardHeader category="collabs" />
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      marginTop: 18,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 19,
                        fontWeight: 700,
                        color: "var(--ds-color-line-strong)",
                        margin: 0,
                        letterSpacing: -0.45,
                        lineHeight: 1.2,
                      }}
                    >
                      Sem indicações ainda
                    </p>
                    <p
                      style={{
                        fontSize: 14,
                        color: "var(--ds-color-line-strong)",
                        margin: "6px 0 0",
                        fontWeight: 400,
                        letterSpacing: -0.1,
                        lineHeight: 1.4,
                      }}
                    >
                      Aparecem quando a narrativa amadurece.
                    </p>
                    <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                      <GhostLine width="68%" />
                    </div>
                  </div>
                </HealthCard>
              )}
            </div>

            {/* ─── COMUNIDADE ──────────────────────────────────────────── */}
            <SectionTitle title="Comunidade" />
            <div style={{ padding: "0 18px 28px", display: "grid", gap: 10 }}>
              {/* Mídia Kit */}
              <button
                type="button"
                onClick={onOpenMediaKit}
                style={{
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  padding: "16px 18px",
                  borderRadius: 20,
                  background: "var(--ds-color-surface)",
                  border: "none",
                  boxShadow: "0 1px 1px rgba(28,28,30,0.04)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    flexShrink: 0,
                    background: "var(--ds-color-brand)",
                    color: "var(--ds-color-on-brand)",
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "0 2px 4px rgba(88,86,214,0.22)",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M3 6.5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <path d="M3 9h14" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "var(--ds-color-ink)",
                      margin: 0,
                      letterSpacing: -0.25,
                    }}
                  >
                    Mídia Kit
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--ds-color-text-muted)",
                      margin: "2px 0 0",
                      letterSpacing: -0.1,
                      lineHeight: 1.35,
                    }}
                  >
                    {isInstagramConnected
                      ? "Pronto para enviar às marcas"
                      : "Conecte o Instagram para liberar"}
                  </p>
                </div>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 9999,
                    flexShrink: 0,
                    background: isInstagramConnected ? "#ebfaef" : "#fff6e6",
                    color: isInstagramConnected ? "#2eb84d" : "#e07d00",
                    fontSize: 11.5,
                    fontWeight: 700,
                    letterSpacing: -0.1,
                  }}
                >
                  {isInstagramConnected ? "Ativo" : "Aguarda IG"}
                </span>
              </button>

              {/* Group consulting */}
              <a
                href={MOBILE_COMMUNITY_ROUTE}
                style={{
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "16px 18px",
                  borderRadius: 20,
                  background: "var(--ds-color-ink)",
                  color: "var(--ds-color-on-brand)",
                  boxShadow: "0 8px 24px -10px rgba(28,28,30,0.4)",
                }}
              >
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    flexShrink: 0,
                    background: "rgba(255,255,255,0.1)",
                    color: "var(--ds-color-on-brand)",
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="7" cy="7.5" r="2.6" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="14" cy="7.5" r="2.6" stroke="currentColor" strokeWidth="1.6" />
                    <path
                      d="M2 17c1-2.4 2.7-3.5 5-3.5s4 1.1 5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M9 17c1-2.4 2.7-3.5 5-3.5s4 1.1 5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "var(--ds-color-on-brand)",
                      margin: 0,
                      letterSpacing: -0.25,
                    }}
                  >
                    Consultoria em grupo
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.6)",
                      margin: "2px 0 0",
                      letterSpacing: -0.1,
                      lineHeight: 1.35,
                    }}
                  >
                    {isPro ? "Quintas, 20h — ver agenda" : "Inclusa no Pro · quintas, 20h"}
                  </p>
                </div>
                <span
                  style={{
                    padding: "6px 12px",
                    borderRadius: 9999,
                    flexShrink: 0,
                    background: "var(--ds-color-surface)",
                    color: "var(--ds-color-ink)",
                    fontSize: 12.5,
                    fontWeight: 600,
                    letterSpacing: -0.1,
                  }}
                >
                  {isPro ? "Entrar" : "Ver Pro"}
                </span>
              </a>
            </div>

            {/* Safety note */}
            {presentation.safetyNote ? (
              <p
                style={{
                  margin: "0 18px 20px",
                  borderRadius: 16,
                  background: "var(--ds-color-surface)",
                  padding: "10px 14px",
                  fontSize: 12,
                  fontWeight: 500,
                  lineHeight: 1.55,
                  color: "var(--ds-color-text-muted)",
                }}
              >
                {presentation.safetyNote}
              </p>
            ) : null}

            <NarrativeMapSnapshotReviewPanel review={snapshotReview} internal={internalReview} />
            {stateNav}

            {appFrame ? <div style={{ height: 28 }} aria-hidden="true" /> : null}
          </div>
        </div>

        {/* ── BOTTOM NAV (app mode) ─────────────────────────────────────── */}
        {appFrame ? (
          <nav
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 40,
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              alignItems: "flex-start",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
              paddingTop: 8,
              background: "rgba(255,255,255,0.94)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              borderTop: "1px solid var(--ds-color-line)",
              height: "calc(env(safe-area-inset-bottom, 0px) + 4.75rem)",
            }}
            aria-label="Navegação principal"
          >
            {/* Perfil */}
            <button
              type="button"
              aria-label="Perfil"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 6,
                minHeight: 52,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                paddingTop: 0,
              }}
            >
              <GlyphProfile active />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--ds-color-ink)",
                  lineHeight: 1,
                }}
              >
                Perfil
              </span>
            </button>

            {/* + Nova análise */}
            <button
              type="button"
              aria-label="Nova análise"
              onClick={onPrimaryAccessAction}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 6,
                minHeight: 52,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                paddingTop: 0,
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 26,
                  borderRadius: 8,
                  border: "1.5px solid var(--ds-color-ink)",
                  display: "grid",
                  placeItems: "center",
                  color: "var(--ds-color-ink)",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
            </button>

            {/* Comunidade */}
            <a
              href={MOBILE_COMMUNITY_ROUTE}
              aria-label="Comunidade"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 6,
                minHeight: 52,
                textDecoration: "none",
                paddingTop: 0,
              }}
            >
              <GlyphCommunity active={false} />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--ds-color-text-secondary)",
                  lineHeight: 1,
                }}
              >
                Comunidade
              </span>
            </a>
          </nav>
        ) : null}

        {/* ── MODALS ────────────────────────────────────────────────────── */}
        <NarrativeMapReadingChapterModal chapter={activeChapter} onClose={() => setActiveChapter(null)} />
        <ReadingDetailModal reading={activeReading} onClose={() => setActiveReading(null)} />
        <NarrativeMapReadingFullDiagnosisModal
          presentation={presentation}
          open={fullDiagnosisOpen}
          onClose={() => setFullDiagnosisOpen(false)}
        />
        <OpportunityDetailSheet item={activeOpportunity} onClose={() => setActiveOpportunity(null)} />

        {/* Share toast */}
        {shareToast ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "fixed",
              bottom: "7rem",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 160,
              borderRadius: 16,
              background: "var(--ds-color-ink)",
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--ds-color-on-brand)",
              boxShadow: "0 4px 24px rgba(9,9,11,0.3)",
            }}
          >
            Link copiado ✓
          </div>
        ) : null}

        {/* Account menu */}
        {accountMenuOpen ? (
          <DiagnosticoAccountMenuSheet
            userInfo={{
              name: userInfo?.name ?? null,
              email: userInfo?.email ?? null,
              handle: null,
              imageUrl: profileImageUrl ?? null,
              plan: userInfo?.plan ?? null,
            }}
            isPro={isPro}
            instagramConnected={isInstagramConnected}
            onUpgrade={() => { setAccountMenuOpen(false); router.push("/dashboard/billing"); }}
            onClose={() => setAccountMenuOpen(false)}
            onOpenMediaKit={() => {
              setAccountMenuOpen(false);
              onOpenMediaKit?.();
            }}
            onOpenCommunity={() => {
              setAccountMenuOpen(false);
              router.push(MOBILE_COMMUNITY_ROUTE);
            }}
            onOpenInstagramConnection={() => {
              setAccountMenuOpen(false);
              router.push("/dashboard/instagram-connection");
            }}
            onOpenBilling={() => {
              setAccountMenuOpen(false);
              router.push("/dashboard/billing");
            }}
            onContactSupport={() => {
              setAccountMenuOpen(false);
              window.location.href = "mailto:support@data2content.ai";
            }}
            onSignOut={() => {
              setAccountMenuOpen(false);
              onSignOut?.();
            }}
            initialView={initialAccountMenuView}
          />
        ) : null}
      </div>
    </div>
  );
}
