import { color, font, safeArea, shadow } from "@/design-system/tokens";

// ─── Semantic category color tokens ──────────────────────────────────────────
// Categories are distinguished primarily by icon and label. Color communicates
// state/meaning and intentionally stays within the creator-studio palette.
export const HC = {
  narrative:  { bg: "bg-[var(--ds-color-brand)]",   text: "text-[var(--ds-color-brand-strong)]", light: "bg-[var(--ds-color-brand-soft)]" },
  nextMove:   { bg: "bg-[var(--ds-color-success)]", text: "text-[var(--ds-color-success)]",      light: "bg-[var(--ds-color-success-soft)]" },
  tension:    { bg: "bg-[var(--ds-color-warning)]", text: "text-[var(--ds-color-warning)]",      light: "bg-[var(--ds-color-warning-soft)]" },
  warning:    { bg: "bg-[var(--ds-color-danger)]",  text: "text-[var(--ds-color-danger)]",       light: "bg-[var(--ds-color-danger-soft)]" },
  strength:   { bg: "bg-[var(--ds-color-brand)]",   text: "text-[var(--ds-color-brand-strong)]", light: "bg-[var(--ds-color-brand-soft)]" },
  territory:  { bg: "bg-[var(--ds-color-map)]",     text: "text-[var(--ds-color-map)]",          light: "bg-[var(--ds-color-warning-soft)]" },
  pattern:    { bg: "bg-[var(--ds-color-success)]", text: "text-[var(--ds-color-success)]",      light: "bg-[var(--ds-color-success-soft)]" },
  hypothesis: { bg: "bg-[var(--ds-color-map)]",     text: "text-[var(--ds-color-map)]",          light: "bg-[var(--ds-color-warning-soft)]" },
  reach:      { bg: "bg-[var(--ds-color-brand)]",   text: "text-[var(--ds-color-brand-strong)]", light: "bg-[var(--ds-color-brand-soft)]" },
  execution:  { bg: "bg-[var(--ds-color-ink)]",     text: "text-[var(--ds-color-ink)]",          light: "bg-[var(--ds-color-neutral)]" },
  reasoning:  { bg: "bg-[var(--ds-color-brand)]",   text: "text-[var(--ds-color-brand-strong)]", light: "bg-[var(--ds-color-brand-soft)]" },
  tactical:   { bg: "bg-[var(--ds-color-ink)]",     text: "text-[var(--ds-color-ink)]",          light: "bg-[var(--ds-color-neutral)]" },
} as const;

// ─── Reading contribution type → color token ─────────────────────────────────
export const HC_READING: Record<string, { bg: string; text: string }> = {
  confirms_existing_pattern: { bg: "bg-[var(--ds-color-brand)]",   text: "text-[var(--ds-color-brand-strong)]" },
  opens_new_hypothesis:      { bg: "bg-[var(--ds-color-map)]",     text: "text-[var(--ds-color-map)]" },
  isolated_strong_video:     { bg: "bg-[var(--ds-color-ink)]",     text: "text-[var(--ds-color-ink)]" },
  creative_deviation:        { bg: "bg-[var(--ds-color-warning)]", text: "text-[var(--ds-color-warning)]" },
  commercial_signal:         { bg: "bg-[var(--ds-color-success)]", text: "text-[var(--ds-color-success)]" },
  default:                   { bg: "bg-[var(--ds-color-text-muted)]", text: "text-[var(--ds-color-text-muted)]" },
};

// ─── Text color tokens (WCAG AA compliant on #F2F2F7 background) ─────────────
// All three pass 4.5:1 contrast ratio on the app shell background (#F2F2F7).
// Do NOT use TEXT_TERTIARY_HEX for body text smaller than 18px bold.
//
// Usage in inline styles: color: TEXT_SECONDARY_HEX
// Usage in Tailwind:      className="text-zinc-500"
export const TEXT_PRIMARY_HEX   = color.text;
export const TEXT_SECONDARY_HEX = color.textSecondary;
export const TEXT_TERTIARY_HEX  = color.textMuted;
export const TEXT_BODY_HEX      = color.textSecondary;

// ─── Ink & surface tokens (physical colors used across inline styles) ─────────
// One token = one physical color. Used as text, bg, border or stroke depending
// on context. Centralized here so a brand change touches a single line.
export const INK_DARK_HEX        = color.ink;
export const SURFACE_NEUTRAL_HEX = color.neutral;
export const ACCENT_ORANGE_HEX   = color.map;

// ─── Card de conteúdo (linguagem de "elevação") ────────────────────────────────
// Padrão dos cards de conteúdo do app (Seu Mapa, Sua Audiência, pautas): raio
// moderado + sombra suave com hairline embutido (o `0 0 0 0.5px` faz a borda
// fininha). SEM borda dura — a elevação é o único sinal de recorte.
export const CARD_RADIUS = 20;
export const CARD_SHADOW = shadow.raised;

