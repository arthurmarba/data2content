"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import type {
  DiagnosticoCollabSuggestionsState,
  DiagnosticoCreatorDirectoryState,
  DiagnosticoPageData,
} from "@/app/dashboard/boards/videoUpload/diagnosticoPageData";
import { resolveDiagnosticoLeadingNarrativeSignal } from "@/app/dashboard/boards/videoUpload/diagnosticoNarrativeSignals";
import { DiagnosticoWarningCard } from "./DiagnosticoWarningCard";
import { AudienceInsightsCard, AudienceConnectPrompt } from "./AudienceInsightsCard";
import { MapaConfirmationRow } from "./MapaConfirmationRow";
import {
  TEXT_PRIMARY_HEX,
  TEXT_SECONDARY_HEX,
  TEXT_BODY_HEX,
  INK_DARK_HEX,
  SURFACE_NEUTRAL_HEX,
  ACCENT_ORANGE_HEX,
  SAFE_TOP,
} from "./diagnosticoTokens";
import type { CategoryId } from "./DiagnosticoCategoryMeta";
import {
  refineDiagnosticoSignal,
} from "./diagnosticoDisplayText";
import type {
  ConfirmationResponse,
  ConfirmationState,
} from "./diagnosticoConfirmationTypes";
import type { AssetConfirmationResponse } from "./diagnosticoConfirmationTypes";

// ─── Design tokens ──────────────────────────────────────────────────────────

const SOLID_BG = "#ffffff";

// Unified card shell tokens
const CARD_RADIUS = 20;
const CARD_SHADOW = "0 1px 4px rgba(28,28,30,0.08), 0 0 0 0.5px rgba(28,28,30,0.04)";

const CAT: Record<string, { label: string; color: string; text: string; bg: string }> = {
  diagnostico: { label: "Diagnóstico",        color: "#ff6b35", text: "#ff6b35", bg: "#ffe7d6" },
  narrativa:   { label: "Sua Narrativa",       color: "#ff9500", text: "#e07d00", bg: "#ffeac4" },
  instagram:   { label: "Instagram",           color: "#5e5ce6", text: "#4a48d8", bg: "#dbdaf9" },
  marcas:      { label: "Marcas Recomendadas", color: "#5856d6", text: "#4644c8", bg: "#dad8f6" },
  collabs:     { label: "Collabs Indicadas",   color: "#ff2d55", text: "#e91e47", bg: "#ffcfd8" },
  pautas:      { label: "Próximas Pautas",     color: "#f59e0b", text: "#d97706", bg: "#fef3c7" },
};

const EVOLUTION_TITLE: Record<string, string> = {
  first_reading:        "1ª análise registrada",
  signals_emerging:     "Sinais surgindo",
  pattern_in_formation: "Padrões detectados",
  profile_consistent:   "Perfil consistente",
};

// ─── Category icon: filled circle + white glyph ──────────────────────────────

function CategoryIcon({ category, size = 20 }: { category: string; size?: number }) {
  const cat = CAT[category] ?? CAT["diagnostico"]!;
  const isIg = category === "instagram";
  const bg = isIg
    ? "linear-gradient(135deg, #fbbf24 0%, #ec4899 45%, #8b5cf6 100%)"
    : cat.color;
  const s = size * 0.55;
  const sw = size * 0.6;
  const glyphs: Record<string, ReactNode> = {
    diagnostico: (
      <svg width={s} height={s} viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M1 7h2.5l1.5-4 2.5 8 1.5-4H13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    narrativa: (
      <svg width={s} height={s} viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="7" cy="7" r="2.4" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="7" cy="7" r="0.6" fill="currentColor"/>
      </svg>
    ),
    instagram: (
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2.5" y="2.5" width="11" height="11" rx="3.2" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="8" cy="8" r="2.6" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="11.2" cy="4.8" r="0.7" fill="currentColor"/>
      </svg>
    ),
    marcas: (
      <svg width={s} height={s} viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M7.5 1.5h4v4l-6 6L1.5 7.5l6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <circle cx="9.5" cy="4.5" r="0.9" fill="currentColor"/>
      </svg>
    ),
    collabs: (
      <svg width={s} height={s} viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M2.5 5l2-2 2 2M4.5 3v5.5a1.5 1.5 0 001.5 1.5h2M11.5 9l-2 2-2-2M9.5 11V5.5A1.5 1.5 0 008 4H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    pautas: (
      <svg width={s} height={s} viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M7 1.5a3.5 3.5 0 0 0-2 6.35c.3.25.5.6.5 1v.15h3V8.85c0-.4.2-.75.5-1A3.5 3.5 0 0 0 7 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5.5 11.5h3M6 13h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  };
  return (
    <span style={{
      display: "inline-grid", placeItems: "center",
      width: size, height: size, borderRadius: 9999,
      background: bg, color: "#fff", flexShrink: 0,
      boxShadow: `0 1px 2px ${cat.color}33`,
    }}>
      {glyphs[category] ?? glyphs["diagnostico"]}
    </span>
  );
}

// ─── Shared card primitives ───────────────────────────────────────────────────

function CardShell({ children, onClick, minHeight: minH, bg, variant = "outlined" }: { children: React.ReactNode; onClick?: () => void; minHeight?: number; bg?: string; variant?: "filled" | "outlined" }) {
  const isOutlined = variant === "outlined";
  const style: React.CSSProperties = {
    width: "100%", textAlign: "left", fontFamily: "inherit",
    padding: "18px 22px 22px", borderRadius: CARD_RADIUS,
    minHeight: minH ?? 130,
    background: isOutlined ? "#ffffff" : (bg ?? "#fff"),
    border: isOutlined ? "1.5px solid #71717a" : "none",
    boxShadow: isOutlined ? "none" : CARD_SHADOW,
    display: "flex", flexDirection: "column", cursor: onClick ? "pointer" : "default",
    overflow: "hidden",
  };
  return onClick ? (
    <button type="button" onClick={onClick} style={style}>{children}</button>
  ) : (
    <div style={style}>{children}</div>
  );
}

function CardHeader({ cat, time }: { cat: string; time?: string }) {
  const c = CAT[cat] ?? CAT["diagnostico"]!;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
      <CategoryIcon category={cat} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY_HEX, margin: 0, letterSpacing: -0.3 }}>
          {c.label}
        </p>
        {time ? (
          <p style={{ fontSize: 12, color: TEXT_SECONDARY_HEX, margin: "2px 0 0", letterSpacing: -0.1 }}>{time}</p>
        ) : null}
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{ padding: "20px 22px 8px" }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: TEXT_SECONDARY_HEX, margin: 0, letterSpacing: 0.2, textTransform: "uppercase" }}>
        {title}
      </h2>
    </div>
  );
}

// ─── Mapa card sub-components ─────────────────────────────────────────────────

function MapaSection({
  labelColor,
  label,
  icon,
  isFirst = false,
  children,
}: {
  labelColor: string;
  label: string;
  icon?: ReactNode;
  isFirst?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{
      paddingTop: isFirst ? 0 : 16,
      paddingBottom: 16,
      borderTop: isFirst ? "none" : "1px solid rgba(0,0,0,0.05)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, margin: "0 0 9px" }}>
        {icon && (
          <span style={{ display: "inline-grid", placeItems: "center", color: labelColor, flexShrink: 0 }}>
            {icon}
          </span>
        )}
        <p style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 0.7,
          textTransform: "uppercase", color: labelColor,
          margin: 0,
        }}>
          {label}
        </p>
      </div>
      {children}
    </div>
  );
}

