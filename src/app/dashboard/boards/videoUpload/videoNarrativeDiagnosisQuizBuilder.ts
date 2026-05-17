import type { VideoNarrativeAnalysis } from "./videoNarrativeAnalysisTypes";
import type { PostCreationVideoSeed } from "./videoNarrativePostCreationSeed";
import {
  sanitizeVideoNarrativeDiagnosisText,
  type VideoNarrativeDiagnosisAccessLevel,
  type VideoNarrativeDiagnosisCreatorSignal,
  type VideoNarrativeDiagnosisCreatorSignalType,
  type VideoNarrativeStrategicDiagnosis,
} from "./videoNarrativeDiagnosisLearningModel";

export type VideoNarrativeDiagnosisQuizQuestionType =
  | "single_choice"
  | "multi_choice"
  | "confirmation";

export type VideoNarrativeDiagnosisQuizQuestionKey =
  | "creator_objective"
  | "content_intent"
  | "hook_direction"
  | "commercial_intent"
  | "brand_integration_style"
  | "format_preference"
  | "narrative_preference"
  | "production_effort"
  | "collab_intent"
  | "audience_relationship"
  | "missing_context";

export interface VideoNarrativeDiagnosisQuizOption {
  id: string;
  label: string;
  description?: string | null;
  learningSignalType?: VideoNarrativeDiagnosisCreatorSignalType | null;
  learningSignalValue?: string | null;
  recommended?: boolean;
}

export interface VideoNarrativeDiagnosisQuizQuestion {
  id: string;
  key: VideoNarrativeDiagnosisQuizQuestionKey;
  type: VideoNarrativeDiagnosisQuizQuestionType;
  title: string;
  helper: string | null;
  options: VideoNarrativeDiagnosisQuizOption[];
  required: boolean;
  reason: string;
}

export interface VideoNarrativeDiagnosisQuizInput {
  analysis: VideoNarrativeAnalysis;
  seed: PostCreationVideoSeed;
  diagnosis: VideoNarrativeStrategicDiagnosis;
  creatorQuestion?: string | null;
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  existingSignals?: VideoNarrativeDiagnosisCreatorSignal[];
}

export interface VideoNarrativeDiagnosisQuizResult {
  questions: VideoNarrativeDiagnosisQuizQuestion[];
  reasons: string[];
  suggestedNextStep: "answer_quiz" | "build_diagnosis" | "upgrade_for_deeper_diagnosis";
}

export const VIDEO_NARRATIVE_DIAGNOSIS_QUIZ_MAX_QUESTIONS = 5;
export const VIDEO_NARRATIVE_DIAGNOSIS_QUIZ_MIN_QUESTIONS = 3;

const QUESTION_ORDER: VideoNarrativeDiagnosisQuizQuestionKey[] = [
  "missing_context",
  "creator_objective",
  "hook_direction",
  "commercial_intent",
  "brand_integration_style",
  "narrative_preference",
  "format_preference",
  "production_effort",
  "collab_intent",
  "audience_relationship",
  "content_intent",
];

const SIGNAL_PRIORITY_PENALTY: Partial<Record<VideoNarrativeDiagnosisQuizQuestionKey, VideoNarrativeDiagnosisCreatorSignalType>> = {
  creator_objective: "content_goal",
  hook_direction: "hook_preference",
  commercial_intent: "commercial_preference",
  format_preference: "format_preference",
};

