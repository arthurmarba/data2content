"use client";

import {
  TEXT_PRIMARY_HEX,
  TEXT_SECONDARY_HEX,
  TEXT_BODY_HEX,
  ACCENT_ORANGE_HEX,
} from "./diagnosticoTokens";

// ─── Warm palette — keeps the confirmation row native to the (cream) Mapa card ─
// The widget used to drop a cold gray box (#f8f8f8 + zinc buttons) into a warm
// card. These tints derive from the brand orange so calibration reads calm and
// card-native, not like a survey form.
const WARM_SURFACE = "#fff3ea";              // box background — soft cream tint
const WARM_BORDER  = "rgba(255,107,53,0.16)"; // box border
const WARM_OUTLINE = "rgba(255,107,53,0.28)"; // secondary/tertiary button border

/**
 * MapaConfirmationRow — unified confirmation widget for the Mapa card.
 *
 * Three visual variants, all matching the "Apple Health card" language:
 *
 *  "3way"       → [Sim] [Quase] [Não é isso]
 *                 Used for narrative + territories inline confirmation.
 *
 *  "3way-asset" → [Sim] [Às vezes] [Não]
 *                 Used for life-asset confirmation (e.g. "Viagens faz parte da sua vida?").
 *
 *  "2way"       → [<primaryLabel>] [<tertiaryLabel>]
 *                 Used for hypothesis endorsement (e.g. "Faz sentido" / "Pular").
 *
 * All touch targets are ≥ 44 px tall (minHeight: 44) per iOS/Android HIG.
 */

export type ConfirmationVariant = "3way" | "3way-asset" | "2way";

export interface MapaConfirmationRowProps {
  variant: ConfirmationVariant;

  /** Short question rendered above the buttons (3way). */
  question?: string;

  /**
   * Small category/topic label rendered above `title`
   * (3way-asset, 2way). E.g. "Faz parte da sua vida?" or "Isso ressoa com você?"
   */
  label?: string;
  labelColor?: string;

  /**
   * Bold dimension label below `label` (3way-asset, 2way).
   * E.g. "Viagens", "Tecnologia de produtividade"
   */
  title?: string;

  /** Disable all buttons (e.g. while saving). */
  disabled?: boolean;

  // ── Callbacks ────────────────────────────────────────────────────────────
  onPrimary: () => void;   // Sim | custom primaryLabel
  onSecondary?: () => void; // Quase | Às vezes (not used in 2way)
  onTertiary?: () => void;  // Não é isso | Não | Pular

  // ── Label overrides (2way lets you customise both buttons) ───────────────
  primaryLabel?: string;
  primaryColor?: string;   // button bg colour, defaults per variant
  tertiaryLabel?: string;
}

// ─── Style constants ─────────────────────────────────────────────────────────

const BTN_BASE: React.CSSProperties = {
  borderRadius: 999,
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
  fontWeight: 600,
  lineHeight: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44, // iOS HIG touch target
  padding: "0 16px",
};

// ─── Component ───────────────────────────────────────────────────────────────

export function MapaConfirmationRow({
  variant,
  question,
  label,
  labelColor = TEXT_SECONDARY_HEX,
  title,
  disabled = false,
  onPrimary,
  onSecondary,
  onTertiary,
  primaryLabel,
  primaryColor,
  tertiaryLabel,
}: MapaConfirmationRowProps) {

  const opacity = disabled ? 0.5 : 1;

  // ── Derive labels per variant ─────────────────────────────────────────────
  const labels = {
    "3way":       { p: "Sim",         s: "Quase",    t: "Não é isso" },
    "3way-asset": { p: "Sim",         s: "Às vezes", t: "Não"        },
    "2way":       { p: "Faz sentido", s: null,       t: "Pular"      },
  }[variant];

  const resolvedPrimary  = primaryLabel  ?? labels.p;
  const resolvedSecond   = labels.s;
  const resolvedTertiary = tertiaryLabel ?? labels.t;

  // ── Primary button colour ─────────────────────────────────────────────────
  // Every "primary" is the brand orange — matches the card's chips/accents and
  // gives a single, consistent affirmative across all variants.
  const resolvedPrimaryBg = primaryColor ?? ACCENT_ORANGE_HEX;

  // ── Font size: 3way uses 13px, asset/2way use 12px ───────────────────────
  const fontSize = variant === "3way" ? 13 : 12;

  return (
    <div
      style={{
        marginTop: 10,
        padding: "12px 14px",
        borderRadius: 14,
        background: WARM_SURFACE,
        border: `1px solid ${WARM_BORDER}`,
      }}
    >
      {/* ── Label (optional small category line) ────────────────────── */}
      {label && (
        <p
          style={{
            fontSize: 11,
            color: labelColor,
            margin: "0 0 3px",
            letterSpacing: 0.1,
            fontWeight: 500,
          }}
        >
          {label}
        </p>
      )}

      {/* ── Question / Title ─────────────────────────────────────────── */}
      {(question || title) && (
        <p
          style={{
            fontSize: title ? 13 : 13,
            fontWeight: title ? 600 : 500,
            color: TEXT_PRIMARY_HEX,
            margin: "0 0 10px",
            lineHeight: 1.4,
          }}
        >
          {question ?? title}
        </p>
      )}

      {/* ── Button row ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 6 }}>
        {/* Primary — Sim / Faz sentido */}
        <button
          type="button"
          disabled={disabled}
          onClick={onPrimary}
          style={{
            ...BTN_BASE,
            flex: variant === "3way" ? 1 : undefined,
            background: resolvedPrimaryBg,
            color: "#fff",
            fontSize,
            fontWeight: 700,
            opacity,
          }}
        >
          {resolvedPrimary}
        </button>

        {/* Secondary — Quase / Às vezes (not in 2way) */}
        {/* Warm outline, shared with tertiary — one calm family, no gray fills. */}
        {resolvedSecond && onSecondary && (
          <button
            type="button"
            disabled={disabled}
            onClick={onSecondary}
            style={{
              ...BTN_BASE,
              flex: variant === "3way" ? 1 : undefined,
              background: "#fff",
              color: TEXT_BODY_HEX,
              fontSize,
              border: `1px solid ${WARM_OUTLINE}`,
              opacity,
            }}
          >
            {resolvedSecond}
          </button>
        )}

        {/* Tertiary — Não é isso / Não / Pular */}
        {/* Same warm outline as secondary; only the text is more muted. */}
        {resolvedTertiary && onTertiary && (
          <button
            type="button"
            disabled={disabled}
            onClick={onTertiary}
            style={{
              ...BTN_BASE,
              flex: variant === "3way" ? 1 : undefined,
              background: "#fff",
              color: TEXT_SECONDARY_HEX,
              fontSize,
              border: `1px solid ${WARM_OUTLINE}`,
              opacity,
            }}
          >
            {resolvedTertiary}
          </button>
        )}
      </div>
    </div>
  );
}