// ─── Creator-studio (design system da landing — piloto na aba Collabs) ────────
// Espelha os tokens de `.d2c-human-landing` em globals.css (linhas ~1596-1633).
// As fontes dependem das CSS vars --font-d2c-* estarem escopadas no subtree
// (ver src/app/fonts/d2cFonts.ts / d2cFontVariables).
export const CS_BRAND_HEX        = color.brand;
export const CS_BRAND_STRONG_HEX = color.brandStrong;
export const CS_CORAL_HEX        = color.coral;
export const CS_MAP_ACCENT_HEX   = color.map;
export const CS_INK_HEX          = color.ink;
export const CS_PAPER_HEX        = color.paper;
export const CS_NEUTRAL_HEX      = color.neutral;
export const CS_MUTED            = color.textSecondary;
export const CS_LINE             = color.line;

export const CS_FONT_DISPLAY = font.display;
export const CS_FONT_SANS    = font.sans;
// Na landing o display roda a 680-720 com tracking -.055em em tamanhos de hero;
// em títulos de card (24-36px) o tracking precisa abrir um pouco.
export const CS_DISPLAY_WEIGHT        = 700;
export const CS_DISPLAY_TRACKING      = "-0.05em"; // headings grandes (h1 de aba)
export const CS_DISPLAY_TRACKING_CARD = "-0.03em"; // títulos de card

// ─── Safe-area ────────────────────────────────────────────────────────────────
// Respiro padrão abaixo do notch para headers de telas full-screen.
// DEVE casar com a utilitária CSS `.pt-safe-top` em globals.css.
export const SAFE_TOP = safeArea.top;

// Deprecated low-contrast values — replaced by TEXT_SECONDARY_HEX
// #a1a1aa → TEXT_TERTIARY_HEX (large text only) or TEXT_SECONDARY_HEX (body)
// #8e8e93 → TEXT_SECONDARY_HEX
// #71717a → TEXT_SECONDARY_HEX (fails on #F2F2F7 shell background)

// ─── Card anatomy ─────────────────────────────────────────────────────────────
export const CARD_P        = "p-5";
export const CARD_METRIC   = "text-[22px] font-bold tracking-tight text-zinc-950 leading-[1.15]";
export const CARD_BODY     = "text-[14px] leading-[1.5] text-zinc-600";
export const CARD_QUAL     = "text-[12px] font-semibold text-zinc-500";
export const CARD_BASE     = "w-full rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]";

// ─── Section header ───────────────────────────────────────────────────────────
export const SECTION_TITLE = "text-[17px] font-bold text-zinc-950";
export const SECTION_ACTION = "text-[14px] font-medium text-blue-500";

// ─── Backward-compat aliases (used by some older card imports) ────────────────
export const DIAG_CARD_CATEGORY  = "text-[12px] font-semibold tracking-tight";
export const DIAG_CARD_TIMESTAMP = "text-[12px] text-zinc-400";
export const DIAG_CARD_METRIC    = CARD_METRIC;
export const DIAG_CARD_QUALIFIER = CARD_QUAL;
export const DIAG_CARD_BODY      = CARD_BODY;
export const DIAG_CARD_BASE      = CARD_BASE;
export const DIAG_BADGE          =
  "inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500";
export const DIAG_SECTION_LABEL  = "text-[12px] font-semibold uppercase tracking-[1px] text-zinc-400";

// ─── Status evolution labels ──────────────────────────────────────────────────
export const DIAG_STATUS_STEP: Record<string, number> = {
  empty:                -1,
  first_reading:         1,
  signals_emerging:      2,
  pattern_in_formation:  3,
  profile_consistent:    5,
};

export const DIAG_STATUS_LABELS = [
  "1ª leitura",
  "Sinais",
  "Padrão",
  "Confirmação",
  "Consistente",
] as const;

export const DIAG_STATUS_EVOLUTION: Record<string, string> = {
  first_reading:        "Primeira análise feita",
  signals_emerging:     "Sinais surgindo",
  pattern_in_formation: "Padrão tomando forma",
  profile_consistent:   "Diagnóstico consistente",
};

// ─── Tone strip (kept for internal test reference) ────────────────────────────
export const DIAG_TONE_STRIP = {
  mirror:      "bg-stone-500",
  attention:   "bg-amber-600",
  action:      "bg-zinc-950",
  opportunity: "bg-emerald-600",
  neutral:     "bg-zinc-400",
} as const;

export const DIAG_TONE_BORDER = {
  mirror:      "border-l-stone-500",
  attention:   "border-l-amber-600",
  action:      "border-l-zinc-950",
  opportunity: "border-l-emerald-600",
  neutral:     "border-l-zinc-300",
} as const;

export type DiagTone = keyof typeof DIAG_TONE_STRIP;