function MapaChips({ chips, chipBg, chipColor, chipBorder }: { chips: string[]; chipBg?: string; chipColor?: string; chipBorder?: string }) {
  if (chips.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
      {chips.map((chip) => (
        <span
          key={chip}
          style={{
            borderRadius: 999, background: chipBg ?? SURFACE_NEUTRAL_HEX, color: chipColor ?? TEXT_BODY_HEX,
            fontSize: 13, fontWeight: 500, padding: "5px 13px", letterSpacing: -0.1,
            maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            border: chipBorder ? `1.5px solid ${chipBorder}` : "none",
          }}
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

// ─── Mapa display helpers ────────────────────────────────────────────────────

/** Truncate a label to maxLen chars at a word boundary, appending "…" if needed. */
function truncateLabel(label: string, maxLen = 22): string {
  if (label.length <= maxLen) return label;
  const cut = label.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

/**
 * Deduplicate territory/signal labels that share the same first 4+ words.
 * Keeps the item with the highest evidenceCount among duplicates.
 */
function deduplicateByPrefix<T extends { label: string; evidenceCount?: number }>(
  items: T[]
): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    const words = item.label.trim().split(/\s+/);
    const key = words.slice(0, 4).join(" ").toLowerCase();
    const existing = seen.get(key);
    if (!existing || (item.evidenceCount ?? 0) > (existing.evidenceCount ?? 0)) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
}

/** Format a date as relative "há X horas/dias/semanas" label. */
function fmtAgo(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "há menos de 1h";
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "há 1 dia";
  if (days < 7) return `há ${days} dias`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "há 1 semana" : `há ${weeks} semanas`;
}

/** Format a reach/view number as ~1k, ~12k, etc. */
function fmtReach(n: number): string {
  if (n >= 1_000_000) return `~${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)    return `~${Math.round(n / 1_000)}k`;
  if (n >= 1_000)     return `~${(n / 1_000).toFixed(1)}k`;
  return `~${n}`;
}

// ─── CardRowHeader — identidade visual Apple Health para cada card ─────────────

/**
 * Header reutilizável estilo Apple Saúde:
 * [● círculo colorido]  Título bold
 *                       subtítulo cinza
 *
 * Sem chevron — usado apenas em cards que são conteúdo, não navegação.
 */
function CardRowHeader({
  iconBg,
  icon,
  title,
  subtitle,
  action,
  noBottomMargin,
}: {
  iconBg: string;
  icon: ReactNode;
  title: string;
  subtitle?: string | null;
  action?: ReactNode;
  noBottomMargin?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: noBottomMargin ? 0 : 16 }}>
      <div style={{
        width: 38, height: 38, borderRadius: 9999,
        background: iconBg, color: "#fff",
        display: "grid", placeItems: "center", flexShrink: 0,
        boxShadow: iconBg.startsWith("linear-gradient") || iconBg.startsWith("radial-gradient")
          ? "0 2px 8px rgba(139,92,246,0.30)"
          : `0 2px 8px ${iconBg}55`,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY_HEX, margin: 0, letterSpacing: -0.3 }}>
          {title}
        </p>
        {subtitle ? (
          <p style={{ fontSize: 12, color: TEXT_SECONDARY_HEX, margin: "2px 0 0", letterSpacing: -0.1 }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div style={{ flexShrink: 0 }}>{action}</div> : null}
    </div>
  );
}

// ─── MapaCard ─────────────────────────────────────────────────────────────────

function MapaCard({
  synthesis: s,
  leadingNarrative,
  narrativeConfirmationState,
  onConfirmNarrative,
  territoriesConfirmationState,
  onConfirmTerritories,
  toneConfirmationState,
  onConfirmTone,
  onConfirmAsset,
  assetConfirmations,
  endorsedHypotheses,
  adjacentNarrativesFromMap,
  hasReadings,
  onNewReading,
  onOpenNarrative,
  mapEvolutionStatus,
  lastReadingAt = null,
}: {
  synthesis: DiagnosticoPageData["synthesis"];
  leadingNarrative: ReturnType<typeof resolveDiagnosticoLeadingNarrativeSignal>;
  narrativeConfirmationState?: ConfirmationState;
  onConfirmNarrative?: (r: ConfirmationResponse) => void;
  territoriesConfirmationState?: ConfirmationState;
  onConfirmTerritories?: (r: ConfirmationResponse) => void;
  toneConfirmationState?: ConfirmationState;
  onConfirmTone?: (r: ConfirmationResponse) => void;
  onConfirmAsset?: (assetLabel: string, response: AssetConfirmationResponse) => void;
  assetConfirmations?: Map<string, "confirmed" | "dismissed">;
  endorsedHypotheses: string[];
  /** Etapa 4: adjacent narratives from mapConfirmations (all states). */
  adjacentNarrativesFromMap?: Array<{ label: string; state: "pending" | "confirmed" | "dismissed"; source: "detected" | "manual" }>;
  hasReadings: boolean;
  onNewReading: () => void;
  onOpenNarrative?: () => void;
  /** Map evolution status for footer label (first_reading, signals_emerging, etc.) */
  mapEvolutionStatus?: string | null;
  /** ISO string of the most recent reading — used for freshness label in footer. */
  lastReadingAt?: string | null;
}) {
  // ── Confirmation priority: narrative → tone → territories ──
  // Meta-label patterns generated by the AI that should never surface to the creator.
  const META_LABEL_PATTERNS = /\b(território|territorio|possível|possivel|potencial|marca possível|marca possivel)\b/i;

  const rawFilteredTerritories = leadingNarrative
    ? s.narrativeTerritories.filter(
        (t) => t.label.trim().toLowerCase() !== leadingNarrative.label.trim().toLowerCase()
      )
    : s.narrativeTerritories;
  // Deduplicate + remove AI meta-labels. No evidenceCount threshold — show all real signals.
  const filteredTerritories = deduplicateByPrefix(
    rawFilteredTerritories.filter((t) => !META_LABEL_PATTERNS.test(t.label))
  );

  const shouldAskNarrative =
    narrativeConfirmationState === "pending" &&
    onConfirmNarrative != null &&
    (leadingNarrative?.evidenceCount ?? 0) >= 2;

  const shouldAskTone =
    toneConfirmationState === "pending" &&
    onConfirmTone != null &&
    s.toneSignals.length >= 1;

  const shouldAskTerritories =
    territoriesConfirmationState === "pending" &&
    onConfirmTerritories != null &&
    filteredTerritories.length >= 1;

  // ── Hypothesis enrichment ──────────────────────────────────────────────────
  const endorsedKey = endorsedHypotheses.join("\0");
  const [endorsedLocal, setEndorsedLocal] = useState<Set<string>>(new Set(endorsedHypotheses));
  const [hypothesisPendingSet, setHypothesisPendingSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    setEndorsedLocal(new Set(endorsedHypotheses));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endorsedKey]);

  const filteredHypotheses = leadingNarrative
    ? s.testedNarratives.filter(
        (h) => h.label.trim().toLowerCase() !== leadingNarrative.label.trim().toLowerCase()
      )
    : s.testedNarratives;
  const pendingHypothesis = filteredHypotheses.find((h) => !endorsedLocal.has(h.label)) ?? null;

  async function handleEndorseHypothesis(label: string) {
    if (endorsedLocal.has(label) || hypothesisPendingSet.has(label)) return;
    setHypothesisPendingSet((p) => new Set(p).add(label));
    try {
      const res = await fetch("/api/dashboard/mobile-strategic-profile/map/endorse-hypothesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error("endorse_failed");
      setEndorsedLocal((e) => new Set(e).add(label));
    } catch {
      // non-fatal
    } finally {
      setHypothesisPendingSet((p) => { const n = new Set(p); n.delete(label); return n; });
    }
  }

  // ── Asset enrichment ───────────────────────────────────────────────────────
  const emergingAssets = s.confirmedLifeAssets.filter((a) => a.evidenceCount < 2);
  const pendingAsset = emergingAssets.find((a) => {
    const state = assetConfirmations?.get(a.label);
    return state !== "confirmed" && state !== "dismissed";
  }) ?? null;

  // ── Extended priority chain ────────────────────────────────────────────────
  const activePending: "narrative" | "tone" | "territories" | "hypothesis" | "asset" | null =
    shouldAskNarrative ? "narrative"
    : shouldAskTone ? "tone"
    : shouldAskTerritories ? "territories"
    : pendingHypothesis != null ? "hypothesis"
    : pendingAsset != null ? "asset"
    : null;

  // ── Narrative ──
  const narrativaCopy = leadingNarrative
    ? refineDiagnosticoSignal(leadingNarrative, "narrative")
    : null;
  const narrativaLabel = narrativaCopy?.label ?? null;

  // ── Assets: todos os sinais detectados, sem threshold de evidência ──
  const confirmedAssets = s.confirmedLifeAssets;

  const hasAnything =
    leadingNarrative != null ||
    s.testedNarratives.length > 0 ||
    filteredTerritories.length > 0 ||
    s.dominantTone != null ||
    confirmedAssets.length > 0 ||
    s.executionPatterns.length > 0;

  // ── Tom: chips (all signals, fallback to dominantTone) ──
  const toneChips = s.toneSignals.length > 0
    ? s.toneSignals.slice(0, 4).map((t) => t.label)
    : s.dominantTone ? [s.dominantTone] : [];

  // ── Extensões (etapa 4): show only confirmed adjacents as read-only chips ──
  // Detection/confirmation/add flow lives in DiagnosticoNarrativeDetailView.
  const confirmedAdjacents = (adjacentNarrativesFromMap ?? [])
    .filter((a) => a.state === "confirmed")
    .map((a) => a.label);

  // ── Formatos (etapa 7): só production (speech = toneSignals, não duplicar) ──
  // Labels curtos (≤ 40 chars) como guardrail — frases longas são sinal de dado ruim.
  const formatoChips = s.executionPatterns
    .filter((p) => p.area === "production")
    .slice()
    .sort((a, b) => b.evidenceCount - a.evidenceCount)
    .map((p) => p.label)
    .filter((label) => label.length <= 40);

  // ── Assets: dedup apenas contra toneSignals (evita "educativo" em dois lugares) ──
  const toneLabelsLower = new Set(s.toneSignals.map((t) => t.label.toLowerCase().trim()));
  const confirmedAssetsDeduped = confirmedAssets.filter(
    (a) => !toneLabelsLower.has(a.label.toLowerCase().trim())
  );

  // ── Map completeness (Apple Health–style) ──
  const mapDimensionsTotal = 4; // narrative, territories, assets, tone
  const mapDimensionsConfirmed = [
    narrativeConfirmationState === "confirmed",
    territoriesConfirmationState === "confirmed",
    confirmedAssets.length > 0,
    toneConfirmationState === "confirmed",
  ].filter(Boolean).length;

  const cardShell: React.CSSProperties = {
    borderRadius: CARD_RADIUS,
    background: "#fffaf7",
    boxShadow: CARD_SHADOW,
    padding: "18px 22px 4px",
  };

  // ── Footer: "N análises · Status" ──────────────────────────────────────────
  const FOOTER_STATUS: Record<string, string> = {
    first_reading:        "Mapa iniciado",
    signals_emerging:     "Sinais surgindo",
    pattern_in_formation: "Padrões detectados",
    profile_consistent:   "Mapa consistente",
  };
  const footerStatusLabel = mapEvolutionStatus ? (FOOTER_STATUS[mapEvolutionStatus] ?? null) : null;
  const footerCountLabel = s.analyzedReadingsCount > 0
    ? `${s.analyzedReadingsCount} ${s.analyzedReadingsCount === 1 ? "análise" : "análises"}`
    : null;
  const agoLabel = fmtAgo(lastReadingAt);
  const showFooter = footerCountLabel != null;

  const uploadIcon = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  // ── Header row: "Aprimorar" aparece só quando já há leituras. Antes disso,
  // o CTA de primeira análise fica abaixo do texto do empty state.
  const MapaHeader = (
    <CardRowHeader
      iconBg={ACCENT_ORANGE_HEX}
      icon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2.2"/>
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      }
      title="Seu Mapa"
      subtitle={null}
      action={hasReadings ? (
        <button
          type="button"
          onClick={onNewReading}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            borderRadius: 999, padding: "6px 14px",
            background: "transparent", color: TEXT_BODY_HEX,
            fontSize: 12, fontWeight: 600,
            border: `1.5px solid ${TEXT_BODY_HEX}`,
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: "none",
          }}
        >
          {uploadIcon}
          Aprimorar
        </button>
      ) : null}
    />
  );

  // ── Footer row: divider + "N análises · Status" ────────────────────────────
  const MapaFooter = showFooter ? (
    <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", margin: "16px -22px 0", padding: "10px 22px 16px" }}>
      <p style={{ fontSize: 12, color: TEXT_SECONDARY_HEX, margin: 0 }}>
        {footerCountLabel}{agoLabel ? ` · última ${agoLabel}` : ""}
      </p>
    </div>
  ) : (
    <div style={{ paddingBottom: 16 }} />
  );

  // Empty — no readings yet
  if (!hasAnything && !hasReadings) {
    return (
      <div style={{ ...cardShell, padding: "22px 22px 20px" }}>
        {MapaHeader}
        <p style={{ fontSize: 16, fontWeight: 600, color: TEXT_BODY_HEX, margin: 0, lineHeight: 1.45 }}>
          Seu mapa está sendo construído.
        </p>
        <p style={{ fontSize: 14, color: TEXT_SECONDARY_HEX, margin: "6px 0 16px", lineHeight: 1.5 }}>
          Cada vídeo analisado revela um pouco mais de quem você é.
        </p>
        <button
          type="button"
          onClick={onNewReading}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            borderRadius: 999, padding: "10px 18px",
            background: "transparent", color: TEXT_PRIMARY_HEX,
            fontSize: 13, fontWeight: 600, fontFamily: "inherit",
            border: `1.5px solid ${TEXT_PRIMARY_HEX}`, cursor: "pointer",
          }}
        >
          {uploadIcon}
          Primeira análise
        </button>
      </div>
    );
  }

  // Emerging — has readings but map still forming
  if (!hasAnything && hasReadings) {
    return (
      <div style={{ ...cardShell, padding: "22px 22px 6px" }}>
        {MapaHeader}
        <p style={{ fontSize: 16, fontWeight: 600, color: TEXT_BODY_HEX, margin: 0, lineHeight: 1.45 }}>
          Sinais em análise.
        </p>
        <p style={{ fontSize: 14, color: TEXT_SECONDARY_HEX, margin: "6px 0 0", lineHeight: 1.5 }}>
          Mais um vídeo e o mapa começa a tomar forma.
        </p>
        {MapaFooter}
      </div>
    );
  }

  // Full map card
  return (
    <div style={cardShell}>
      {MapaHeader}
      {/* ── Narrativa — primeira seção do mapa, sem borda lateral ── */}
      {narrativaLabel ? (
        <div style={{ marginTop: 20, marginBottom: 16 }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: TEXT_PRIMARY_HEX, margin: 0, lineHeight: 1.3, letterSpacing: -0.5 }}>
            {narrativaLabel}
          </p>
          {activePending === "narrative" && (
            <MapaConfirmationRow
              variant="3way"
              question="Isso ressoa com você?"
              onPrimary={() => onConfirmNarrative!("yes")}
              onSecondary={() => onConfirmNarrative!("almost")}
              onTertiary={() => onConfirmNarrative!("no")}
            />
          )}
          {activePending === "hypothesis" && pendingHypothesis != null && (
            <MapaConfirmationRow
              variant="2way"
              label="Isso ressoa com você?"
              title={pendingHypothesis.label}
              disabled={hypothesisPendingSet.has(pendingHypothesis.label)}
              primaryLabel={hypothesisPendingSet.has(pendingHypothesis.label) ? "Salvando…" : "Faz sentido"}
              primaryColor={ACCENT_ORANGE_HEX}
              onPrimary={() => handleEndorseHypothesis(pendingHypothesis.label)}
              onTertiary={() => setEndorsedLocal((e) => new Set(e).add(pendingHypothesis.label))}
            />
          )}
        </div>
      ) : (
        <MapaSection labelColor="#c96a00" label="Narrativa" isFirst>
          <p style={{ fontSize: 13, color: TEXT_SECONDARY_HEX, margin: 0, fontStyle: "italic" }}>Emergindo...</p>
        </MapaSection>
      )}

      {/* ── Assuntos ──────────────────────────────────── */}
      <MapaSection
        labelColor="#c96a00"
        label="Assuntos"
        icon={
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 4.5h10M2 9.5h10M5 2L3.5 12M10.5 2L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        }
      >
        {filteredTerritories.length > 0 ? (
          <MapaChips
            chips={filteredTerritories.map((t) => t.label)}
            chipBg="#ffe4c4"
            chipColor="#9a3412"
          />
        ) : (
          <p style={{ fontSize: 13, color: TEXT_SECONDARY_HEX, margin: 0, fontStyle: "italic" }}>Emergindo...</p>
        )}
        {activePending === "territories" && (
          <MapaConfirmationRow
            variant="3way"
            question="Esses territórios fazem sentido?"
            onPrimary={() => onConfirmTerritories!("yes")}
            onSecondary={() => onConfirmTerritories!("almost")}
            onTertiary={() => onConfirmTerritories!("no")}
          />
        )}
      </MapaSection>

      {/* ── Você também fala sobre (etapa 4) — read-only overview ─────────── */}
      {/* Full detection/confirmation/add flow lives in DiagnosticoNarrativeDetailView. */}
      {confirmedAdjacents.length > 0 && (
        <MapaSection
          labelColor="#7c3aed"
          label="Você também fala sobre"
          icon={
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M5.5 8.5a3 3 0 0 0 3 0l1.5-1.5a2.12 2.12 0 0 0-3-3L6.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M8.5 5.5a3 3 0 0 0-3 0L4 7a2.12 2.12 0 0 0 3 3l.5-.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          }
        >
          <MapaChips chips={confirmedAdjacents} chipBg="#ffe4c4" chipColor="#9a3412" />
        </MapaSection>
      )}

      {/* ── Assets ────────────────────────────────────── */}
      <MapaSection
        labelColor="#c96a00"
        label="Assets de vida"
        icon={
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        }
      >
        {confirmedAssetsDeduped.length > 0 ? (
          <MapaChips
            chips={confirmedAssetsDeduped.map((a) => a.label)}
            chipBg="#ffe4c4"
            chipColor="#9a3412"
          />
        ) : (
          <p style={{ fontSize: 13, color: TEXT_SECONDARY_HEX, margin: 0, fontStyle: "italic" }}>Emergindo...</p>
        )}
        {activePending === "asset" && pendingAsset != null && onConfirmAsset != null && (
          <MapaConfirmationRow
            variant="3way-asset"
            label="Faz parte da sua vida?"
            labelColor="#52b88a"
            title={pendingAsset.label}
            onPrimary={() => onConfirmAsset(pendingAsset.label, "yes")}
            onSecondary={() => onConfirmAsset(pendingAsset.label, "occasional")}
            onTertiary={() => onConfirmAsset(pendingAsset.label, "no")}
          />
        )}
      </MapaSection>

      {/* ── Tom + Formatos — merged into single "COMO CRIA" section ─────── */}
      {(toneChips.length > 0 || formatoChips.length > 0 || activePending === "tone") && (
        <MapaSection
          labelColor="#c96a00"
          label="Como cria"
          icon={
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9.5 2l2.5 2.5-7 7H2.5V9l7-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
        >
          {(toneChips.length > 0 || formatoChips.length > 0) ? (
            <MapaChips chips={[...toneChips, ...formatoChips]} chipBg="#ffe4c4" chipColor="#9a3412" />
          ) : (
            <p style={{ fontSize: 13, color: TEXT_SECONDARY_HEX, margin: 0, fontStyle: "italic" }}>Emergindo...</p>
          )}
          {activePending === "tone" && (
            <MapaConfirmationRow
              variant="3way"
              question="Esse tom reflete como você fala?"
              onPrimary={() => onConfirmTone!("yes")}
              onSecondary={() => onConfirmTone!("almost")}
              onTertiary={() => onConfirmTone!("no")}
            />
          )}
        </MapaSection>
      )}

      {MapaFooter}
    </div>
  );
}

// ─── Raio X de Coerência card — kept for backwards compatibility but no longer rendered ──

function RaioXCard({
  status,
  readingCount,
  quotaLimit,
  confirmedLabels,
  hasReadings,
  onNewReading,
  onOpenDiagnosis,
}: {
  status: string;
  readingCount: number;
  quotaLimit: number;
  confirmedLabels: string[];
  hasReadings: boolean;
  onNewReading: () => void;
  onOpenDiagnosis?: () => void;
}) {
  const remainingThisMonth = Math.max(quotaLimit - readingCount, 0);

  return (
    <div style={{
      borderRadius: CARD_RADIUS,
      background: "#fff",
      boxShadow: CARD_SHADOW,
      padding: "22px 22px 24px",
    }}>
      {/* Label only — status is the first visual weight */}
      <p style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 0.7,
        textTransform: "uppercase", color: ACCENT_ORANGE_HEX, margin: "0 0 8px",
      }}>
        Raio X de Coerência
      </p>

      <p style={{ fontSize: 22, fontWeight: 700, color: TEXT_PRIMARY_HEX, margin: 0, letterSpacing: -0.5, lineHeight: 1.2 }}>
        {status}
      </p>
      <p style={{ fontSize: 13, color: TEXT_SECONDARY_HEX, margin: "5px 0 0", lineHeight: 1.4 }}>
        {hasReadings
          ? `${readingCount} ${readingCount === 1 ? "vídeo analisado" : "vídeos analisados"}`
          : "Analise e fortaleça sua presença digital"}
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button
          type="button"
          onClick={onNewReading}
          style={{
            flex: 1, borderRadius: 14, padding: "13px 14px",
            background: TEXT_PRIMARY_HEX, color: "#fff",
            fontSize: 13, fontWeight: 700, border: "none",
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Subir Vídeo
        </button>
        <button
          type="button"
          onClick={onOpenDiagnosis}
          disabled={!onOpenDiagnosis || !hasReadings}
          style={{
            flex: 1, borderRadius: 14, padding: "13px 14px",
            background: SURFACE_NEUTRAL_HEX, color: TEXT_BODY_HEX,
            fontSize: 13, fontWeight: 700, border: "none",
            cursor: onOpenDiagnosis && hasReadings ? "pointer" : "default",
            fontFamily: "inherit",
            opacity: hasReadings ? 1 : 0.45,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
            <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Ver Todos
        </button>
      </div>

      {quotaLimit > 0 && remainingThisMonth <= 2 && (
        <p style={{ fontSize: 12, color: remainingThisMonth === 0 ? ACCENT_ORANGE_HEX : TEXT_SECONDARY_HEX, margin: "12px 0 0", textAlign: "center" }}>
          {remainingThisMonth === 0
            ? "Sem análises restantes este mês"
            : `${remainingThisMonth} ${remainingThisMonth === 1 ? "análise restante" : "análises restantes"} neste mês`}
        </p>
      )}
    </div>
  );
}

// ─── Instagram card ───────────────────────────────────────────────────────────

function InstagramCard({
  instagramConnected,
  instagramMetrics,
  postsSinceLastVisit,
  newThemesSinceLastVisit,
  onOpen,
}: {
  instagramConnected: boolean;
  instagramMetrics: DiagnosticoPageData["instagramMetrics"];
  postsSinceLastVisit: number;
  newThemesSinceLastVisit: number;
  onOpen?: () => void;
}) {
  if (!instagramConnected) return null;
  // Show when there are new signals or metrics are available
  const hasNewSignals = postsSinceLastVisit > 0;
  const hasMetrics = instagramMetrics != null;
  if (!hasNewSignals && !hasMetrics) return null;

  const topResonance = instagramMetrics?.territoryResonance?.[0] ?? null;
  const igTitle = hasNewSignals ? "Sinais novos" : "Instagram";
  const igSubtitle = hasNewSignals
    ? `${postsSinceLastVisit === 1 ? "1 post entrou" : `${postsSinceLastVisit} posts entraram`} na leitura${newThemesSinceLastVisit > 0 ? " · tema novo no mapa" : ""}`
    : topResonance
      ? `${topResonance.label} é o que mais conecta`
      : instagramMetrics?.avgReachPerPost != null
        ? `${fmtReach(instagramMetrics.avgReachPerPost)} de alcance por post`
        : "Conectado e calibrando o mapa";

  return (
    <div style={{
      borderRadius: CARD_RADIUS,
      background: "#e8e7ff",
      border: "none",
      boxShadow: CARD_SHADOW,
      padding: "18px 22px",
    }}>
      <CardRowHeader
        iconBg="linear-gradient(135deg, #fbbf24 0%, #ec4899 45%, #8b5cf6 100%)"
        icon={
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2.5" y="2.5" width="11" height="11" rx="3.2" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="8" cy="8" r="2.6" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="11.2" cy="4.8" r="0.7" fill="currentColor"/>
          </svg>
        }
        title={igTitle}
        subtitle={igSubtitle}
        noBottomMargin
        action={
          onOpen ? (
            <button
              type="button"
              onClick={onOpen}
              style={{
                display: "inline-flex", alignItems: "center",
                borderRadius: 999, padding: "6px 14px",
                background: "transparent", color: TEXT_BODY_HEX,
                fontSize: 12, fontWeight: 600,
                border: `1.5px solid ${TEXT_BODY_HEX}`,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Ver
            </button>
          ) : undefined
        }
      />
    </div>
  );
}

// ─── Pautas card — output do mapa, card separado ─────────────────────────────

function PautasCard({
  contentIdeas,
  contentIdeasReadiness,
  isGeneratingIdeas = false,
  ideaGenerationBlocker = null,
  ideaQuotaResetAt = null,
  onRetryGenerateIdeas,
  onNewReading,
  onOpenIdea,
  whatsappLinked = false,
  onConnectWhatsApp,
}: {
  contentIdeas: DiagnosticoPageData["contentIdeas"];
  contentIdeasReadiness: DiagnosticoPageData["contentIdeasReadiness"];
  isGeneratingIdeas?: boolean;
  ideaGenerationBlocker?: "premium_required" | "quota_exceeded" | "map_incomplete" | "failed" | null;
  ideaQuotaResetAt?: string | null;
  onRetryGenerateIdeas?: () => void;
  onNewReading?: () => void;
  onOpenIdea?: (ideaId: string) => void;
  whatsappLinked?: boolean;
  onConnectWhatsApp?: () => void;
}) {
  // O card sempre renderiza — em estados sem dados mostra um teaser.

  // ── Ação inline com o título (slot direito do CardRowHeader) ─────────────────
  // Regra: uma ação por vez, na ordem de prioridade abaixo.
  const WA_ICON = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.099.546 4.07 1.5 5.785L0 24l6.389-1.674A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.371l-.36-.214-3.724.976.994-3.632-.234-.374A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
    </svg>
  );

  const headerAction: React.ReactNode = (() => {
    // map_incomplete → próximo passo: analisar vídeo
    if (ideaGenerationBlocker === "map_incomplete" && onNewReading) {
      return (
        <button
          type="button"
          onClick={onNewReading}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            borderRadius: 999, padding: "5px 11px",
            background: "transparent", color: TEXT_BODY_HEX,
            fontSize: 11, fontWeight: 600,
            border: `1.5px solid ${TEXT_BODY_HEX}`,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Analisar novo vídeo
        </button>
      );
    }
    // failed → tentar novamente
    if (ideaGenerationBlocker === "failed" && onRetryGenerateIdeas) {
      return (
        <button
          type="button"
          onClick={onRetryGenerateIdeas}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            borderRadius: 999, padding: "5px 11px",
            background: "#ede9fe", color: "#4240c9",
            fontSize: 11, fontWeight: 600, border: "none",
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1.5 7A5.5 5.5 0 1 0 3.5 3M1.5 1v2.5H4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Tentar novamente
        </button>
      );
    }
    // ideas prontas → botão WhatsApp (conectado ou não)
    if (contentIdeas.length > 0) {
      if (whatsappLinked) {
        return (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            borderRadius: 999, padding: "5px 11px",
            background: "#dcfce7", color: "#15803d",
            fontSize: 11, fontWeight: 600,
          }}>
            {WA_ICON}
            Alertas ativos
          </span>
        );
      }
      if (onConnectWhatsApp) {
        return (
          <button
            type="button"
            onClick={onConnectWhatsApp}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              borderRadius: 999, padding: "6px 14px",
              background: "transparent", color: TEXT_BODY_HEX,
              fontSize: 12, fontWeight: 600,
              border: `1.5px solid ${TEXT_BODY_HEX}`,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {WA_ICON}
            Receber
          </button>
        );
      }
    }
    return null;
  })();

  // Header sem margem inferior quando não há body
  const noBody = ideaGenerationBlocker === "map_incomplete";

  return (
    <div style={{
      borderRadius: CARD_RADIUS,
      background: "#f7f5ff",
      border: "none",
      boxShadow: "0 1px 6px rgba(139,92,246,0.10), 0 0 0 0.5px rgba(139,92,246,0.08)",
      padding: "18px 22px 22px",
    }}>
      <CardRowHeader
        iconBg="#8b5cf6"
        icon={
          <svg width="17" height="17" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1.5a3.5 3.5 0 0 0-2 6.35c.3.25.5.6.5 1v.15h3V8.85c0-.4.2-.75.5-1A3.5 3.5 0 0 0 7 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5.5 11.5h3M6 13h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        }
        title="Pautas"
        subtitle={
          contentIdeas.length > 0
            ? null
            : isGeneratingIdeas
            ? "Gerando..."
            : (contentIdeasReadiness.premiumRequired || ideaGenerationBlocker === "premium_required")
            ? "Disponível no plano Pro"
            : ideaGenerationBlocker === "quota_exceeded"
            ? "Cota deste mês esgotada"
            : ideaGenerationBlocker === "map_incomplete"
            ? "Analise um vídeo para começar"
            : ideaGenerationBlocker === "failed"
            ? "Não conseguimos gerar agora"
            : null
        }
        action={headerAction}
        noBottomMargin={noBody}
      />

      {/* Estado A: pautas prontas */}
      {contentIdeas.length > 0 ? (
        <>
          {/* Lista de roteiros em rows com dividers */}
          <div style={{ margin: "4px -22px 0" }}>
            {isGeneratingIdeas ? (
              /* Skeleton sobrepõe os 3 itens existentes — não acumula abaixo */
              <>
                <style>{`@keyframes d2c-row-pulse{0%,100%{opacity:.35}50%{opacity:.12}}`}</style>
                {([180, 220, 160] as number[]).map((w, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", padding: "14px 22px",
                    borderTop: i === 0 ? "none" : "1px solid rgba(139,92,246,0.08)",
                  }}>
                    <div style={{
                      height: 13, width: w, borderRadius: 6,
                      background: "#ddd6fe",
                      animation: `d2c-row-pulse ${1.0 + i * 0.15}s ease-in-out infinite`,
                    }} />
                  </div>
                ))}
              </>
            ) : (
              contentIdeas.slice(0, 3).map((idea, i) => (
                <button
                  key={idea.id}
                  type="button"
                  onClick={() => onOpenIdea?.(idea.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "14px 22px",
                    background: "transparent", border: "none",
                    borderTop: i === 0 ? "none" : "1px solid rgba(139,92,246,0.08)",
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  }}
                >
                  <span style={{
                    flex: 1, fontSize: 13, fontWeight: 500, lineHeight: 1.4,
                    color: "#3b1f8c", letterSpacing: -0.1,
                  }}>
                    {idea.title}
                  </span>
                  <span style={{ fontSize: 14, color: "#8b5cf6", opacity: 0.5, flexShrink: 0 }}>›</span>
                </button>
              ))
            )}
          </div>
          {/* Footer */}
          <div style={{ margin: "0 -22px", padding: "9px 22px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {contentIdeas[0]?.generatedAt ? (
              <p style={{ fontSize: 11, color: TEXT_SECONDARY_HEX, margin: 0, letterSpacing: 0.1 }}>
                {isGeneratingIdeas ? "Buscando pautas…" : `Geradas hoje · ${new Date(contentIdeas[0].generatedAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`}
              </p>
            ) : <span />}
            {onRetryGenerateIdeas && !isGeneratingIdeas && (
              <button
                type="button"
                onClick={onRetryGenerateIdeas}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 600, color: "#7c3aed",
                  fontFamily: "inherit", padding: 0,
                }}
              >
                Trocar por novas →
              </button>
            )}
          </div>
        </>
      ) : isGeneratingIdeas ? (
        /* Estado B: gerando */
        <>
          <style>{`
            @keyframes d2c-pulse {
              0%, 100% { opacity: 0.35; }
              50%       { opacity: 0.12; }
            }
          `}</style>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {([108, 136, 90] as number[]).map((w, i) => (
              <span
                key={i}
                style={{
                  borderRadius: 999, background: "#ede9fe",
                  display: "inline-block", height: 30, width: w,
                  animation: `d2c-pulse ${1.1 + i * 0.18}s ease-in-out infinite`,
                }}
              />
            ))}
          </div>
        </>
      ) : (contentIdeasReadiness.premiumRequired || ideaGenerationBlocker === "premium_required") ? (
        /* Estado C: plano não cobre */
        <p style={{ fontSize: 13, color: TEXT_SECONDARY_HEX, margin: 0, lineHeight: 1.5 }}>
          Disponível no plano Pro.
        </p>
      ) : ideaGenerationBlocker === "quota_exceeded" ? (
        /* Estado D-quota: cota esgotada */
        <p style={{ fontSize: 13, color: TEXT_SECONDARY_HEX, margin: 0, lineHeight: 1.5 }}>
          {ideaQuotaResetAt
            ? `Pautas deste mês esgotadas. Novas disponíveis em ${new Date(ideaQuotaResetAt).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}.`
            : "Pautas deste mês esgotadas. Novas disponíveis no próximo mês."}
        </p>
      ) : ideaGenerationBlocker === "map_incomplete" ? (
        /* Estado D-map: header + action button resolvem — sem body */
        null
      ) : ideaGenerationBlocker === "failed" ? (
        /* Estado D-failed: botão no header, apenas mensagem informacional aqui */
        <p style={{ fontSize: 13, color: TEXT_SECONDARY_HEX, margin: 0, lineHeight: 1.4 }}>
          Seu mapa está intacto.
        </p>
      ) : contentIdeasReadiness.ready ? (
        /* Estado E: pronto mas ainda carregando */
        <p style={{ fontSize: 13, color: TEXT_SECONDARY_HEX, margin: 0, fontStyle: "italic" }}>Preparando...</p>
      ) : (
        /* Estado F: teaser — nenhum dado ainda, mostra o que está por vir */
        <>
          <p style={{ fontSize: 16, fontWeight: 600, color: TEXT_BODY_HEX, margin: 0, lineHeight: 1.45 }}>
            Pautas baseadas no que você cria.
          </p>
          <p style={{ fontSize: 14, color: TEXT_SECONDARY_HEX, margin: "6px 0 16px", lineHeight: 1.5 }}>
            Analise seus primeiros vídeos para a D2C gerar pautas a partir do seu mapa.
          </p>
          {onNewReading && (
            <button
              type="button"
              onClick={onNewReading}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                borderRadius: 999, padding: "10px 18px",
                background: "transparent", color: TEXT_PRIMARY_HEX,
                fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                border: `1.5px solid ${TEXT_PRIMARY_HEX}`, cursor: "pointer",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Primeira análise
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Top service buttons: Consultoria + Mídia Kit ─────────────────────────────

/** Compact horizontal quick-actions bar — replaces the large 2-column cards */
function QuickActionsBar({
  isPro,
  instagramConnected,
  onOpenMediaKit,
  onUpgrade,
  userImageUrl,
  userInitials,
  latestCalculation,
  onOpenCalculator,
}: {
  isPro: boolean;
  instagramConnected: boolean;
  onOpenMediaKit?: () => void;
  onUpgrade?: () => void;
  userImageUrl?: string | null;
  userInitials: string;
  latestCalculation?: any | null;
  onOpenCalculator?: () => void;
}) {
  // URLs de foto do Instagram expiram/bloqueiam (403) — quando a imagem falha,
  // cai para as iniciais em vez de mostrar o círculo preto do fundo.
  const [avatarFailed, setAvatarFailed] = useState(false);
  const showAvatar = Boolean(userImageUrl) && !avatarFailed;

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10,
    padding: "13px 14px",
    background: "transparent", border: "none",
    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
    width: "100%",
  };

  type CalculatorDisplay =
    | { type: "result"; primary: string; hint: string }
    | { type: "empty"; text: string };

  const buildCalculatorDisplay = (calculation: any | null | undefined): CalculatorDisplay => {
    if (!calculation?.params || typeof calculation.justo !== "number" || !Number.isFinite(calculation.justo) || calculation.justo <= 0) {
      return { type: "empty", text: "Defina seu valor por publicação" };
    }
    const params = calculation.params;
    const quantities = params.formatQuantities ?? {};
    const parts: string[] = [];
    if (Number(quantities.reels ?? 0) > 0) parts.push(`${Number(quantities.reels)} Reels`);
    if (Number(quantities.stories ?? 0) > 0) parts.push(`${Number(quantities.stories)} Stories`);
    if (Number(quantities.post ?? 0) > 0) parts.push(`${Number(quantities.post)} Post`);
    const deliverables = parts.length > 0 ? parts.join(" + ") : "seu combo";
    const priceFormatted = new Intl.NumberFormat("pt-BR", {
      style: "currency", currency: "BRL", maximumFractionDigits: 0,
    }).format(calculation.justo);
    const brandCtx =
      params.brandSize === "pequena" ? "marcas pequenas"
      : params.brandSize === "grande" ? "marcas grandes"
      : "marcas médias";
    return {
      type: "result",
      primary: priceFormatted,
      hint: `por ${deliverables} · ${brandCtx}`,
    };
  };

  const calculatorDisplay: CalculatorDisplay = (() => {
    if (!isPro) return { type: "empty", text: "Desbloqueie sua tabela de preços" };
    return buildCalculatorDisplay(latestCalculation);
  })();

  return (
    <div style={{ padding: "0 18px 14px" }}>
      {/* Card 1 — Mídia Kit */}
      <button
        type="button"
        onClick={onOpenMediaKit}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "13px 14px",
          width: "100%",
          background: "white", border: `1.5px solid ${TEXT_PRIMARY_HEX}`,
          borderRadius: 14, cursor: "pointer",
          fontFamily: "inherit", textAlign: "left",
          marginBottom: 12,
        }}
      >
        <div style={{
          width: 60, height: 60, borderRadius: 9999, flexShrink: 0,
          background: INK_DARK_HEX, color: "#fff",
          display: "grid", placeItems: "center",
          fontSize: 16, fontWeight: 700, letterSpacing: -0.2,
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(28,28,30,0.18)",
        }}>
          {showAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={userImageUrl!} alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            userInitials
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY_HEX, letterSpacing: -0.3 }}>
            Mídia Kit
          </span>
          <span style={{ display: "block", fontSize: 11, color: instagramConnected ? TEXT_PRIMARY_HEX : TEXT_SECONDARY_HEX, marginTop: 0 }}>
            {instagramConnected ? "Pronto para marcas" : "Conecte o Instagram"}
          </span>
        </div>
        <svg style={{ flexShrink: 0, color: TEXT_BODY_HEX }} width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Card 2 — Calculadora de Publi */}
      <button
        type="button"
        onClick={onOpenCalculator}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "13px 14px 14px",
          width: "100%",
          background: "white", border: `1.5px solid ${TEXT_PRIMARY_HEX}`,
          borderRadius: 14, cursor: "pointer",
          fontFamily: "inherit", textAlign: "left",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          {calculatorDisplay.type === "result" ? (
            <>
              <span style={{
                display: "block", fontSize: 22, fontWeight: 800,
                color: TEXT_PRIMARY_HEX, letterSpacing: -0.5, lineHeight: 1.1,
              }}>
                {calculatorDisplay.primary}
              </span>
              <span style={{
                display: "block", fontSize: 12, fontWeight: 500,
                color: TEXT_SECONDARY_HEX, letterSpacing: -0.1, lineHeight: 1.4,
                marginTop: 4,
              }}>
                {calculatorDisplay.hint}
              </span>
            </>
          ) : (
            <span style={{
              display: "block", fontSize: 13, fontWeight: 500,
              color: TEXT_SECONDARY_HEX, letterSpacing: -0.1, lineHeight: 1.4,
            }}>
              {calculatorDisplay.text}
            </span>
          )}
        </div>
        <svg style={{ flexShrink: 0, color: TEXT_PRIMARY_HEX }} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

// ─── Creator Stories Row — prova social estilo Instagram ─────────────────────

function CreatorStoriesRow({
  creators,
  collabSuggestedIds,
  onDiscoverCollabs,
  onOpenCreatorMediaKit,
}: {
  creators: import("@/types/landing").LandingCreatorHighlight[];
  collabSuggestedIds?: Set<string>;
  onDiscoverCollabs?: () => void;
  onOpenCreatorMediaKit?: (slug: string) => void;
}) {
  const sorted = [...creators]
    .filter((c) => c.hasAvatarImage === true && Boolean(c.avatarUrl))
    .sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0))
    .slice(0, 4);

  const handleAvatarClick = (slug: string | null | undefined) => {
    if (!slug) return;
    if (onOpenCreatorMediaKit) {
      onOpenCreatorMediaKit(slug);
    } else {
      window.location.href = `/mediakit/${encodeURIComponent(slug)}`;
    }
  };

  return (
    <div style={{
      display: "flex", gap: 0, paddingBottom: 4,
      paddingLeft: 16, paddingRight: 16,
      justifyContent: "space-between",
    }}>
      {sorted.map((creator) => {
        const isCollabSuggested = collabSuggestedIds?.has(creator.id) ?? false;
        return (
          <button
            key={creator.id}
            type="button"
            onClick={() => handleAvatarClick(creator.mediaKitSlug)}
            disabled={!creator.mediaKitSlug}
            style={{
              flexShrink: 0, display: "flex", flexDirection: "column",
              alignItems: "center", gap: 6,
              background: "none", border: "none",
              cursor: creator.mediaKitSlug ? "pointer" : "default",
              fontFamily: "inherit", padding: 0,
            }}
          >
            {/* Avatar sem ring, com badge de collab se aplicável */}
            <div style={{ position: "relative", width: 66, height: 66, flexShrink: 0 }}>
              <div style={{
                width: 66, height: 66, borderRadius: 9999,
                overflow: "hidden", background: SURFACE_NEUTRAL_HEX,
                border: "1.5px solid rgba(0,0,0,0.08)",
                display: "grid", placeItems: "center",
              }}>
                {creator.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={creator.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <span style={{ fontSize: 15, fontWeight: 800, color: TEXT_BODY_HEX, letterSpacing: -0.2 }}>
                    {collabInitials(creator.name)}
                  </span>
                )}
              </div>
              {/* Badge de collab sugerida */}
              {isCollabSuggested && (
                <div style={{
                  position: "absolute", bottom: 1, right: 1,
                  width: 18, height: 18, borderRadius: 9999,
                  background: "#0ea5e9",
                  border: "2px solid white",
                  display: "grid", placeItems: "center",
                }}>
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path d="M5 1l1.2 2.4L9 4l-2 1.95.47 2.75L5 7.4l-2.47 1.3L3 5.95 1 4l2.8-.6L5 1z" fill="white"/>
                  </svg>
                </div>
              )}
            </div>
            <span style={{
              fontSize: 11, fontWeight: 600, color: TEXT_BODY_HEX,
              maxWidth: 66, textAlign: "center",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {creator.name.split(" ")[0]}
            </span>
          </button>
        );
      })}

      {/* CTA — Descobrir criadores */}
      <button
        type="button"
        onClick={onDiscoverCollabs}
        style={{
          flexShrink: 0, display: "flex", flexDirection: "column",
          alignItems: "center", gap: 6,
          background: "none", border: "none", cursor: "pointer",
          fontFamily: "inherit", padding: 0,
        }}
      >
        <div style={{
          width: 66, height: 66, borderRadius: 9999,
          background: "white",
          display: "grid", placeItems: "center",
          border: `1.5px solid ${TEXT_PRIMARY_HEX}`,
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke={TEXT_PRIMARY_HEX} strokeWidth="1.8"/>
            <path d="M16.5 16.5L21 21" stroke={TEXT_PRIMARY_HEX} strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M11 8v6M8 11h6" stroke={TEXT_PRIMARY_HEX} strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, color: TEXT_BODY_HEX,
          maxWidth: 66, textAlign: "center",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          Descobrir
        </span>
      </button>
    </div>
  );
}

// ─── Collabs summary card — same outline language as Mídia Kit ───────────────

function CollabsSummaryCard({
  items,
  suggestionsStatus,
  directory,
  showUpgradeTeaser,
  onOpenAll,
  onOpenCommunity,
}: {
  items: DiagnosticoCollabSuggestionsState["items"];
  suggestionsStatus?: DiagnosticoCollabSuggestionsState["status"];
  directory?: DiagnosticoCreatorDirectoryState;
  showUpgradeTeaser: boolean;
  onOpenAll?: () => void;
  onOpenCommunity?: () => void;
}) {
  const topItems = items.slice(0, 5);
  const directoryCount = directory?.status === "ready" ? directory.creators.length : null;
  const avatarSlots = topItems.length > 0 ? topItems : [null, null, null];
  const placeholderBgs = ["#e0f2fe", "#ecfccb", "#fce7f3"];

  return (
    <div style={{ width: "100%" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 10,
      }}>
        <span style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY_HEX, letterSpacing: -0.2,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 9999, background: "#0ea5e9", display: "inline-block", flexShrink: 0 }} />
          Collabs Indicadas
        </span>
        <button
          type="button"
          onClick={onOpenAll}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY_HEX,
            fontFamily: "inherit", padding: 0, lineHeight: 1.2, whiteSpace: "nowrap",
          }}
        >
          Ver todos →
        </button>
      </div>

      {/* Horizontal shelf — avatares distribuídos na largura total */}
      <div style={{
        display: "flex",
        justifyContent: avatarSlots.length <= 3 ? "space-around" : "flex-start",
        gap: avatarSlots.length <= 3 ? 0 : 12,
        overflowX: avatarSlots.length > 3 ? "auto" : "visible",
        paddingBottom: 2,
        scrollbarWidth: "none",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        WebkitOverflowScrolling: "touch" as any,
      }}>
        {avatarSlots.map((creator, index) => {
          const bg = placeholderBgs[index % placeholderBgs.length] ?? SURFACE_NEUTRAL_HEX;
          const firstName = creator?.name?.split(" ")[0] ?? null;
          return (
            <button
              key={creator?.id ?? index}
              type="button"
              onClick={creator ? onOpenAll : onOpenCommunity}
              style={{
                flexShrink: 0, display: "flex", flexDirection: "column",
                alignItems: "center", gap: 6,
                background: "none", border: "none", cursor: "pointer",
                fontFamily: "inherit", padding: 0,
              }}
            >
              <div style={{
                width: 76, height: 76, borderRadius: 9999, overflow: "hidden",
                position: "relative", flexShrink: 0,
                background: creator ? bg : "linear-gradient(135deg, #f4f4f5 0%, #e4e4e7 100%)",
                display: "grid", placeItems: "center",
                boxShadow: creator
                  ? "0 1px 6px rgba(28,28,30,0.12)"
                  : "inset 0 0 0 1px rgba(28,28,30,0.06)",
              }}>
                {creator?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={creator.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : creator ? (
                  <span style={{ fontSize: 20, fontWeight: 800, color: TEXT_PRIMARY_HEX, letterSpacing: -0.3 }}>
                    {collabInitials(creator.name)}
                  </span>
                ) : (
                  <>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="8" r="4" stroke={TEXT_SECONDARY_HEX} strokeWidth="1.8" />
                      <path d="M4 20v-1a8 8 0 0 1 16 0v1" stroke={TEXT_SECONDARY_HEX} strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    {showUpgradeTeaser && index === 1 && (
                      <div style={{
                        position: "absolute", inset: 0, display: "grid", placeItems: "center",
                        background: "rgba(255,255,255,0.20)", backdropFilter: "blur(2px)",
                      }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: 9999,
                          background: "rgba(24,24,27,0.72)", color: "#fff",
                          display: "grid", placeItems: "center",
                        }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <rect x="4" y="11" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
                            <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, color: TEXT_BODY_HEX,
                maxWidth: 80, textAlign: "center",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {firstName ?? (directoryCount != null ? `${directoryCount}` : "···")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function collabInitials(value?: string | null) {
  const words = (value || "D2C").trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "D2C";
}

// ─── Contextual onboarding banner ─────────────────────────────────────────────

type OnboardingBannerState = "new_user" | "free_conversion" | "connect_instagram" | null;

function ContextualOnboardingBanner({
  state,
  readingCount,
  quotaLimit,
  onAction,
}: {
  state: OnboardingBannerState;
  readingCount: number;
  quotaLimit: number;
  onAction?: () => void;
}) {
  if (!state) return null;

  const configs: Record<Exclude<OnboardingBannerState, null>, {
    label: string; title: string; desc: string; cta: string; showCounter: boolean;
  }> = {
    new_user: {
      label: "1 ANÁLISE GRÁTIS",
      title: "Analise seu primeiro vídeo",
      desc: "A D2C analisa seu estilo e começa seu mapa.",
      cta: "Analisar meu primeiro vídeo",
      showCounter: false,
    },
    free_conversion: {
      label: "ANÁLISE PRONTA",
      title: "Continue com o Pro",
      desc: "Continue construindo seu mapa.",
      cta: "Continuar com Pro",
      showCounter: false,
    },
    connect_instagram: {
      label: "RECOMENDADO",
      title: "Conecte o Instagram",
      desc: "Calibra a leitura com sua grade.",
      cta: "Conectar",
      showCounter: true,
    },
  };

  const cfg = configs[state];

  return (
    <section style={{ padding: "10px 18px 0" }}>
      <button
        type="button"
        onClick={onAction}
        style={{
          width: "100%", textAlign: "left", cursor: "pointer",
          fontFamily: "inherit", padding: "15px 17px",
          borderRadius: 18, background: INK_DARK_HEX, color: "#fff",
          border: "none", boxShadow: "0 10px 28px -12px rgba(9,9,11,0.4)",
          display: "flex", alignItems: "center", gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: -0.3, lineHeight: 1.2 }}>
            {cfg.title}
          </p>
          <p style={{ fontSize: 12, lineHeight: 1.4, color: "rgba(255,255,255,0.6)", margin: "4px 0 0" }}>
            {cfg.desc}
          </p>
        </div>
        <span style={{
          fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0,
          background: "rgba(255,255,255,0.12)", borderRadius: 999, padding: "8px 14px",
        }}>
          {cfg.cta}
        </span>
      </button>
    </section>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  data: DiagnosticoPageData;
  collabSuggestions?: DiagnosticoCollabSuggestionsState;
  creatorDirectory?: DiagnosticoCreatorDirectoryState;
  onNewReading: () => void;
  onOpenReading: (diagnosisId: string) => void;
  onConnectInstagram?: () => void;
  onOpenCategory?: (id: CategoryId) => void;
  onOpenCommunity?: () => void;
  /** Abre o grupo do WhatsApp direto (Pro) ou o paywall (free). Usado no botão do header. */
  onOpenWhatsAppGroup?: () => void;
  onOpenMediaKit?: () => void;
  onOpenAccountMenu?: () => void;
  onOpenDiagnosis?: () => void;
  onUpgrade?: () => void;
  narrativeConfirmationState?: ConfirmationState;
  onConfirmNarrative?: (response: ConfirmationResponse) => void;
  territoriesConfirmationState?: ConfirmationState;
  onConfirmTerritories?: (response: ConfirmationResponse) => void;
  toneConfirmationState?: ConfirmationState;
  onConfirmTone?: (response: ConfirmationResponse) => void;
  onConfirmAsset?: (assetLabel: string, response: AssetConfirmationResponse) => void;
  assetConfirmations?: Map<string, "confirmed" | "dismissed">;
  /** True while the shell is auto-generating content ideas in the background. */
  isGeneratingIdeas?: boolean;
  /** Set when generation is blocked: premium wall, quota, incomplete map, or transient failure. */
  ideaGenerationBlocker?: "premium_required" | "quota_exceeded" | "map_incomplete" | "failed" | null;
  /** ISO date string for when the monthly quota resets (only present on quota_exceeded). */
  ideaQuotaResetAt?: string | null;
  /** Callback to retry generation (from MapaCard retry button). */
  onRetryGenerateIdeas?: () => void;
  /** Opens the single-idea detail sheet for the given idea ID. */
  onOpenIdea?: (ideaId: string) => void;
  /** Opens the WhatsApp connection flow so the creator can link their number and receive weekly pautas alerts. */
  onConnectWhatsApp?: () => void;
  /** Latest calculator result object from /api/calculator/latest. */
  latestCalculation?: any | null;
  /** Opens the calculator wizard modal. */
  onOpenCalculator?: () => void;
  /** Opens another creator's media kit inline (instead of a new tab). */
  onOpenCreatorMediaKit?: (slug: string) => void;
  /** Fase 2 — abre a pesquisa de perfil a partir do menu de configurações. */
  onOpenSurvey?: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DiagnosticoPage({
  data,
  collabSuggestions,
  creatorDirectory,
  onNewReading,
  onConnectInstagram,
  onOpenCategory,
  onOpenCommunity,
  onOpenWhatsAppGroup,
  onOpenMediaKit,
  onOpenAccountMenu,
  onOpenDiagnosis,
  onUpgrade,
  narrativeConfirmationState,
  onConfirmNarrative,
  territoriesConfirmationState,
  onConfirmTerritories,
  toneConfirmationState,
  onConfirmTone,
  onConfirmAsset,
  assetConfirmations,
  isGeneratingIdeas = false,
  ideaGenerationBlocker = null,
  ideaQuotaResetAt = null,
  onRetryGenerateIdeas,
  onOpenIdea,
  onConnectWhatsApp,
  latestCalculation,
  onOpenCalculator,
  onOpenCreatorMediaKit,
  onOpenSurvey,
}: Props) {
  const {
    synthesis: s,
    readings,
    profileSynthesisStatus,
    mapEvolutionStatus,
    accessState,
    instagramConnected,
    userInfo,
    brandMatches,
    readingQuota,
    streamBSignalsSummary,
    mapConfirmations,
    contentIdeas,
    contentIdeasReadiness,
    instagramMetrics,
  } = data;

  const displayStatus = mapEvolutionStatus ?? profileSynthesisStatus ?? "";
  const whatsappLinked = userInfo.whatsappLinked ?? false;

  const hasReadings = readings.length > 0;
  const hasSynthesis = s.status !== "empty" && s.analyzedReadingsCount > 0;
  const isMapReadyForExpansion =
    hasSynthesis &&
    mapConfirmations?.narrative === "confirmed" &&
    mapConfirmations?.territories === "confirmed";
  const isNewUser = !hasReadings && !hasSynthesis;
  const showFreeConversion = accessState === "free_preview_used" && !isNewUser;
  const isPro = userInfo.plan === "Pro";
  const readingCount = s.analyzedReadingsCount;
  const quotaLimit = readingQuota?.proMonthlyLimit ?? 10;
  const leadingNarrative = resolveDiagnosticoLeadingNarrativeSignal(s);

  const firstName = userInfo.name ? userInfo.name.trim().split(/\s+/)[0] : null;
  const greeting = firstName ? `Olá, ${firstName}` : "Bem-vindo";

  // Subtitle: situational map status anchors the creator on landing
  const evolutionLabel = mapEvolutionStatus ? (EVOLUTION_TITLE[mapEvolutionStatus] ?? null) : null;
  const headerSubtitle: string | null = null;

  function getInitials(name: string | null) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
    return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  function safeSubtitle(title: string | null, subtitle: string | null, fallback: string): string {
    if (!subtitle) return fallback;
    if (!title) return subtitle;
    const t = title.toLowerCase().trim();
    const sub = subtitle.toLowerCase().trim();
    if (sub === t || t.includes(sub.slice(0, Math.floor(sub.length * 0.7))) || sub.includes(t.slice(0, Math.floor(t.length * 0.7)))) {
      return fallback;
    }
    return subtitle;
  }

  function matchLevelLabel(level: string | undefined | null): string {
    switch (level) {
      case "alto":  return "Fit alto com sua narrativa";
      case "medio": return "Fit moderado com sua narrativa";
      case "baixo": return "Fit inicial detectado";
      default:      return "Match identificado";
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const postsSinceLastVisit = streamBSignalsSummary?.postsSinceLastVisit ?? 0;
  const newThemesSinceLastVisit = streamBSignalsSummary?.newThemesSinceLastVisit ?? 0;

  const confirmedMapDimensions = [
    mapConfirmations?.narrative === "confirmed" ? "Narrativa" : null,
    mapConfirmations?.territories === "confirmed" ? "Territórios" : null,
    mapConfirmations?.tone === "confirmed" ? "Tom" : null,
  ].filter(Boolean) as string[];

  // Marcas — three distinct states to avoid brand-name + "precisa de mais sinais" contradiction:
  // 1. Real brand match → show brand name + match level
  // 2. Commercial signal but no confirmed match → show territory signal + neutral copy
  // 3. Nothing → locked/awaiting copy
  const rawCommercialSignal = s.commercialTerritories[0] ?? s.commercialReasoning[0] ?? null;
  const commercialSignal = rawCommercialSignal
    ? refineDiagnosticoSignal(rawCommercialSignal, "commercial")
    : null;
  const hasBrandMatch = brandMatches.length > 0;
  const marcasTitle = hasBrandMatch
    ? brandMatches[0]?.brandName ?? null
    : commercialSignal?.label ?? null;
  const marcasSubtitle = hasBrandMatch
    ? matchLevelLabel(brandMatches[0]?.matchLevel)
    : commercialSignal != null
    ? "Território comercial em formação"
    : "Aguardando mais sinais do mapa";

  // Collabs
  const collabItems = collabSuggestions?.status === "ready" ? collabSuggestions.items : [];
  // Free-tier teaser: map is ready for expansion but API blocked by plan — show soft upgrade card.
  const showCollabUpgradeTeaser =
    collabSuggestions?.status === "upgrade_required" && isMapReadyForExpansion;

  // Raio X status
  const raioXStatus = EVOLUTION_TITLE[displayStatus] ?? "Sinais em formação";

  // Onboarding banner state
  const onboardingBannerState = ((): OnboardingBannerState => {
    if (showFreeConversion) return "free_conversion";
    // Usuário pós-onboarding que ainda não analisou nenhum vídeo: CTA dominante
    // "Analise seu primeiro vídeo" ancora a próxima ação na home.
    if (isNewUser) return "new_user";
    return null;
  })();

  const onboardingBannerAction = (() => {
    if (onboardingBannerState === "new_user") return onNewReading;
    if (onboardingBannerState === "free_conversion") return onUpgrade;
    if (onboardingBannerState === "connect_instagram") return onConnectInstagram;
    return undefined;
  })();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: SOLID_BG, minHeight: "100vh" }}>
      {/* ── HEADER — fundo unificado com a página ───────────────────────── */}
      <div style={{
        background: "linear-gradient(180deg, #fff8f5 0%, #ffffff 100%)",
        paddingTop: SAFE_TOP,
        paddingBottom: 12,
      }}>
        {/* Title row */}
        <div style={{ padding: "22px 20px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            {/* Greeting — hero da tela */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 style={{
                fontFamily: '"Poppins", -apple-system, "SF Pro Display", sans-serif',
                // clamp: mínimo 28px para nomes longos, ideal 10.7vw (~40px em 375px), máximo 40px
                fontSize: "clamp(28px, 10.7vw, 40px)",
                fontWeight: 700, color: INK_DARK_HEX, margin: 0,
                letterSpacing: -0.5, lineHeight: 1.1,
              }}>
                {greeting}
              </h1>
              {headerSubtitle && (
                <p style={{
                  fontSize: 14, color: TEXT_SECONDARY_HEX, margin: "4px 0 0",
                  fontWeight: 400, letterSpacing: -0.1, lineHeight: 1.3,
                }}>
                  {headerSubtitle}
                </p>
              )}
            </div>
            {/* Ações do header: configurações */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                {/* 44×44 tap area (iOS/Android HIG). Visual ink circle is 36px via inner span.
                    Transparent button shell + negative margin preserves header alignment. */}
                <button
                  type="button"
                  onClick={onOpenAccountMenu}
                  aria-label="Configurações"
                  style={{
                    width: 44, height: 44, borderRadius: 9999,
                    background: "transparent",
                    border: "none", cursor: "pointer", fontFamily: "inherit",
                    display: "grid", placeItems: "center",
                    marginRight: -4,
                    color: "#ffffff",
                  }}
                >
                  <span style={{
                    width: 36, height: 36, borderRadius: 9999,
                    background: TEXT_PRIMARY_HEX,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                    display: "grid", placeItems: "center",
                    flexShrink: 0,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                </button>
                {/* Badge — perfil do mapa incompleto */}
                {userInfo.mapProfileIncomplete && (
                  <div style={{
                    position: "absolute", top: -2, right: -2,
                    width: 10, height: 10, borderRadius: 9999,
                    background: "#f97316", border: "2px solid white",
                    pointerEvents: "none",
                  }} aria-hidden="true" />
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── SCROLLABLE CONTENT ───────────────────────────────────────────── */}
      <div>

        {/* ── Contextual onboarding banner — CTA dominante, primeiro no scroll ── */}
        <ContextualOnboardingBanner
          state={onboardingBannerState}
          readingCount={readingCount}
          quotaLimit={quotaLimit}
          onAction={onboardingBannerAction}
        />

        {/* ── Stories row ──────────────────────────────────────────────────── */}
        {creatorDirectory?.status === "ready" && creatorDirectory.creators.length > 0 && (
          <div style={{ paddingTop: 10, paddingBottom: 12 }}>
            <CreatorStoriesRow
              creators={creatorDirectory.creators}
              collabSuggestedIds={new Set(collabItems.map((i) => i.id))}
              onDiscoverCollabs={() => onOpenCategory?.("collabs")}
              onOpenCreatorMediaKit={onOpenCreatorMediaKit}
            />
          </div>
        )}

        {/* ── Quick actions: Consultoria + Mídia Kit (compact bar) ──────────── */}
        <QuickActionsBar
          isPro={isPro}
          instagramConnected={instagramConnected}
          onOpenMediaKit={onOpenMediaKit}
          onUpgrade={onUpgrade}
          userImageUrl={userInfo.imageUrl ?? null}
          userInitials={getInitials(userInfo.name ?? null)}
          latestCalculation={latestCalculation}
          onOpenCalculator={onOpenCalculator}
        />

        {/* ── Warnings ────────────────────────────────────────────────────── */}
        {hasSynthesis && s.warnings.length > 0 && (
          <div style={{ padding: "14px 18px 0" }}>
            <DiagnosticoWarningCard warnings={s.warnings} />
          </div>
        )}

        {/* ── Seu Mapa card ─────────────────────────────────────────────────── */}
        <div id="diagnostico-mapa" style={{ padding: "14px 18px 0", scrollMarginTop: 14 }}>
          <MapaCard
            synthesis={s}
            leadingNarrative={leadingNarrative}
            narrativeConfirmationState={narrativeConfirmationState}
            onConfirmNarrative={onConfirmNarrative}
            territoriesConfirmationState={territoriesConfirmationState}
            onConfirmTerritories={onConfirmTerritories}
            toneConfirmationState={toneConfirmationState}
            onConfirmTone={onConfirmTone}
            onConfirmAsset={onConfirmAsset}
            assetConfirmations={assetConfirmations}
            endorsedHypotheses={mapConfirmations?.endorsedHypotheses ?? []}
            adjacentNarrativesFromMap={mapConfirmations?.adjacentNarratives}
            hasReadings={hasReadings}
            onNewReading={onNewReading}
            onOpenNarrative={() => onOpenCategory?.("narrative")}
            mapEvolutionStatus={mapEvolutionStatus}
            lastReadingAt={readings[0]?.createdAt ?? null}
          />
        </div>

        {/* ── Pautas card ───────────────────────────────────────────────────── */}
        <div style={{ padding: "14px 18px 0" }}>
          <PautasCard
            contentIdeas={contentIdeas}
            contentIdeasReadiness={contentIdeasReadiness}
            isGeneratingIdeas={isGeneratingIdeas}
            ideaGenerationBlocker={ideaGenerationBlocker}
            ideaQuotaResetAt={ideaQuotaResetAt}
            onRetryGenerateIdeas={onRetryGenerateIdeas}
            onNewReading={onNewReading}
            onOpenIdea={onOpenIdea}
            whatsappLinked={whatsappLinked}
            onConnectWhatsApp={onConnectWhatsApp}
          />
        </div>

        {/* ── Sua Audiência card ───────────────────────────────────────────── */}
        {(!instagramConnected || data.audienceInsights) && (
          <div style={{ padding: "14px 18px 0" }}>
            {instagramConnected && data.audienceInsights ? (
              <AudienceInsightsCard
                insights={data.audienceInsights}
                instagramConnected={instagramConnected}
                onReviewTerritories={() =>
                  document.getElementById("diagnostico-mapa")?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              />
            ) : (
              <AudienceConnectPrompt onConnectInstagram={onConnectInstagram} />
            )}
          </div>
        )}

        {/* ── Expansão — só aparece quando há match real de marcas ────────── */}
        {isMapReadyForExpansion && hasBrandMatch && (
          <>
            <SectionTitle title="Expansão" />
            <div style={{ padding: "0 18px", display: "grid", gap: 16 }}>
              <CardShell variant="filled" bg="#ebe9fe" onClick={() => onOpenCategory?.("brands")}>
                <CardHeader cat="marcas" />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", marginTop: 14 }}>
                  <p style={{
                    fontSize: 16, fontWeight: 700, color: INK_DARK_HEX, margin: 0, letterSpacing: -0.35, lineHeight: 1.3,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    overflowWrap: "break-word",
                  }}>
                    {marcasTitle ?? "Oportunidades a revelar"}
                  </p>
                  <p style={{
                    fontSize: 13, color: TEXT_SECONDARY_HEX, margin: "5px 0 0", fontWeight: 400,
                    letterSpacing: -0.1, lineHeight: 1.35,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {marcasSubtitle}
                  </p>
                </div>
              </CardShell>
            </div>
            <div style={{ height: 28 }} />
          </>
        )}

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