const BLOCKED_TERMS = [
  "viralizar garantido",
  "treinado permanentemente",
  "resposta correta",
  "garantido",
  "certeza",
  "comprovado",
  "score",
  "nota",
  "pontuação",
  "acerto",
  "gabarito",
  "venceu",
  "perdeu",
];

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function normalize(value: string | null | undefined): string {
  return sanitizeVideoNarrativeDiagnosisQuizText(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasUsefulAnalysisOrSeed(input: VideoNarrativeDiagnosisQuizInput): boolean {
  return Boolean(
    hasText(input.analysis.summary) ||
      hasText(input.seed.detectedNarrative) ||
      hasText(input.diagnosis.mainNarrative) ||
      hasText(input.diagnosis.strategicReading) ||
      hasText(input.diagnosis.suggestedHook) ||
      hasText(input.diagnosis.blueprint.whatToPost),
  );
}

function creatorQuestionMentions(pattern: RegExp, input: VideoNarrativeDiagnosisQuizInput): boolean {
  return pattern.test(normalize(input.creatorQuestion ?? input.seed.creatorQuestion ?? ""));
}

function hasStrongExistingSignal(
  signals: VideoNarrativeDiagnosisCreatorSignal[] | undefined,
  type: VideoNarrativeDiagnosisCreatorSignalType,
): boolean {
  return (signals ?? []).some((signal) => signal.type === type && signal.confidence === "high");
}

function option(
  id: string,
  label: string,
  learningSignalType: VideoNarrativeDiagnosisCreatorSignalType,
  learningSignalValue: string,
  description?: string,
  recommended = false,
): VideoNarrativeDiagnosisQuizOption {
  return {
    id,
    label: sanitizeVideoNarrativeDiagnosisQuizText(label),
    description: description ? sanitizeVideoNarrativeDiagnosisQuizText(description) : null,
    learningSignalType,
    learningSignalValue: sanitizeVideoNarrativeDiagnosisQuizText(learningSignalValue),
    recommended,
  };
}

function buildQuestion(
  key: VideoNarrativeDiagnosisQuizQuestionKey,
  params: {
    title: string;
    helper?: string | null;
    reason: string;
    options: VideoNarrativeDiagnosisQuizOption[];
    type?: VideoNarrativeDiagnosisQuizQuestionType;
    required?: boolean;
  },
): VideoNarrativeDiagnosisQuizQuestion {
  return {
    id: `video-narrative-quiz-${key}`,
    key,
    type: params.type ?? "single_choice",
    title: sanitizeVideoNarrativeDiagnosisQuizText(params.title),
    helper: params.helper ? sanitizeVideoNarrativeDiagnosisQuizText(params.helper) : null,
    options: params.options,
    required: params.required ?? true,
    reason: sanitizeVideoNarrativeDiagnosisQuizText(params.reason),
  };
}

function getQuestionTemplate(key: VideoNarrativeDiagnosisQuizQuestionKey): VideoNarrativeDiagnosisQuizQuestion {
  switch (key) {
    case "creator_objective":
      return buildQuestion(key, {
        title: "Qual era sua intenção principal com esse vídeo?",
        helper: "Isso ajusta a leitura daquele vídeo e cria contexto para diagnósticos futuros.",
        reason: "A intenção do criador ainda precisa orientar o diagnóstico.",
        options: [
          option("identification", "Gerar identificação", "content_goal", "generate_identification", "Aproximar o conteúdo da experiência da audiência."),
          option("teach", "Ensinar algo", "content_goal", "teach_something"),
          option("attract_brands", "Atrair marcas", "content_goal", "attract_brands"),
          option("test_idea", "Testar uma ideia", "content_goal", "test_idea"),
          option("positioning", "Fortalecer posicionamento", "content_goal", "strengthen_positioning"),
        ],
      });
    case "content_intent":
      return buildQuestion(key, {
        title: "Que papel esse conteúdo deveria cumprir?",
        helper: "Ajuda a separar conteúdo de relacionamento, autoridade e conversão.",
        reason: "A leitura estratégica precisa de um papel de conteúdo mais claro.",
        options: [
          option("relationship", "Aproximar a audiência", "content_goal", "audience_relationship"),
          option("authority", "Construir autoridade", "positioning_signal", "authority_positioning"),
          option("conversion", "Preparar uma decisão", "content_goal", "prepare_decision"),
          option("discovery", "Atrair gente nova", "content_goal", "audience_discovery"),
        ],
      });
    case "hook_direction":
      return buildQuestion(key, {
        title: "Como você quer que a abertura desse vídeo funcione?",
        helper: "A resposta orienta o ajuste do gancho sem prometer performance.",
        reason: "O gancho precisa de direção para melhorar o diagnóstico do vídeo.",
        options: [
          option("direct", "Mais direta", "hook_preference", "direct_hook"),
          option("curious", "Mais curiosa", "hook_preference", "curiosity_hook"),
          option("emotional", "Mais emocional", "hook_preference", "emotional_hook"),
          option("commercial", "Mais comercial", "hook_preference", "commercial_hook"),
          option("suggestion", "Quero sugestão", "hook_preference", "needs_hook_suggestion", undefined, true),
        ],
      });
    case "commercial_intent":
      return buildQuestion(key, {
        title: "Esse vídeo foi pensado para alguma oportunidade comercial?",
        helper: "Isso ajuda a separar leitura orgânica de adaptação comercial.",
        reason: "Há sinais de potencial comercial ou interesse em marca.",
        options: [
          option("ad", "Sim, quero transformar em publi", "commercial_preference", "turn_into_ad"),
          option("potential", "Talvez, quero entender o potencial", "commercial_preference", "understand_brand_potential", undefined, true),
          option("organic", "Não, quero manter orgânico", "commercial_preference", "keep_organic"),
          option("future", "Quero atrair marcas no futuro", "commercial_preference", "attract_brands_later"),
        ],
      });
    case "brand_integration_style":
      return buildQuestion(key, {
        title: "Se virar publi, como a marca deveria aparecer?",
        helper: "A resposta ajuda a adaptar a narrativa sem forçar a entrega.",
        reason: "O diagnóstico encontrou caminhos possíveis de integração comercial.",
        options: [
          option("routine", "Como parte natural da rotina", "commercial_preference", "natural_routine_integration"),
          option("pain", "Como solução para uma dor", "commercial_preference", "pain_solution_integration"),
          option("support", "Como apoio ao conteúdo", "commercial_preference", "content_support_integration"),
          option("hero", "Como protagonista da entrega", "commercial_preference", "brand_as_main_delivery"),
        ],
      });
    case "format_preference":
      return buildQuestion(key, {
        title: "Qual formato você toparia produzir a partir dessa ideia?",
        helper: "Isso orienta blueprint e roteiro futuro.",
        reason: "O formato ainda precisa ser decidido para transformar a ideia em conteúdo.",
        options: [
          option("reels", "Reels direto", "format_preference", "direct_reels"),
          option("carousel", "Carrossel", "format_preference", "carousel"),
          option("stories", "Stories", "format_preference", "stories"),
          option("produced_script", "Roteiro mais produzido", "format_preference", "produced_script"),
        ],
      });
    case "narrative_preference":
      return buildQuestion(key, {
        title: "Qual caminho narrativo combina mais com você?",
        helper: "Ajuda a escolher a lente criativa do diagnóstico.",
        reason: "A narrativa principal ainda precisa de confirmação do criador.",
        options: [
          option("backstage", "Bastidor", "creative_preference", "backstage"),
          option("practical_tip", "Dica prática", "creative_preference", "practical_tip"),
          option("opinion", "Opinião", "creative_preference", "opinion"),
          option("humor", "Humor/identificação", "creative_preference", "humor_identification"),
          option("comparison", "Comparação", "creative_preference", "comparison"),
        ],
      });
    case "production_effort":
      return buildQuestion(key, {
        title: "Quanto esforço você quer colocar nesse conteúdo?",
        helper: "A resposta ajusta a complexidade do blueprint.",
        reason: "A execução sugerida precisa respeitar o esforço disponível.",
        options: [
          option("low", "Baixo, quero resolver rápido", "production_constraint", "low_effort"),
          option("medium", "Médio, posso caprichar um pouco", "production_constraint", "medium_effort"),
          option("high", "Alto, quero construir melhor", "production_constraint", "high_effort"),
          option("series", "Quero transformar em série", "production_constraint", "series_effort"),
        ],
      });
    case "collab_intent":
      return buildQuestion(key, {
        title: "Esse vídeo poderia crescer com outro criador?",
        helper: "Ajuda a entender se a narrativa pede contraste ou complemento.",
        reason: "A pergunta do criador sugere avaliar colaboração.",
        options: [
          option("complementary", "Sim, com alguém complementar", "collab_preference", "complementary_creator"),
          option("same_niche", "Sim, com alguém do mesmo nicho", "collab_preference", "same_niche_creator"),
          option("maybe", "Talvez, quero entender", "collab_preference", "understand_collab_fit"),
          option("solo", "Não, prefiro individual", "collab_preference", "solo_content"),
        ],
      });
    case "audience_relationship":
      return buildQuestion(key, {
        title: "Que tipo de resposta você quer provocar na audiência?",
        helper: "Isso melhora a leitura de relação com quem assiste.",
        reason: "Há espaço para definir melhor a relação desejada com a audiência.",
        options: [
          option("comments", "Comentarem experiências", "audience_relationship", "share_experiences"),
          option("save", "Salvarem para usar depois", "audience_relationship", "save_for_later"),
          option("share", "Compartilharem com alguém", "audience_relationship", "share_with_someone"),
          option("continue", "Pedirem uma continuação", "audience_relationship", "ask_for_follow_up"),
        ],
      });
    case "missing_context":
      return buildQuestion(key, {
        title: "Qual contexto falta para eu te orientar melhor?",
        helper: "Essa resposta completa a leitura quando o vídeo ainda tem pouco contexto.",
        reason: "O diagnóstico precisa de mais contexto antes de avançar.",
        options: [
          option("objective", "Ainda não sei o objetivo", "recurring_pain", "unclear_objective"),
          option("post", "Não sei se vale postar", "recurring_pain", "validate_before_posting"),
          option("opening", "Não sei como abrir o vídeo", "recurring_pain", "unclear_hook"),
          option("ad", "Não sei se isso vira publi", "recurring_pain", "unclear_commercial_fit"),
          option("narrative", "Não sei qual narrativa aparece", "creative_preference", "needs_narrative_clarity"),
        ],
      });
  }
}

function getCandidateQuestionKeys(input: VideoNarrativeDiagnosisQuizInput): VideoNarrativeDiagnosisQuizQuestionKey[] {
  const keys = new Set<VideoNarrativeDiagnosisQuizQuestionKey>();
  const hasWeakMainNarrative = !hasText(input.diagnosis.mainNarrative);
  const hasWeakIntent = !hasText(input.diagnosis.creatorIntent);
  const hasWeakHook = input.analysis.hook.strength === "weak" || !hasText(input.diagnosis.suggestedHook);
  const hasBrandIntent = input.diagnosis.brandPotential.enabled || creatorQuestionMentions(/(marca|publi|brand)/, input);
  const hasCollabIntent = creatorQuestionMentions(/(collab|colaboracao)/, input);
  const hasAudienceSignal = creatorQuestionMentions(/(audiencia|coment|identificacao|experiencia)/, input) ||
    input.analysis.d2cClassification.proposal === "comment_to_post" ||
    input.analysis.d2cClassification.proposal === "humor_scene";

  if (!hasUsefulAnalysisOrSeed(input)) keys.add("missing_context");
  if (hasWeakIntent) keys.add("creator_objective");
  if (hasWeakHook) keys.add("hook_direction");
  if (hasBrandIntent) {
    keys.add("commercial_intent");
    keys.add("brand_integration_style");
  }
  if (!hasText(input.seed.suggestedFormat)) keys.add("format_preference");
  if (hasWeakMainNarrative) keys.add("narrative_preference");
  if (input.diagnosis.blueprint.locked || input.diagnosis.scriptDirection.development.length > 0) {
    keys.add("production_effort");
  }
  if (hasCollabIntent) keys.add("collab_intent");
  if (hasAudienceSignal) keys.add("audience_relationship");

  QUESTION_ORDER.forEach((key) => keys.add(key));
  return Array.from(keys);
}

export function sanitizeVideoNarrativeDiagnosisQuizText(value: string): string {
  let sanitized = sanitizeVideoNarrativeDiagnosisText(value);
  sanitized = sanitized.replace(/\bAIza[0-9A-Za-z_-]{8,}/g, "[redigido]");
  sanitized = sanitized.replace(/\b(?:GEMINI_API_KEY|GOOGLE_GENAI_API_KEY)=\S+/g, "[redigido]");
  sanitized = sanitized.replace(/\b[A-Za-z0-9+/]{120,}={0,2}\b/g, "[redigido]");
  sanitized = sanitized.replace(/\bhttps?:\/\/\S*(?:\?|&)(?:token|signature|sig|X-Amz-Signature|Expires)=\S*/gi, "[redigido]");

  BLOCKED_TERMS.forEach((term) => {
    sanitized = sanitized.replace(new RegExp(term.replace(/\s+/g, "\\s+"), "gi"), "[redigido]");
  });

  return sanitized.trim();
}

export function getVideoNarrativeDiagnosisQuizQuestionPriority(input: {
  questionKey: VideoNarrativeDiagnosisQuizQuestionKey;
  analysis: VideoNarrativeAnalysis;
  seed: PostCreationVideoSeed;
  diagnosis: VideoNarrativeStrategicDiagnosis;
  creatorQuestion?: string | null;
  existingSignals?: VideoNarrativeDiagnosisCreatorSignal[];
}): number {
  const base = 100 - QUESTION_ORDER.indexOf(input.questionKey) * 10;
  let priority = base;

  if (input.questionKey === "missing_context" && !hasUsefulAnalysisOrSeed({
    analysis: input.analysis,
    seed: input.seed,
    diagnosis: input.diagnosis,
    creatorQuestion: input.creatorQuestion,
    accessLevel: input.diagnosis.accessLevel,
    existingSignals: input.existingSignals,
  })) priority += 100;
  if (input.questionKey === "creator_objective" && !hasText(input.diagnosis.creatorIntent)) priority += 80;
  if (input.questionKey === "hook_direction" && (input.analysis.hook.strength === "weak" || !hasText(input.diagnosis.suggestedHook))) priority += 70;
  if (input.questionKey === "commercial_intent" && (input.diagnosis.brandPotential.enabled || /(marca|publi|brand)/.test(normalize(input.creatorQuestion)))) priority += 60;
  if (input.questionKey === "brand_integration_style" && input.diagnosis.brandPotential.enabled) priority += 55;
  if (input.questionKey === "narrative_preference" && !hasText(input.diagnosis.mainNarrative)) priority += 50;
  if (input.questionKey === "format_preference" && !hasText(input.seed.suggestedFormat)) priority += 100;
  if (input.questionKey === "production_effort" && (input.diagnosis.blueprint.locked || input.diagnosis.scriptDirection.development.length > 0)) priority += 90;
  if (input.questionKey === "collab_intent" && /(collab|colaboracao)/.test(normalize(input.creatorQuestion))) priority += 130;
  if (input.questionKey === "audience_relationship" && /(audiencia|coment|identificacao|experiencia)/.test(normalize(input.creatorQuestion))) priority += 20;

  const signalType = SIGNAL_PRIORITY_PENALTY[input.questionKey];
  if (signalType && hasStrongExistingSignal(input.existingSignals, signalType)) priority -= 120;

  return priority;
}

export function dedupeVideoNarrativeDiagnosisQuizQuestions(
  questions: VideoNarrativeDiagnosisQuizQuestion[],
): VideoNarrativeDiagnosisQuizQuestion[] {
  const seen = new Set<VideoNarrativeDiagnosisQuizQuestionKey>();
  return questions.filter((question) => {
    if (seen.has(question.key)) return false;
    seen.add(question.key);
    return true;
  });
}

function getSuggestedNextStep(input: VideoNarrativeDiagnosisQuizInput): VideoNarrativeDiagnosisQuizResult["suggestedNextStep"] {
  const complete = Boolean(
    hasText(input.diagnosis.mainNarrative) &&
      hasText(input.diagnosis.creatorIntent) &&
      hasText(input.diagnosis.suggestedHook) &&
      !input.diagnosis.blueprint.locked,
  );
  const premiumLocks = input.diagnosis.lockedSections.filter((section) => section.reason === "requires_premium").length;
  const deeperLocks = input.diagnosis.lockedSections.filter((section) =>
    section.reason === "requires_premium" || section.reason === "requires_instagram_connection",
  ).length;

  if (input.accessLevel === "free" && premiumLocks > 0 && deeperLocks >= 3) {
    return "upgrade_for_deeper_diagnosis";
  }

  return complete ? "build_diagnosis" : "answer_quiz";
}

export function buildVideoNarrativeDiagnosisQuiz(
  input: VideoNarrativeDiagnosisQuizInput,
): VideoNarrativeDiagnosisQuizResult {
  const candidates = getCandidateQuestionKeys(input)
    .map((key) => ({
      key,
      priority: getVideoNarrativeDiagnosisQuizQuestionPriority({
        questionKey: key,
        analysis: input.analysis,
        seed: input.seed,
        diagnosis: input.diagnosis,
        creatorQuestion: input.creatorQuestion,
        existingSignals: input.existingSignals,
      }),
    }))
    .sort((left, right) => right.priority - left.priority || QUESTION_ORDER.indexOf(left.key) - QUESTION_ORDER.indexOf(right.key));

  const selected = dedupeVideoNarrativeDiagnosisQuizQuestions(
    candidates
      .slice(0, VIDEO_NARRATIVE_DIAGNOSIS_QUIZ_MAX_QUESTIONS)
      .map((candidate) => getQuestionTemplate(candidate.key)),
  );

  while (selected.length < VIDEO_NARRATIVE_DIAGNOSIS_QUIZ_MIN_QUESTIONS) {
    const fallbackKey = QUESTION_ORDER.find((key) => !selected.some((question) => question.key === key));
    if (!fallbackKey) break;
    selected.push(getQuestionTemplate(fallbackKey));
  }

  return {
    questions: selected.slice(0, VIDEO_NARRATIVE_DIAGNOSIS_QUIZ_MAX_QUESTIONS),
    reasons: selected.map((question) => question.reason),
    suggestedNextStep: getSuggestedNextStep(input),
  };
}
