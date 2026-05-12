import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveMode,
  PostCreationAdaptiveQuestion,
  PostCreationAdaptiveQuestionMapKey,
  PostCreationAdaptiveQuestionOption,
  PostCreationStrategicPlan,
} from "./postCreationAdaptiveTypes";
import type {
  PostCreationBlueprint,
  PostCreationDecisionState,
  PostCreationIdeaVariant,
} from "./postCreationFunnel";
import type {
  PostCreationAdaptiveStudyContext,
  PostCreationAdaptiveStudyReferencePost,
  PostCreationAdaptiveStudySignal,
  PostCreationAdaptiveStudyWindowSignal,
} from "./postCreationAdaptiveStudyContext";
import {
  buildPostCreationAdaptiveGameContract,
  type PostCreationAdaptiveGameQuestionContract,
} from "./postCreationAdaptiveGameContract";
import { buildPostCreationLegacyHandoff } from "./postCreationAdaptiveLegacyAdapter";
import { buildPostCreationStrategicPlan } from "./postCreationAdaptivePlanBuilder";

export type PostCreationAdaptiveAnswerFeedback = {
  correct: string;
  incorrect: string;
  rationale: string;
  evidence?: string[];
};

export type PostCreationAdaptiveQuestionAnswerKey = {
  questionId: string;
  mapKey: PostCreationAdaptiveQuestionMapKey;
  correctOptionId: string;
  feedback: PostCreationAdaptiveAnswerFeedback;
};

export type PostCreationAdaptiveAnswerEvaluation = {
  questionId: string;
  selectedOptionId: string | null;
  correctOptionId: string | null;
  isCorrect: boolean;
  feedbackTitle: string;
  feedbackMessage: string;
  rationale: string;
  evidence: string[];
  mapKey?: PostCreationAdaptiveQuestionMapKey | null;
  questionTitle?: string | null;
  selectedOptionLabel?: string | null;
  selectedOptionReason?: string | null;
  correctOptionLabel?: string | null;
  correctOptionReason?: string | null;
  correctReason?: string | null;
};

export type PostCreationAdaptiveScore = {
  total: number;
  correct: number;
  percentage: number;
  label: string;
  summary: string;
};

export type PostCreationAdaptiveLegacyHandoff = {
  decision: PostCreationDecisionState;
  idea: PostCreationIdeaVariant;
  blueprint: PostCreationBlueprint;
};

export type PostCreationAdaptiveAnswerKey = {
  mode: PostCreationAdaptiveMode;
  questionKeys: PostCreationAdaptiveQuestionAnswerKey[];
  correctAnswersByQuestionId: Record<string, string>;
  idealAnswers: PostCreationAdaptiveAnswer[];
  idealPlan: PostCreationStrategicPlan;
  legacyHandoff: PostCreationAdaptiveLegacyHandoff;
  gameQuestions: PostCreationAdaptiveGameQuestionContract[];
  score: {
    max: number;
    passing: number;
  };
};

const RATIONALE_BY_MAP_KEY: Partial<Record<PostCreationAdaptiveQuestionMapKey, string>> = {
  objective: "O objetivo define o comportamento que o conteúdo precisa provocar.",
  format: "O formato precisa combinar com a força principal da ideia.",
  hook: "O gancho decide se a pessoa entende a tensão nos primeiros segundos.",
  cta: "O CTA precisa continuar a conversa depois do conteúdo.",
  brand: "A marca funciona melhor quando entra como parte natural da narrativa.",
  collab: "A collab precisa adicionar contraste, repertório ou público novo.",
  why: "O motivo estratégico sustenta a recomendação final.",
  narrative: "A narrativa organiza a tensão principal em uma história fácil de acompanhar.",
  how: "A execução precisa deixar a ideia clara sem explicar demais.",
  who: "A pessoa certa na cena muda a força da recomendação.",
  effort: "O esforço precisa caber na execução real da pauta.",
  schedule: "A cadência precisa ser sustentável para manter consistência.",
};

const KNOWN_MAP_KEYS = new Set<string>([
  "who",
  "what",
  "where",
  "when",
  "why",
  "how",
  "how_much",
  "hook",
  "cta",
  "format",
  "narrative",
  "objective",
  "brand",
  "collab",
  "effort",
  "schedule",
]);

type ResolvedCorrectOption = {
  option: PostCreationAdaptiveQuestionOption;
  studyContextMatch: StudyContextMatch | null;
};

type StudyContextMatch = {
  evidence: string[];
  rationale: string;
};

type QualitativeSignalMatch = {
  option: PostCreationAdaptiveQuestionOption;
  signal: PostCreationAdaptiveStudySignal;
  evidencePrefix: string;
  rationale: string;
};

function cleanText(value?: string | null): string | null {
  const trimmed = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return trimmed || null;
}

