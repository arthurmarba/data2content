export const color = {
  brand: "var(--ds-color-brand)",
  brandStrong: "var(--ds-color-brand-strong)",
  brandSoft: "var(--ds-color-brand-soft)",
  coral: "var(--ds-color-coral)",
  map: "var(--ds-color-map)",
  ink: "var(--ds-color-ink)",
  onBrand: "var(--ds-color-on-brand)",
  paper: "var(--ds-color-paper)",
  surface: "var(--ds-color-surface)",
  neutral: "var(--ds-color-neutral)",
  text: "var(--ds-color-text)",
  textSecondary: "var(--ds-color-text-secondary)",
  textMuted: "var(--ds-color-text-muted)",
  line: "var(--ds-color-line)",
  lineStrong: "var(--ds-color-line-strong)",
  scrim: "var(--ds-color-scrim)",
  success: "var(--ds-color-success)",
  successSoft: "var(--ds-color-success-soft)",
  warning: "var(--ds-color-warning)",
  warningSoft: "var(--ds-color-warning-soft)",
  danger: "var(--ds-color-danger)",
  dangerSoft: "var(--ds-color-danger-soft)",
} as const;

export const rawColor = {
  brand: "#fa165b",
  brandStrong: "#d80d48",
  brandSoft: "#ffe7ef",
  coral: "#ff4e58",
  map: "#ff8438",
  ink: "#121014",
  paper: "#fff9f5",
  surface: "#fffdfa",
  neutral: "#f5f0eb",
} as const;

export const font = {
  display: "var(--ds-font-display)",
  sans: "var(--ds-font-sans)",
} as const;

export const radius = {
  sm: "var(--ds-radius-sm)",
  md: "var(--ds-radius-md)",
  lg: "var(--ds-radius-lg)",
  xl: "var(--ds-radius-xl)",
  pill: "var(--ds-radius-pill)",
} as const;

export const shadow = {
  raised: "var(--ds-shadow-raised)",
  floating: "var(--ds-shadow-floating)",
  overlay: "var(--ds-shadow-overlay)",
} as const;

export const safeArea = {
  top: "var(--ds-safe-top)",
  bottom: "var(--ds-safe-bottom)",
  tabBarHeight: "var(--ds-tab-bar-height)",
} as const;

export type DesignSystemColor = keyof typeof color;
