import { FEEDBACK_REASON_CODES, type FeedbackReasonCodeShared } from "@/app/lib/feedbackReasons";

export type FeedbackReasonCode = FeedbackReasonCodeShared;

export const FEEDBACK_REASONS: Array<{ code: FeedbackReasonCode; label: string; helper?: string }> =
  FEEDBACK_REASON_CODES.filter((c) => c !== "hard_to_follow").map((code) => {
    const labels: Record<FeedbackReasonCode, string> = {
      generic: "Genérico",
      wrong: "Parece errado",
      didnt_use_context: "Ignorou meu contexto",
      confusing: "Confuso/difícil",
      too_long: "Muito longo",
      too_short: "Raso/curto",
      slow: "Demorou",
      other: "Outro",
      hard_to_follow: "Confuso/difícil",
    };
    return { code, label: labels[code] };
  });
