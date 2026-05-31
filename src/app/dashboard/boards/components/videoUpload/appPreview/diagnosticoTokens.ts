// ─── Apple Health category color tokens ──────────────────────────────────────
// Each category has: icon bubble bg, text color, and light background for overlays
export const HC = {
  narrative:  { bg: "bg-orange-500",  text: "text-orange-500",  light: "bg-orange-50"  },
  nextMove:   { bg: "bg-emerald-500", text: "text-emerald-500", light: "bg-emerald-50" },
  tension:    { bg: "bg-amber-500",   text: "text-amber-500",   light: "bg-amber-50"   },
  warning:    { bg: "bg-red-500",     text: "text-red-500",     light: "bg-red-50"     },
  strength:   { bg: "bg-blue-500",    text: "text-blue-500",    light: "bg-blue-50"    },
  territory:  { bg: "bg-purple-500",  text: "text-purple-500",  light: "bg-purple-50"  },
  pattern:    { bg: "bg-teal-500",    text: "text-teal-500",    light: "bg-teal-50"    },
  hypothesis: { bg: "bg-indigo-500",  text: "text-indigo-500",  light: "bg-indigo-50"  },
  reach:      { bg: "bg-sky-500",     text: "text-sky-500",     light: "bg-sky-50"     },
  execution:  { bg: "bg-fuchsia-500", text: "text-fuchsia-500", light: "bg-fuchsia-50" },
  reasoning:  { bg: "bg-rose-500",    text: "text-rose-500",    light: "bg-rose-50"    },
  tactical:   { bg: "bg-cyan-500",    text: "text-cyan-500",    light: "bg-cyan-50"    },
} as const;

// ─── Reading contribution type → color token ─────────────────────────────────
export const HC_READING: Record<string, { bg: string; text: string }> = {
  confirms_existing_pattern: { bg: "bg-orange-500",  text: "text-orange-500"  },
  opens_new_hypothesis:      { bg: "bg-indigo-500",  text: "text-indigo-500"  },
  isolated_strong_video:     { bg: "bg-zinc-700",    text: "text-zinc-700"    },
  creative_deviation:        { bg: "bg-amber-500",   text: "text-amber-500"   },
  commercial_signal:         { bg: "bg-purple-500",  text: "text-purple-500"  },
  default:                   { bg: "bg-zinc-400",    text: "text-zinc-400"    },
};

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
