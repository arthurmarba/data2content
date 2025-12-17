export type FeedbackReasonCode =
  | "generic"
  | "wrong"
  | "didnt_use_context"
  | "hard_to_follow"
  | "too_long"
  | "too_short"
  | "slow"
  | "other";

export const FEEDBACK_REASONS: Array<{ code: FeedbackReasonCode; label: string; helper?: string }> = [
  { code: "generic", label: "Genérico" },
  { code: "wrong", label: "Parece errado" },
  { code: "didnt_use_context", label: "Ignorou meu contexto" },
  { code: "hard_to_follow", label: "Confuso/difícil" },
  { code: "too_long", label: "Muito longo" },
  { code: "too_short", label: "Raso/curto" },
  { code: "slow", label: "Demorou" },
  { code: "other", label: "Outro" },
];