function normalizeText(value?: string | null): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildDetectionCorpus(detection: PostCreationAdaptiveIntentDetection): string {
  return [
    detection.normalizedInput,
    detection.originalInput,
    detection.detectedPauta,
    detection.objective,
    detection.brandCategory,
    detection.sourceComment,
    ...detection.signals,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(" ");
}

function getOptionCorpus(option: PostCreationAdaptiveQuestionOption): string {
  return normalizeText([option.id, option.label, option.reason, option.description, option.value].filter(Boolean).join(" "));
}

function textMatches(left: string, right: string): boolean {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return normalizedLeft === normalizedRight
    || normalizedLeft.includes(normalizedRight)
    || normalizedRight.includes(normalizedLeft);
}

function optionMatchesSignal(
  option: PostCreationAdaptiveQuestionOption,
  signal: Pick<PostCreationAdaptiveStudySignal, "id" | "label">,
): boolean {
  const optionCorpus = getOptionCorpus(option);
  return [signal.id, signal.label].some((value) => textMatches(optionCorpus, value));
}

function findFirstOptionByTerms(
  options: PostCreationAdaptiveQuestionOption[],
  terms: string[],
): PostCreationAdaptiveQuestionOption | null {
  const normalizedTerms = terms.map(normalizeText).filter(Boolean);
  if (!normalizedTerms.length) return null;

  return options.find((option) => {
    const corpus = getOptionCorpus(option);
    return normalizedTerms.some((term) => corpus.includes(term));
  }) || null;
}

function findOptionByStudySignals(
  options: PostCreationAdaptiveQuestionOption[],
  signals: PostCreationAdaptiveStudySignal[],
): { option: PostCreationAdaptiveQuestionOption; signal: PostCreationAdaptiveStudySignal } | null {
  for (const signal of signals) {
    const option = options.find((candidate) => optionMatchesSignal(candidate, signal));
    if (option) return { option, signal };
  }
  return null;
}

const CONTROLLED_SIGNAL_GROUPS = {
  question: {
    signalTerms: ["pergunta", "voce ja", "ninguem fala", "me conta", "comenta", "comentario", "conversa", "responder"],
    optionTerms: ["pergunta", "responder", "comentario", "comentarios", "conversa"],
  },
  save: {
    signalTerms: ["salvar", "salvamento", "consulta", "checklist", "passo", "passo a passo", "tutorial", "lista", "guardar"],
    optionTerms: ["salvar", "salvamento", "guardar", "consulta", "checklist", "passo", "tutorial", "lista", "educ"],
  },
  share: {
    signalTerms: ["compartilhar", "compartilhamento", "enviar", "manda", "viral", "alcance"],
    optionTerms: ["compartilhar", "compartilhamento", "enviar", "viral", "alcance"],
  },
  reelsVideo: {
    signalTerms: ["reels", "video", "cena", "movimento", "reacao", "rotina real", "pov"],
    optionTerms: ["reels", "video", "cena", "movimento", "reacao", "pov"],
  },
  carousel: {
    signalTerms: ["carrossel", "carousel", "passo", "passo a passo", "lista", "checklist", "organizado", "consulta", "tutorial"],
    optionTerms: ["carrossel", "carousel", "passo", "lista", "organizado", "consulta", "checklist", "salvar", "tutorial"],
  },
  stories: {
    signalTerms: ["stories", "story", "bastidor", "conversa", "teste", "enquete"],
    optionTerms: ["stories", "story", "bastidor", "conversa", "teste", "enquete"],
  },
  commercial: {
    signalTerms: ["marca", "publi", "comercial", "produto", "uso real", "rotina", "venda"],
    optionTerms: ["marca", "publi", "comercial", "produto", "uso real", "rotina", "venda"],
  },
  collab: {
    signalTerms: ["collab", "colab", "parceria", "creator", "dupla", "debate", "reacao", "conversa"],
    optionTerms: ["collab", "colab", "parceria", "creator", "dupla", "debate", "reacao", "conversa"],
  },
  proof: {
    signalTerms: ["prova", "antes e depois", "resultado", "comparacao", "uso real", "cena real"],
    optionTerms: ["prova", "antes", "depois", "resultado", "comparacao", "uso real", "cena real"],
  },
};

type ControlledSignalGroupName = keyof typeof CONTROLLED_SIGNAL_GROUPS;

function textHasAnyTerm(value: string, terms: string[]): boolean {
  const normalizedValue = normalizeText(value);
  return terms.some((term) => {
    const normalizedTerm = normalizeText(term);
    return Boolean(normalizedTerm && normalizedValue.includes(normalizedTerm));
  });
}

function findOptionByControlledSignalGroups(
  options: PostCreationAdaptiveQuestionOption[],
  signals: PostCreationAdaptiveStudySignal[],
  groupNames: ControlledSignalGroupName[],
): { option: PostCreationAdaptiveQuestionOption; signal: PostCreationAdaptiveStudySignal } | null {
  for (const signal of signals) {
    const signalCorpus = `${signal.id} ${signal.label}`;
    const direct = options.find((candidate) => optionMatchesSignal(candidate, signal));
    if (direct) return { option: direct, signal };

    for (const groupName of groupNames) {
      const group = CONTROLLED_SIGNAL_GROUPS[groupName];
      if (!textHasAnyTerm(signalCorpus, group.signalTerms)) continue;
      const option = findFirstOptionByTerms(options, group.optionTerms);
      if (option) return { option, signal };
    }
  }
  return null;
}

function findOptionByIdPriority(
  options: PostCreationAdaptiveQuestionOption[],
  ids: string[],
): PostCreationAdaptiveQuestionOption | null {
  for (const id of ids) {
    const option = options.find((candidate) => candidate.id === id);
    if (option) return option;
  }
  return null;
}

function resolveObjectiveOption(params: {
  detection: PostCreationAdaptiveIntentDetection;
  question: PostCreationAdaptiveQuestion;
}): PostCreationAdaptiveQuestionOption | null {
  const { detection, question } = params;
  if (detection.mode === "brand_match") {
    return findFirstOptionByTerms(question.options, ["brand", "marca", "marcas"]);
  }
  if (detection.mode === "collab_match") {
    return findFirstOptionByTerms(question.options, ["collab", "colab", "parceria", "creator"]);
  }
  if (detection.mode === "comment_to_post") {
    return findFirstOptionByTerms(question.options, ["comentario", "comentarios", "identificacao", "responder"]);
  }
  return null;
}

function resolveFormatOption(params: {
  detection: PostCreationAdaptiveIntentDetection;
  question: PostCreationAdaptiveQuestion;
  corpus: string;
}): PostCreationAdaptiveQuestionOption | null {
  const { detection, question, corpus } = params;
  if (detection.mode === "weekly_plan") {
    return findOptionByIdPriority(question.options, ["reels_stories", "full_mix", "reels_carousel"]);
  }
  if (/\b(pov|reels?|video|cena|grav(ar|ar um|ando)?)\b/.test(corpus)) {
    return findOptionByIdPriority(question.options, ["reels", "simple_reels", "reply_reels"]);
  }
  return null;
}

function resolveHookOption(params: {
  question: PostCreationAdaptiveQuestion;
  corpus: string;
}): PostCreationAdaptiveQuestionOption | null {
  if (/\bpov\b/.test(params.corpus)) {
    return findOptionByIdPriority(params.question.options, ["pov"]);
  }
  return null;
}

function resolveCtaOption(question: PostCreationAdaptiveQuestion): PostCreationAdaptiveQuestionOption | null {
  return findOptionByIdPriority(question.options, ["specific_question", "answer_question", "anyone_else"])
    || findFirstOptionByTerms(question.options, ["pergunta", "comentario", "comentarios", "responder"]);
}

function resolveEngagementDriverOption(params: {
  question: PostCreationAdaptiveQuestion;
  studyContext: PostCreationAdaptiveStudyContext;
}): { option: PostCreationAdaptiveQuestionOption; signal: PostCreationAdaptiveStudySignal } | null {
  for (const signal of params.studyContext.topEngagementDrivers) {
    const normalizedSignal = normalizeText(`${signal.id} ${signal.label}`);
    const terms = (() => {
      if (/coment|convers|respost|intera|engaj/.test(normalizedSignal)) {
        return ["coment", "convers", "pergunta", "responder", "engaj", "intera"];
      }
      if (/salv|educ|checklist|tutorial|dica/.test(normalizedSignal)) {
        return ["salv", "guardar", "educ", "dica", "tutorial", "checklist"];
      }
      if (/compartilh|share|viral/.test(normalizedSignal)) {
        return ["compartilh", "enviar", "share", "viral"];
      }
      return [signal.id, signal.label];
    })();
    const option = findFirstOptionByTerms(params.question.options, terms);
    if (option) return { option, signal };
  }
  return null;
}

function resolveStudyWindowOption(params: {
  question: PostCreationAdaptiveQuestion;
  studyContext: PostCreationAdaptiveStudyContext;
}): { option: PostCreationAdaptiveQuestionOption; signal: PostCreationAdaptiveStudyWindowSignal } | null {
  for (const signal of params.studyContext.bestPostingWindows) {
    const terms = [signal.id, signal.label, signal.dayLabel, signal.hourLabel].filter((item): item is string => Boolean(item));
    const option = findFirstOptionByTerms(params.question.options, terms);
    if (option) return { option, signal };
  }
  return null;
}

function resolveStudyHookOption(params: {
  question: PostCreationAdaptiveQuestion;
  studyContext: PostCreationAdaptiveStudyContext;
}): { option: PostCreationAdaptiveQuestionOption; signal: PostCreationAdaptiveStudySignal } | null {
  return findOptionByStudySignals(params.question.options, [
    ...params.studyContext.topNarratives,
    ...params.studyContext.topContexts,
    ...params.studyContext.topEngagementDrivers,
  ]);
}

function qualitativeRationaleFor(mapKey: string, evidencePrefix: string): string {
  if (mapKey === "hook") {
    return "O gancho foi priorizado porque seus textos e aberturas mais fortes apontam para esse tipo de entrada.";
  }
  if (mapKey === "cta") {
    return "O CTA foi priorizado porque os sinais de chamada para ação do seu histórico favorecem esse comportamento.";
  }
  if (mapKey === "narrative") {
    return "A narrativa foi priorizada porque aparece nos sinais qualitativos mais recorrentes do seu conteúdo.";
  }
  if (mapKey === "format") {
    return "O formato foi priorizado porque combina desempenho, forma narrativa e intenção do conteúdo.";
  }
  if (mapKey === "objective") {
    return "O objetivo foi priorizado porque os sinais qualitativos indicam o comportamento mais natural para essa pauta.";
  }
  if (mapKey === "brand") {
    return "A oportunidade comercial foi priorizada porque os sinais qualitativos apontam para um encaixe natural de marca.";
  }
  if (mapKey === "collab") {
    return "A collab foi priorizada porque os sinais qualitativos sugerem contraste, conversa ou repertório compartilhado.";
  }
  if (evidencePrefix === "Tema recorrente" || evidencePrefix === "Palavra recorrente") {
    return "A escolha foi priorizada porque os temas recorrentes do seu conteúdo sustentam esse caminho.";
  }
  return rationaleForStudyMatch(mapKey);
}

function findQualitativeOptionBySource(params: {
  question: PostCreationAdaptiveQuestion;
  sources: Array<{
    signals: PostCreationAdaptiveStudySignal[];
    evidencePrefix: string;
    groupNames: ControlledSignalGroupName[];
  }>;
  rationaleMapKey: string;
}): QualitativeSignalMatch | null {
  for (const source of params.sources) {
    const match = findOptionByControlledSignalGroups(params.question.options, source.signals, source.groupNames);
    if (!match) continue;
    return {
      option: match.option,
      signal: match.signal,
      evidencePrefix: source.evidencePrefix,
      rationale: qualitativeRationaleFor(params.rationaleMapKey, source.evidencePrefix),
    };
  }
  return null;
}

function resolveQualitativeContextOption(params: {
  question: PostCreationAdaptiveQuestion;
  studyContext: PostCreationAdaptiveStudyContext;
  mapKey: string;
}): QualitativeSignalMatch | null {
  const { question, studyContext, mapKey } = params;
  if (mapKey === "format") {
    return findQualitativeOptionBySource({
      question,
      rationaleMapKey: mapKey,
      sources: [
        { signals: studyContext.topNarrativeForms, evidencePrefix: "Forma narrativa forte", groupNames: ["reelsVideo", "carousel", "stories"] },
        { signals: studyContext.topContentIntents, evidencePrefix: "Intenção de conteúdo", groupNames: ["question", "save", "share", "reelsVideo", "carousel", "stories"] },
        { signals: studyContext.topThemes, evidencePrefix: "Tema recorrente", groupNames: ["reelsVideo", "carousel", "stories", "commercial"] },
        { signals: studyContext.topThemeKeywords, evidencePrefix: "Palavra recorrente", groupNames: ["reelsVideo", "carousel", "stories", "commercial"] },
      ],
    });
  }
  if (mapKey === "narrative") {
    return findQualitativeOptionBySource({
      question,
      rationaleMapKey: mapKey,
      sources: [
        { signals: studyContext.topNarrativeForms, evidencePrefix: "Forma narrativa forte", groupNames: ["reelsVideo", "carousel", "stories", "question", "proof"] },
        { signals: studyContext.topThemes, evidencePrefix: "Tema recorrente", groupNames: ["reelsVideo", "carousel", "stories", "commercial"] },
        { signals: studyContext.topStances, evidencePrefix: "Sinal de posicionamento", groupNames: ["question", "collab", "commercial"] },
        { signals: studyContext.topProofStyles, evidencePrefix: "Sinal de prova", groupNames: ["proof", "reelsVideo", "carousel"] },
      ],
    });
  }
  if (mapKey === "hook") {
    return findQualitativeOptionBySource({
      question,
      rationaleMapKey: mapKey,
      sources: [
        { signals: studyContext.topHooks, evidencePrefix: "Gancho forte", groupNames: ["question", "reelsVideo", "proof"] },
        { signals: studyContext.topNarrativeForms, evidencePrefix: "Forma narrativa forte", groupNames: ["reelsVideo", "carousel", "stories", "question", "proof"] },
        { signals: studyContext.topCaptionSignals, evidencePrefix: "Sinal de legenda", groupNames: ["question", "save", "share", "reelsVideo", "carousel"] },
        { signals: studyContext.topThemes, evidencePrefix: "Tema recorrente", groupNames: ["question", "reelsVideo", "carousel", "commercial"] },
      ],
    });
  }
  if (mapKey === "cta") {
    return findQualitativeOptionBySource({
      question,
      rationaleMapKey: mapKey,
      sources: [
        { signals: studyContext.topCtas, evidencePrefix: "CTA recorrente", groupNames: ["question", "save", "share", "collab", "commercial"] },
        { signals: studyContext.topContentIntents, evidencePrefix: "Intenção de conteúdo", groupNames: ["question", "save", "share", "commercial"] },
      ],
    });
  }
  if (mapKey === "objective") {
    return findQualitativeOptionBySource({
      question,
      rationaleMapKey: mapKey,
      sources: [
        { signals: studyContext.topContentIntents, evidencePrefix: "Intenção de conteúdo", groupNames: ["question", "save", "share", "commercial"] },
        { signals: studyContext.topCommercialModes, evidencePrefix: "Sinal comercial", groupNames: ["commercial"] },
      ],
    });
  }
  if (mapKey === "brand") {
    return findQualitativeOptionBySource({
      question,
      rationaleMapKey: mapKey,
      sources: [
        { signals: studyContext.topCommercialModes, evidencePrefix: "Sinal comercial", groupNames: ["commercial"] },
        { signals: studyContext.topThemes, evidencePrefix: "Tema recorrente", groupNames: ["commercial", "reelsVideo", "carousel", "stories"] },
      ],
    });
  }
  if (mapKey === "collab") {
    return findQualitativeOptionBySource({
      question,
      rationaleMapKey: mapKey,
      sources: [
        { signals: studyContext.topStances, evidencePrefix: "Sinal de posicionamento", groupNames: ["collab", "question", "reelsVideo"] },
        { signals: studyContext.topNarrativeForms, evidencePrefix: "Forma narrativa forte", groupNames: ["collab", "reelsVideo", "question"] },
      ],
    });
  }
  if (mapKey === "what" || mapKey === "where" || mapKey === "proposal" || mapKey === "context") {
    return findQualitativeOptionBySource({
      question,
      rationaleMapKey: mapKey,
      sources: [
        { signals: studyContext.topThemes, evidencePrefix: "Tema recorrente", groupNames: ["reelsVideo", "carousel", "stories", "commercial", "question"] },
        { signals: studyContext.topThemeKeywords, evidencePrefix: "Palavra recorrente", groupNames: ["reelsVideo", "carousel", "stories", "commercial", "question"] },
        { signals: studyContext.topCaptionSignals, evidencePrefix: "Sinal de legenda", groupNames: ["reelsVideo", "carousel", "stories", "commercial", "question", "save"] },
      ],
    });
  }
  return null;
}

function resolveBrandOption(params: {
  detection: PostCreationAdaptiveIntentDetection;
  question: PostCreationAdaptiveQuestion;
}): PostCreationAdaptiveQuestionOption | null {
  const brandCategory = normalizeText(params.detection.brandCategory);
  if (brandCategory) {
    const byCategory = findFirstOptionByTerms(params.question.options, [brandCategory]);
    if (byCategory) return byCategory;
  }
  return findFirstOptionByTerms(params.question.options, ["marca", "brand", "beleza", "autocuidado"]);
}

function resolveCollabOption(question: PostCreationAdaptiveQuestion): PostCreationAdaptiveQuestionOption | null {
  return findOptionByIdPriority(question.options, ["reaction", "joint_scene", "debate"])
    || findFirstOptionByTerms(question.options, ["reacao", "cena", "conversa", "creator"]);
}

function resolveHeuristicOption(params: {
  detection: PostCreationAdaptiveIntentDetection;
  question: PostCreationAdaptiveQuestion;
  corpus: string;
}): PostCreationAdaptiveQuestionOption | null {
  const { detection, question, corpus } = params;

  if (question.mapKey === "objective") {
    return resolveObjectiveOption({ detection, question });
  }
  if (question.mapKey === "format") {
    return resolveFormatOption({ detection, question, corpus });
  }
  if (question.mapKey === "hook") {
    return resolveHookOption({ question, corpus });
  }
  if (question.mapKey === "cta") {
    return resolveCtaOption(question);
  }
  if (question.mapKey === "brand") {
    return resolveBrandOption({ detection, question });
  }
  if (question.mapKey === "collab") {
    return resolveCollabOption(question);
  }

  return null;
}

function rationaleForStudyMatch(mapKey: PostCreationAdaptiveQuestionMapKey | string): string {
  if (mapKey === "format") {
    return "O formato foi priorizado porque aparece entre os sinais mais fortes da sua análise.";
  }
  if (mapKey === "narrative") {
    return "A narrativa foi priorizada porque aparece entre os caminhos com mais evidência.";
  }
  if (mapKey === "where" || mapKey === "context") {
    return "Esse território aparece como um dos caminhos mais fortes do seu conteúdo.";
  }
  if (mapKey === "what" || mapKey === "proposal") {
    return "A proposta foi priorizada porque aparece entre os sinais mais consistentes do seu conteúdo.";
  }
  if (mapKey === "objective" || mapKey === "cta") {
    return "A escolha foi guiada pelos sinais de engajamento do seu histórico.";
  }
  if (mapKey === "schedule" || mapKey === "when") {
    return "A janela foi priorizada porque aparece entre os sinais disponíveis de planejamento.";
  }
  if (mapKey === "brand") {
    return "A oportunidade de marca foi priorizada pelos sinais comerciais disponíveis.";
  }
  if (mapKey === "collab") {
    return "A oportunidade de collab foi priorizada pelos sinais de parceria disponíveis.";
  }
  if (mapKey === "hook") {
    return "O gancho foi priorizado por combinar com os sinais narrativos e de engajamento.";
  }
  const knownMapKey = KNOWN_MAP_KEYS.has(mapKey) ? mapKey as PostCreationAdaptiveQuestionMapKey : null;
  return (knownMapKey ? RATIONALE_BY_MAP_KEY[knownMapKey] : null)
    || "Essa decisão ajuda a calibrar a recomendação final.";
}

function evidenceFromSignal(prefix: string, signal: PostCreationAdaptiveStudySignal): string {
  return `${prefix}: ${signal.label}`;
}

function evidenceFromWindow(signal: PostCreationAdaptiveStudyWindowSignal): string {
  return `Janela forte: ${signal.label}`;
}

function evidenceFromReferencePost(post: PostCreationAdaptiveStudyReferencePost): string {
  return `Post de referência: ${post.title}`;
}

function compactEvidence(evidence: Array<string | null | undefined>): string[] {
  return Array.from(new Set(evidence.map(cleanText).filter((item): item is string => Boolean(item)))).slice(0, 3);
}

function addReferenceEvidence(
  evidence: string[],
  studyContext: PostCreationAdaptiveStudyContext,
): string[] {
  const referencePost = studyContext.referencePosts[0];
  return compactEvidence([...evidence, referencePost ? evidenceFromReferencePost(referencePost) : null]);
}

function buildStudyMatch(
  mapKey: PostCreationAdaptiveQuestionMapKey | string,
  evidence: string[],
  studyContext: PostCreationAdaptiveStudyContext,
  rationale?: string,
): StudyContextMatch {
  return {
    rationale: rationale || rationaleForStudyMatch(mapKey),
    evidence: addReferenceEvidence(evidence, studyContext),
  };
}

function resolveStudyContextOption(params: {
  question: PostCreationAdaptiveQuestion;
  studyContext: PostCreationAdaptiveStudyContext | null | undefined;
}): ResolvedCorrectOption | null {
  const { question, studyContext } = params;
  if (!studyContext) return null;

  const mapKey = question.mapKey as string;
  if (mapKey === "format") {
    const match = findOptionByStudySignals(question.options, studyContext.topFormats);
    if (match) {
      return {
        option: match.option,
        studyContextMatch: buildStudyMatch(mapKey, [evidenceFromSignal("Formato forte", match.signal)], studyContext),
      };
    }
    const qualitativeMatch = resolveQualitativeContextOption({ question, studyContext, mapKey });
    if (qualitativeMatch) {
      return {
        option: qualitativeMatch.option,
        studyContextMatch: buildStudyMatch(
          mapKey,
          [evidenceFromSignal(qualitativeMatch.evidencePrefix, qualitativeMatch.signal)],
          studyContext,
          qualitativeMatch.rationale,
        ),
      };
    }
  }
  if (mapKey === "narrative") {
    const match = findOptionByStudySignals(question.options, studyContext.topNarratives);
    if (match) {
      return {
        option: match.option,
        studyContextMatch: buildStudyMatch(mapKey, [evidenceFromSignal("Narrativa forte", match.signal)], studyContext),
      };
    }
    const qualitativeMatch = resolveQualitativeContextOption({ question, studyContext, mapKey });
    if (qualitativeMatch) {
      return {
        option: qualitativeMatch.option,
        studyContextMatch: buildStudyMatch(
          mapKey,
          [evidenceFromSignal(qualitativeMatch.evidencePrefix, qualitativeMatch.signal)],
          studyContext,
          qualitativeMatch.rationale,
        ),
      };
    }
  }
  if (mapKey === "what" || mapKey === "proposal") {
    const match = findOptionByStudySignals(question.options, studyContext.topProposals);
    if (match) {
      return {
        option: match.option,
        studyContextMatch: buildStudyMatch(mapKey, [evidenceFromSignal("Proposta forte", match.signal)], studyContext),
      };
    }
    const qualitativeMatch = resolveQualitativeContextOption({ question, studyContext, mapKey });
    if (qualitativeMatch) {
      return {
        option: qualitativeMatch.option,
        studyContextMatch: buildStudyMatch(
          mapKey,
          [evidenceFromSignal(qualitativeMatch.evidencePrefix, qualitativeMatch.signal)],
          studyContext,
          qualitativeMatch.rationale,
        ),
      };
    }
  }
  if (mapKey === "where" || mapKey === "context") {
    const match = findOptionByStudySignals(question.options, studyContext.topContexts);
    if (match) {
      return {
        option: match.option,
        studyContextMatch: buildStudyMatch(mapKey, [evidenceFromSignal("Contexto forte", match.signal)], studyContext),
      };
    }
    const qualitativeMatch = resolveQualitativeContextOption({ question, studyContext, mapKey });
    if (qualitativeMatch) {
      return {
        option: qualitativeMatch.option,
        studyContextMatch: buildStudyMatch(
          mapKey,
          [evidenceFromSignal(qualitativeMatch.evidencePrefix, qualitativeMatch.signal)],
          studyContext,
          qualitativeMatch.rationale,
        ),
      };
    }
  }
  if (mapKey === "objective") {
    const match = resolveEngagementDriverOption({ question, studyContext });
    if (match) {
      return {
        option: match.option,
        studyContextMatch: buildStudyMatch(mapKey, [evidenceFromSignal("Sinal de engajamento", match.signal)], studyContext),
      };
    }
    const qualitativeMatch = resolveQualitativeContextOption({ question, studyContext, mapKey });
    if (qualitativeMatch) {
      return {
        option: qualitativeMatch.option,
        studyContextMatch: buildStudyMatch(
          mapKey,
          [evidenceFromSignal(qualitativeMatch.evidencePrefix, qualitativeMatch.signal)],
          studyContext,
          qualitativeMatch.rationale,
        ),
      };
    }
  }
  if (mapKey === "cta") {
    const qualitativeMatch = resolveQualitativeContextOption({ question, studyContext, mapKey });
    if (qualitativeMatch) {
      return {
        option: qualitativeMatch.option,
        studyContextMatch: buildStudyMatch(
          mapKey,
          [evidenceFromSignal(qualitativeMatch.evidencePrefix, qualitativeMatch.signal)],
          studyContext,
          qualitativeMatch.rationale,
        ),
      };
    }
    const match = resolveEngagementDriverOption({ question, studyContext });
    if (match) {
      return {
        option: match.option,
        studyContextMatch: buildStudyMatch(mapKey, [evidenceFromSignal("Sinal de engajamento", match.signal)], studyContext),
      };
    }
  }
  if (mapKey === "schedule" || mapKey === "when") {
    const match = resolveStudyWindowOption({ question, studyContext });
    if (match) {
      return {
        option: match.option,
        studyContextMatch: buildStudyMatch(mapKey, [evidenceFromWindow(match.signal)], studyContext),
      };
    }
  }
  if (mapKey === "brand") {
    const match = findOptionByStudySignals(question.options, studyContext.brandSignals);
    if (match) {
      return {
        option: match.option,
        studyContextMatch: buildStudyMatch(mapKey, [evidenceFromSignal("Sinal de marca", match.signal)], studyContext),
      };
    }
    const qualitativeMatch = resolveQualitativeContextOption({ question, studyContext, mapKey });
    if (qualitativeMatch) {
      return {
        option: qualitativeMatch.option,
        studyContextMatch: buildStudyMatch(
          mapKey,
          [evidenceFromSignal(qualitativeMatch.evidencePrefix, qualitativeMatch.signal)],
          studyContext,
          qualitativeMatch.rationale,
        ),
      };
    }
  }
  if (mapKey === "collab") {
    const match = findOptionByStudySignals(question.options, studyContext.collabSignals);
    if (match) {
      return {
        option: match.option,
        studyContextMatch: buildStudyMatch(mapKey, [evidenceFromSignal("Sinal de collab", match.signal)], studyContext),
      };
    }
    const qualitativeMatch = resolveQualitativeContextOption({ question, studyContext, mapKey });
    if (qualitativeMatch) {
      return {
        option: qualitativeMatch.option,
        studyContextMatch: buildStudyMatch(
          mapKey,
          [evidenceFromSignal(qualitativeMatch.evidencePrefix, qualitativeMatch.signal)],
          studyContext,
          qualitativeMatch.rationale,
        ),
      };
    }
  }
  if (mapKey === "hook") {
    const qualitativeMatch = resolveQualitativeContextOption({ question, studyContext, mapKey });
    if (qualitativeMatch) {
      return {
        option: qualitativeMatch.option,
        studyContextMatch: buildStudyMatch(
          mapKey,
          [evidenceFromSignal(qualitativeMatch.evidencePrefix, qualitativeMatch.signal)],
          studyContext,
          qualitativeMatch.rationale,
        ),
      };
    }
    const match = resolveStudyHookOption({ question, studyContext });
    if (match) {
      return {
        option: match.option,
        studyContextMatch: buildStudyMatch(mapKey, [evidenceFromSignal("Sinal forte", match.signal)], studyContext),
      };
    }
  }

  return null;
}

function resolveCorrectOption(params: {
  detection: PostCreationAdaptiveIntentDetection;
  question: PostCreationAdaptiveQuestion;
  corpus: string;
  studyContext?: PostCreationAdaptiveStudyContext | null;
}): ResolvedCorrectOption | null {
  const studyContextOption = resolveStudyContextOption({
    question: params.question,
    studyContext: params.studyContext,
  });
  if (studyContextOption) return studyContextOption;

  const recommendedOption = params.question.options.find((option) => option.recommended === true);
  if (recommendedOption) return { option: recommendedOption, studyContextMatch: null };

  const heuristicOption = resolveHeuristicOption(params);
  if (heuristicOption) return { option: heuristicOption, studyContextMatch: null };

  const firstOption = params.question.options[0] || null;
  return firstOption ? { option: firstOption, studyContextMatch: null } : null;
}

function buildFeedback(params: {
  mapKey: PostCreationAdaptiveQuestionMapKey;
  studyContext?: PostCreationAdaptiveStudyContext | null;
  studyContextMatch?: StudyContextMatch | null;
}): PostCreationAdaptiveAnswerFeedback {
  const rationale = params.studyContextMatch?.rationale
    || RATIONALE_BY_MAP_KEY[params.mapKey]
    || "Essa decisão ajuda a calibrar a recomendação final.";

  if (params.studyContextMatch) {
    const confidence = params.studyContext?.confidence.label;
    const cautious = confidence === "low";
    return {
      correct: cautious
        ? `Com os sinais disponíveis, essa é uma boa aposta. ${rationale}`
        : `Boa aposta. Esse caminho conversa com sinais fortes do seu histórico. ${rationale}`,
      incorrect: cautious
        ? `Com os sinais disponíveis, essa opção pode funcionar, mas eu seguiria por outro caminho. ${rationale}`
        : `Quase. Essa opção pode funcionar, mas os sinais do seu conteúdo apontam para outro caminho. ${rationale}`,
      rationale,
      evidence: params.studyContextMatch.evidence,
    };
  }

  return {
    correct: `Esse é o caminho mais forte para esta pauta. ${rationale}`,
    incorrect: `Essa opção pode funcionar, mas eu iria por outro caminho. ${rationale}`,
    rationale,
  };
}

function buildIdealAnswer(params: {
  question: PostCreationAdaptiveQuestion;
  option: PostCreationAdaptiveQuestionOption;
}): PostCreationAdaptiveAnswer {
  return {
    questionId: params.question.id,
    key: params.question.mapKey,
    optionId: params.option.id,
    value: params.option.value ?? params.option.label ?? params.option.id,
  };
}

function buildCorrectAnswersByQuestionId(
  questionKeys: PostCreationAdaptiveQuestionAnswerKey[],
): Record<string, string> {
  return questionKeys.reduce<Record<string, string>>((result, questionKey) => {
    result[questionKey.questionId] = questionKey.correctOptionId;
    return result;
  }, {});
}

function buildScoreContract(total: number) {
  return {
    max: total,
    passing: total > 0 ? Math.ceil(total * 0.75) : 0,
  };
}

function resolveScoreLabel(percentage: number): string {
  if (percentage === 100) return "Leitura afiada";
  if (percentage >= 75) return "Boa leitura estratégica";
  if (percentage >= 50) return "Caminho promissor";
  return "Ainda dá para calibrar";
}

function resolveAnswerOptionId(answer: PostCreationAdaptiveAnswer | undefined): string | null {
  return cleanText(answer?.optionId);
}

export function buildPostCreationAdaptiveAnswerKey(params: {
  detection: PostCreationAdaptiveIntentDetection;
  questions: PostCreationAdaptiveQuestion[];
  studyContext?: PostCreationAdaptiveStudyContext | null;
}): PostCreationAdaptiveAnswerKey {
  const corpus = buildDetectionCorpus(params.detection);
  const questionKeyInputs = params.questions
    .map((question) => {
      const resolved = resolveCorrectOption({
        detection: params.detection,
        question,
        corpus,
        studyContext: params.studyContext,
      });
      if (!resolved) return null;
      return {
        question,
        correctOption: resolved.option,
        studyContextMatch: resolved.studyContextMatch,
      };
    })
    .filter((item): item is {
      question: PostCreationAdaptiveQuestion;
      correctOption: PostCreationAdaptiveQuestionOption;
      studyContextMatch: StudyContextMatch | null;
    } => Boolean(item),
    );

  const questionKeys = questionKeyInputs.map<PostCreationAdaptiveQuestionAnswerKey>(({
    question,
    correctOption,
    studyContextMatch,
  }) => ({
    questionId: question.id,
    mapKey: question.mapKey,
    correctOptionId: correctOption.id,
    feedback: buildFeedback({
      mapKey: question.mapKey,
      studyContext: params.studyContext,
      studyContextMatch,
    }),
  }));
  const correctAnswersByQuestionId = buildCorrectAnswersByQuestionId(questionKeys);
  const idealAnswers = questionKeyInputs.map(({ question, correctOption }) =>
    buildIdealAnswer({ question, option: correctOption }),
  );
  const idealPlan = buildPostCreationStrategicPlan({
    detection: params.detection,
    questions: params.questions,
    answers: idealAnswers,
  });
  const legacyHandoff = buildPostCreationLegacyHandoff({ plan: idealPlan });

  return {
    mode: params.detection.mode,
    questionKeys,
    correctAnswersByQuestionId,
    idealAnswers,
    idealPlan,
    legacyHandoff,
    gameQuestions: buildPostCreationAdaptiveGameContract({
      questions: params.questions,
      answerKey: { questionKeys },
    }),
    score: buildScoreContract(questionKeys.length),
  };
}

export function evaluatePostCreationAdaptiveAnswers(params: {
  answerKey: PostCreationAdaptiveAnswerKey;
  answers: PostCreationAdaptiveAnswer[];
}): {
  evaluations: PostCreationAdaptiveAnswerEvaluation[];
  score: PostCreationAdaptiveScore;
} {
  const answersByQuestionId = new Map(params.answers.map((answer) => [answer.questionId, answer]));
  const evaluations = params.answerKey.questionKeys.map<PostCreationAdaptiveAnswerEvaluation>((questionKey) => {
    const selectedOptionId = resolveAnswerOptionId(answersByQuestionId.get(questionKey.questionId));
    const correctOptionId = cleanText(questionKey.correctOptionId);
    const isCorrect = Boolean(selectedOptionId && correctOptionId && selectedOptionId === correctOptionId);

    return {
      questionId: questionKey.questionId,
      selectedOptionId,
      correctOptionId,
      isCorrect,
      feedbackTitle: isCorrect ? "Boa aposta" : "Quase",
      feedbackMessage: isCorrect ? questionKey.feedback.correct : questionKey.feedback.incorrect,
      rationale: questionKey.feedback.rationale,
      evidence: compactEvidence(questionKey.feedback.evidence || []),
    };
  });

  const total = evaluations.length;
  const correct = evaluations.filter((evaluation) => evaluation.isCorrect).length;
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

  return {
    evaluations,
    score: {
      total,
      correct,
      percentage,
      label: resolveScoreLabel(percentage),
      summary: `Você acertou ${correct} de ${total} decisões estratégicas.`,
    },
  };
}
