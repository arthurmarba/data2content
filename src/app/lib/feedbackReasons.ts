export const FEEDBACK_REASON_CODES = [
  "generic",
  "generic_script",
  "prompt_echo",
  "not_actionable",
  "bad_language",
  "wrong_objective",
  "wrong",
  "didnt_use_context",
  "confusing",
  "too_long",
  "too_short",
  "slow",
  "other",
  // Alias legado para compatibilidade; não usar em novas UIs.
  "hard_to_follow",
] as const;

export type FeedbackReasonCodeShared = (typeof FEEDBACK_REASON_CODES)[number];
