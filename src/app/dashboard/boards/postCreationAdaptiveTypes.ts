export type PostCreationAdaptiveMode =
  | "validate_pauta"
  | "discover_pauta"
  | "create_by_goal"
  | "format_guidance"
  | "brand_match"
  | "collab_match"
  | "comment_to_post"
  | "weekly_plan"
  | "unknown";

export type PostCreationAdaptiveStage = "intent" | "quiz" | "plan" | "legacy_handoff";

export type PostCreationAdaptiveQuestionType =
  | "strategic_choice"
  | "preference"
  | "constraint"
  | "confirmation";

export type PostCreationAdaptiveQuestionMapKey =
  | "who"
  | "what"
  | "where"
  | "when"
  | "why"
  | "how"
  | "how_much"
  | "hook"
  | "cta"
  | "format"
  | "narrative"
  | "objective"
  | "brand"
  | "collab"
  | "effort"
  | "schedule";

export type PostCreationAdaptiveIntentDetection = {
  mode: PostCreationAdaptiveMode;
  confidence: number;
  normalizedInput: string;
  originalInput: string;
  detectedPauta: string | null;
  objective: string | null;
  brandCategory: string | null;
  sourceComment: string | null;
  signals: string[];
  suggestedStage: PostCreationAdaptiveStage;
};

export type PostCreationAdaptiveQuestionOption = {
  id: string;
  label: string;
  reason?: string | null;
  description?: string | null;
  value?: string | null;
  recommended?: boolean;
};

export type PostCreationAdaptiveQuestion = {
  id: string;
  mapKey: PostCreationAdaptiveQuestionMapKey;
  type: PostCreationAdaptiveQuestionType;
  title: string;
  helper?: string | null;
  options: PostCreationAdaptiveQuestionOption[];
  required: boolean;
  multiSelect?: boolean;
  key?: PostCreationAdaptiveQuestionMapKey;
  prompt?: string;
  helperText?: string | null;
};

export type PostCreationAdaptiveAnswer = {
  questionId: string;
  key: PostCreationAdaptiveQuestionMapKey;
  value: string | string[] | boolean | null;
  optionId?: string | null;
  answeredAt?: string | null;
};

export type PostCreationFiveW2HPlan = {
  who: string | null;
  what: string | null;
  where: string | null;
  when: string | null;
  why: string | null;
  how: string | null;
  howMuch: string | null;
};

export type PostCreationAdaptiveScene = {
  id: string;
  title: string;
  visual: string;
  message: string;
  direction?: string | null;
};

export type PostCreationAdaptiveBrandMatchPlan = {
  enabled: boolean;
  category?: string | null;
  angle?: string | null;
  desiredBrandSignals?: string[];
};

export type PostCreationAdaptiveCollabMatchPlan = {
  enabled: boolean;
  creatorProfile?: string | null;
  collaborationAngle?: string | null;
};

export type PostCreationStrategicPlan = {
  pauta: string | null;
  objective: string | null;
  narrative: string | null;
  format: string | null;
  hook: string | null;
  cta: string | null;
  fiveW2H: PostCreationFiveW2HPlan;
  scenes: PostCreationAdaptiveScene[];
  brandMatch: PostCreationAdaptiveBrandMatchPlan | null;
  collabMatch: PostCreationAdaptiveCollabMatchPlan | null;
  nextActions: string[];
};

export type PostCreationAdaptiveState = {
  stage: PostCreationAdaptiveStage;
  mode: PostCreationAdaptiveMode;
  detection: PostCreationAdaptiveIntentDetection | null;
  originalInput: string;
  questions: PostCreationAdaptiveQuestion[];
  answers: PostCreationAdaptiveAnswer[];
  plan: PostCreationStrategicPlan | null;
  legacyHandoffReady: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};
