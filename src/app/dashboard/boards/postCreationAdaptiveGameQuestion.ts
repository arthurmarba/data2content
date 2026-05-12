import type { PostCreationAdaptiveAnswerKey } from "./postCreationAdaptiveAnswerKey";
import type {
  PostCreationAdaptiveStudyContext,
  PostCreationAdaptiveStudySignal,
} from "./postCreationAdaptiveStudyContext";
import type {
  PostCreationAdaptiveQuestion,
  PostCreationAdaptiveQuestionMapKey,
  PostCreationAdaptiveQuestionOption,
  PostCreationAdaptiveQuestionType,
} from "./postCreationAdaptiveTypes";

export type PostCreationAdaptiveGameQuestionOption = PostCreationAdaptiveQuestionOption & {
  isCorrect: boolean;
  isDistractor: boolean;
  distractorReason?: string | null;
};

export type PostCreationAdaptiveGameQuestion = {
  id: string;
  type: PostCreationAdaptiveQuestionType;
  title: string;
  helper: string | null;
  mapKey: PostCreationAdaptiveQuestionMapKey;
  required: boolean;
  correctOptionId: string;
  options: PostCreationAdaptiveGameQuestionOption[];
  evidence: string[];
  correctReason: string;
};

export type BuildPostCreationAdaptiveGameQuestionsParams = {
  questions: PostCreationAdaptiveQuestion[];
  answerKey: PostCreationAdaptiveAnswerKey;
  studyContext?: PostCreationAdaptiveStudyContext | null;
};

export type PostCreationAdaptiveGameQuestionValidationResult = {
  ok: boolean;
  errors: string[];
};

type StudyContextOptionDescriptor = {
  label: string;
  reason: string;
};

type StudyContextThemeSource = "themeKeyword" | "theme" | "captionSignal";

type StudyContextThemeMatch = {
  signal: PostCreationAdaptiveStudySignal;
  source: StudyContextThemeSource;
  phrase: string;
};

const FALLBACK_DISTRACTOR_REASON =
  "Pode funcionar em outro contexto, mas não é a aposta principal aqui.";

const FALLBACK_DISTRACTOR_REASONS = [
  "Parece uma boa saída, mas pode ignorar o sinal mais forte do histórico.",
  "É uma alternativa possível, mas menos alinhada ao gabarito desta pergunta.",
  "Pode funcionar em outro contexto, mas não é a aposta principal aqui.",
];

const FALLBACK_OPTIONS_BY_MAP_KEY: Partial<
  Record<PostCreationAdaptiveQuestionMapKey, Array<{ id: string; label: string; reason: string }>>
> = {
  format: [
    { id: "fallback-format-carousel", label: "Carrossel explicativo", reason: "Ajuda quando a ideia precisa de ordem e consulta." },
    { id: "fallback-format-stories", label: "Stories em conversa", reason: "Ajuda quando a ideia precisa testar resposta rápida." },
    { id: "fallback-format-photo", label: "Foto com legenda forte", reason: "Ajuda quando imagem e opinião carregam o contexto." },
    { id: "fallback-format-reels", label: "Reels direto ao ponto", reason: "Ajuda quando cena, ritmo ou reação sustentam a pauta." },
  ],
  objective: [
    { id: "fallback-objective-comments", label: "Gerar comentários", reason: "Bom quando a ideia abre conversa ou identificação." },
    { id: "fallback-objective-shares", label: "Gerar compartilhamentos", reason: "Bom quando a frase é fácil de repassar." },
    { id: "fallback-objective-saves", label: "Gerar salvamentos", reason: "Bom quando a pauta tem utilidade para consultar depois." },
    { id: "fallback-objective-brand", label: "Abrir espaço para marca", reason: "Bom quando existe encaixe comercial orgânico." },
  ],
  narrative: [
    { id: "fallback-narrative-routine", label: "Rotina real", reason: "Traz contexto vivido e naturalidade." },
    { id: "fallback-narrative-opinion", label: "Opinião direta", reason: "Ajuda quando a força está no posicionamento." },
    { id: "fallback-narrative-backstage", label: "Bastidor", reason: "Aproxima quando o processo importa para a pauta." },
    { id: "fallback-narrative-tutorial", label: "Tutorial simples", reason: "Organiza uma solução em passos claros." },
  ],
  cta: [
    { id: "fallback-cta-question", label: "Pergunta específica", reason: "Facilita resposta direta nos comentários." },
    { id: "fallback-cta-examples", label: "Pedir exemplos parecidos", reason: "Abre espaço para repertório da audiência." },
    { id: "fallback-cta-save", label: "Salvar para consultar depois", reason: "Combina com dica, lista ou passo reutilizável." },
    { id: "fallback-cta-send", label: "Enviar para alguém", reason: "Combina com situações reconhecíveis e compartilháveis." },
  ],
  brand: [
    { id: "fallback-brand-routine", label: "Encaixe por rotina", reason: "Funciona quando a marca aparece no uso cotidiano." },
    { id: "fallback-brand-problem", label: "Encaixe por problema resolvido", reason: "Funciona quando o produto resolve uma tensão real." },
    { id: "fallback-brand-product", label: "Encaixe por produto em uso", reason: "Funciona quando a demonstração não parece forçada." },
    { id: "fallback-brand-proof", label: "Encaixe por prova de performance", reason: "Funciona quando resultado e evidência sustentam a pauta." },
  ],
  collab: [
    { id: "fallback-collab-same-niche", label: "Creator do mesmo nicho", reason: "Aumenta afinidade e leitura compartilhada do tema." },
    { id: "fallback-collab-complementary", label: "Creator complementar", reason: "Adiciona repertório sem disputar a mesma função." },
    { id: "fallback-collab-contrast", label: "Creator com opinião diferente", reason: "Cria contraste e conversa quando o tema comporta debate." },
    { id: "fallback-collab-audience", label: "Creator com audiência parecida", reason: "Facilita reconhecimento entre públicos próximos." },
  ],
};

const GENERIC_FALLBACK_OPTIONS = [
  { id: "fallback-generic-practical", label: "Caminho prático", reason: "Mantém a decisão simples e executável." },
  { id: "fallback-generic-conversation", label: "Caminho de conversa", reason: "Abre espaço para resposta da audiência." },
  { id: "fallback-generic-proof", label: "Caminho de prova", reason: "Valoriza evidência, exemplo ou contexto." },
  { id: "fallback-generic-commercial", label: "Caminho comercial", reason: "Testa encaixe de marca sem forçar a pauta." },
];

const WEAK_THEME_TERMS = new Set([
  "conteudo",
  "video",
  "reels",
  "post",
  "story",
  "stories",
  "dica",
  "dicas",
  "tutorial",
  "humor",
  "trend",
  "publicidade",
  "publi",
  "rotina",
]);

const CORRECT_REASON_BY_MAP_KEY: Partial<Record<PostCreationAdaptiveQuestionMapKey, string>> = {
  objective: "A resposta foi definida pelo gabarito estratégico da reação que o conteúdo precisa provocar.",
  format: "A resposta foi definida pelo gabarito estratégico do formato mais alinhado a esta pauta.",
  narrative: "A resposta foi definida pelo gabarito estratégico da narrativa com melhor encaixe.",
  hook: "A resposta foi definida pelo gabarito estratégico da abertura mais forte para segurar atenção.",
  cta: "A resposta foi definida pelo gabarito estratégico do convite mais coerente com a decisão.",
  brand: "A resposta foi definida pelo gabarito estratégico do encaixe comercial mais natural.",
  collab: "A resposta foi definida pelo gabarito estratégico da colaboração com melhor função para a pauta.",
  effort: "A resposta foi definida pelo gabarito estratégico do esforço mais realista para executar.",
  schedule: "A resposta foi definida pelo gabarito estratégico da cadência mais sustentável.",
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

function normalizeId(value?: string | null): string {
  return normalizeText(value).replace(/\s+/g, "_");
}

function shortenText(value: string, maxLength = 72): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  const sliced = cleaned.slice(0, maxLength - 1).trim();
  const lastSpace = sliced.lastIndexOf(" ");
  const safeSlice = lastSpace > 24 ? sliced.slice(0, lastSpace).trim() : sliced;
  return `${safeSlice}…`;
}

function displayFragment(value?: string | null, maxLength = 32): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  return shortenText(cleaned, maxLength).toLocaleLowerCase("pt-BR");
}

function limitUiLabel(value: string): string {
  return shortenText(value, 86);
}

function buildDescriptor(label: string, reason: string): StudyContextOptionDescriptor {
  return {
    label: limitUiLabel(label),
    reason: shortenText(reason, 140),
  };
}

function isWeakThemePhrase(value?: string | null): boolean {
  const normalized = normalizeText(value);
  return !normalized || WEAK_THEME_TERMS.has(normalized);
}

function compactEvidence(evidence: Array<string | null | undefined>): string[] {
  return Array.from(new Set(evidence.map(cleanText).filter((item): item is string => Boolean(item)))).slice(0, 3);
}

function getQuestionKey(params: BuildPostCreationAdaptiveGameQuestionsParams, questionId: string) {
  return params.answerKey.questionKeys.find((questionKey) => questionKey.questionId === questionId) || null;
}

function cloneValidOptions(options: PostCreationAdaptiveQuestionOption[]): PostCreationAdaptiveQuestionOption[] {
  const seen = new Set<string>();
  const result: PostCreationAdaptiveQuestionOption[] = [];

  for (const option of options) {
    const id = cleanText(option.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push({ ...option, id });
  }

  return result;
}

function optionCorpus(option: PostCreationAdaptiveQuestionOption): string {
  return normalizeText([option.id, option.label, option.value, option.reason, option.description].filter(Boolean).join(" "));
}

function signalCorpus(signal: PostCreationAdaptiveStudySignal): string {
  return normalizeText([signal.id, signal.label].filter(Boolean).join(" "));
}

function mergeStudySignals(...groups: Array<PostCreationAdaptiveStudySignal[] | undefined>): PostCreationAdaptiveStudySignal[] {
  const seen = new Set<string>();
  const result: PostCreationAdaptiveStudySignal[] = [];

  for (const group of groups) {
    for (const signal of group || []) {
      const label = cleanText(signal.label);
      const id = cleanText(signal.id) || label;
      const key = normalizeText(id || label);
      if (!label || !key || seen.has(key)) continue;
      seen.add(key);
      result.push(signal);
    }
  }

  return result;
}

function referencePostsToSignals(studyContext?: PostCreationAdaptiveStudyContext | null): PostCreationAdaptiveStudySignal[] {
  return (studyContext?.referencePosts || []).map((post) => ({
    id: `reference-${post.id}`,
    label: post.title,
    score: Math.max(0, post.interactions || post.reach || 0),
    evidenceCount: 1,
    reason: post.reason || "Post de referência do histórico.",
  }));
}

function postingWindowsToSignals(studyContext?: PostCreationAdaptiveStudyContext | null): PostCreationAdaptiveStudySignal[] {
  return (studyContext?.bestPostingWindows || []).map((window) => ({
    id: window.id,
    label: window.label,
    score: window.score,
    evidenceCount: window.evidenceCount,
    reason: window.reason,
  }));
}

function getPrimaryFormatSignal(studyContext?: PostCreationAdaptiveStudyContext | null): PostCreationAdaptiveStudySignal | null {
  return studyContext?.topFormats.find((signal) => cleanText(signal.label)) || null;
}

function getPrimaryNarrativeSignal(studyContext?: PostCreationAdaptiveStudyContext | null): PostCreationAdaptiveStudySignal | null {
  return studyContext?.topNarratives.find((signal) => cleanText(signal.label))
    || studyContext?.topNarrativeForms.find((signal) => cleanText(signal.label))
    || null;
}

function getPrimaryContextSignal(studyContext?: PostCreationAdaptiveStudyContext | null): PostCreationAdaptiveStudySignal | null {
  return studyContext?.topContexts.find((signal) => cleanText(signal.label)) || null;
}

function getPrimaryProposalSignal(studyContext?: PostCreationAdaptiveStudyContext | null): PostCreationAdaptiveStudySignal | null {
  return studyContext?.topProposals.find((signal) => cleanText(signal.label))
    || studyContext?.topContentIntents.find((signal) => cleanText(signal.label))
    || null;
}

function getPrimaryEngagementDriver(studyContext?: PostCreationAdaptiveStudyContext | null): PostCreationAdaptiveStudySignal | null {
  return studyContext?.topEngagementDrivers.find((signal) => cleanText(signal.label)) || null;
}

function getPrimaryReferencePost(studyContext?: PostCreationAdaptiveStudyContext | null) {
  return studyContext?.referencePosts.find((post) => cleanText(post.title)) || null;
}

function firstStrongThemeSignal(
  signals: PostCreationAdaptiveStudySignal[] | undefined,
  source: StudyContextThemeSource,
): StudyContextThemeMatch | null {
  const signal = signals?.find((candidate) => {
    const phrase = cleanText(candidate.label);
    return Boolean(phrase && !isWeakThemePhrase(phrase));
  });
  const phrase = displayFragment(signal?.label, 36);
  return signal && phrase ? { signal, source, phrase } : null;
}

function getPrimaryThemeKeywordSignal(studyContext?: PostCreationAdaptiveStudyContext | null): StudyContextThemeMatch | null {
  return firstStrongThemeSignal(studyContext?.topThemeKeywords, "themeKeyword");
}

function getPrimaryThemeSignal(studyContext?: PostCreationAdaptiveStudyContext | null): StudyContextThemeMatch | null {
  return firstStrongThemeSignal(studyContext?.topThemes, "theme");
}

function getPrimaryCaptionSignal(studyContext?: PostCreationAdaptiveStudyContext | null): StudyContextThemeMatch | null {
  return firstStrongThemeSignal(studyContext?.topCaptionSignals, "captionSignal");
}

function getPrimaryThemePhrase(studyContext?: PostCreationAdaptiveStudyContext | null): StudyContextThemeMatch | null {
  return getPrimaryThemeKeywordSignal(studyContext)
    || getPrimaryThemeSignal(studyContext)
    || getPrimaryCaptionSignal(studyContext);
}

function buildThemeEvidence(studyContext?: PostCreationAdaptiveStudyContext | null): string | null {
  const theme = getPrimaryThemePhrase(studyContext);
  if (!theme) return null;
  if (theme.source === "theme") return `Tema recorrente: ${theme.phrase}`;
  return `Palavra forte nas legendas: ${theme.phrase}`;
}

function hasAnyTerm(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function isSaveSignal(signal?: PostCreationAdaptiveStudySignal | null): boolean {
  return Boolean(signal && hasAnyTerm(signalCorpus(signal), ["save", "salvar", "salvamento", "salvamentos", "consulta"]));
}

function isCommentSignal(signal?: PostCreationAdaptiveStudySignal | null): boolean {
  return Boolean(signal && hasAnyTerm(signalCorpus(signal), ["comentario", "comentarios", "comment", "comments", "conversa"]));
}

function isShareSignal(signal?: PostCreationAdaptiveStudySignal | null): boolean {
  return Boolean(signal && hasAnyTerm(signalCorpus(signal), ["share", "shares", "compartilhamento", "compartilhar", "enviar"]));
}

function isQuestionSignal(signal?: PostCreationAdaptiveStudySignal | null): boolean {
  const text = signalCorpus(signal || { id: "", label: "", score: 0, evidenceCount: 0, reason: "" });
  return Boolean(signal && (hasAnyTerm(text, ["pergunta", "voce ja", "por que", "como"]) || signal.label.includes("?")));
}

function isContrastSignal(signal?: PostCreationAdaptiveStudySignal | null): boolean {
  return Boolean(signal && hasAnyTerm(signalCorpus(signal), ["contraste", "antes depois", "tensao", "erro", "pare"]));
}

function isProofSignal(signal?: PostCreationAdaptiveStudySignal | null): boolean {
  return Boolean(signal && hasAnyTerm(signalCorpus(signal), ["prova", "resultado", "evidencia", "processo", "bastidor"]));
}

function hasEngagementSignal(
  primary?: PostCreationAdaptiveStudySignal | null,
  candidate?: PostCreationAdaptiveStudySignal | null,
): boolean {
  return isCommentSignal(primary) || isSaveSignal(primary) || isShareSignal(primary)
    || isCommentSignal(candidate) || isSaveSignal(candidate) || isShareSignal(candidate);
}

function optionMatchesSignal(option: PostCreationAdaptiveQuestionOption, signal: PostCreationAdaptiveStudySignal): boolean {
  const optionText = optionCorpus(option);
  const signalText = signalCorpus(signal);
  if (!optionText || !signalText) return false;
  return optionText.includes(signalText) || signalText.includes(optionText);
}

function findOptionForSignal(
  options: PostCreationAdaptiveQuestionOption[],
  signal: PostCreationAdaptiveStudySignal,
): PostCreationAdaptiveQuestionOption | null {
  const directMatch = options.find((option) => optionMatchesSignal(option, signal));
  if (directMatch) return directMatch;

  if (normalizeText(signal.label).includes("carrossel") || normalizeText(signal.id).includes("carousel")) {
    return options.find((option) => /carousel|carrossel/.test(optionCorpus(option))) || null;
  }
  if (/reels?|video|movimento|cena/.test(signalCorpus(signal))) {
    return options.find((option) => /reels?|video/.test(optionCorpus(option))) || null;
  }
  if (/stories?|story|conversa/.test(signalCorpus(signal))) {
    return options.find((option) => /stories?|story/.test(optionCorpus(option))) || null;
  }
  if (/foto|photo|imagem|legenda/.test(signalCorpus(signal))) {
    return options.find((option) => /foto|photo|image|legenda/.test(optionCorpus(option))) || null;
  }

  return null;
}

function getStudySignalsForMapKey(
  mapKey: PostCreationAdaptiveQuestionMapKey,
  studyContext?: PostCreationAdaptiveStudyContext | null,
): PostCreationAdaptiveStudySignal[] {
  if (!studyContext) return [];

  if (mapKey === "format") return studyContext.topFormats;
  if (mapKey === "narrative") return studyContext.topNarratives;
  if (mapKey === "where") return studyContext.topContexts;
  if (mapKey === "what") return studyContext.topProposals;
  if (mapKey === "objective" || mapKey === "cta") return studyContext.topEngagementDrivers;
  if (mapKey === "hook") {
    return mergeStudySignals(
      studyContext.topHooks,
      studyContext.topCaptionSignals,
      studyContext.topThemes,
      studyContext.topThemeKeywords,
    );
  }
  if (mapKey === "how") {
    return mergeStudySignals(
      studyContext.topNarratives,
      studyContext.topContexts,
      studyContext.topProposals,
      studyContext.topProofStyles,
      studyContext.topCaptionSignals,
    );
  }
  if (mapKey === "why") {
    return mergeStudySignals(
      studyContext.topEngagementDrivers,
      studyContext.topProofStyles,
      studyContext.topCaptionSignals,
      referencePostsToSignals(studyContext),
    );
  }
  if (mapKey === "effort") {
    return mergeStudySignals(
      studyContext.topFormats,
      studyContext.topNarratives,
      studyContext.topThemeKeywords,
      studyContext.topThemes,
    );
  }
  if (mapKey === "brand") {
    return mergeStudySignals(
      studyContext.brandSignals,
      studyContext.topCommercialModes,
      studyContext.topContexts,
      studyContext.topThemeKeywords,
      studyContext.topThemes,
    );
  }
  if (mapKey === "collab") {
    return mergeStudySignals(
      studyContext.collabSignals,
      studyContext.topNarratives,
      studyContext.topContexts,
      studyContext.topThemeKeywords,
      studyContext.topThemes,
    );
  }
  if (mapKey === "who") {
    return mergeStudySignals(
      studyContext.collabSignals,
      studyContext.topContexts,
      studyContext.topNarratives,
    );
  }
  if (mapKey === "schedule") return postingWindowsToSignals(studyContext);
  return [];
}

function formatKind(signal: PostCreationAdaptiveStudySignal): "reels" | "carousel" | "stories" | "photo" | "unknown" {
  const text = signalCorpus(signal);
  if (/reels?|video/.test(text)) return "reels";
  if (/carrossel|carousel/.test(text)) return "carousel";
  if (/stories?|story/.test(text)) return "stories";
  if (/foto|photo|image|imagem/.test(text)) return "photo";
  return "unknown";
}

function buildStudyContextOptionDescriptor(params: {
  mapKey: PostCreationAdaptiveQuestionMapKey,
  signal: PostCreationAdaptiveStudySignal;
  studyContext?: PostCreationAdaptiveStudyContext | null;
}): StudyContextOptionDescriptor {
  const narrative = getPrimaryNarrativeSignal(params.studyContext);
  const context = getPrimaryContextSignal(params.studyContext);
  const proposal = getPrimaryProposalSignal(params.studyContext);
  const engagementDriver = getPrimaryEngagementDriver(params.studyContext);
  const theme = getPrimaryThemePhrase(params.studyContext);
  const narrativeLabel = displayFragment(narrative?.label);
  const contextLabel = displayFragment(context?.label);
  const proposalLabel = displayFragment(proposal?.label);
  const themeLabel = theme?.phrase || null;
  const signalLabel = cleanText(params.signal.label) || "Sinal do seu conteúdo";

  if (params.mapKey === "format") {
    const kind = formatKind(params.signal);
    if (kind === "reels") {
      return {
        label: themeLabel && narrativeLabel && contextLabel
          ? `Reels sobre ${themeLabel} em ${contextLabel} com ${narrativeLabel}`
          : themeLabel && narrativeLabel
            ? `Reels sobre ${themeLabel} com ${narrativeLabel}`
            : themeLabel && contextLabel
              ? `Reels sobre ${themeLabel} em ${contextLabel}`
              : themeLabel
                ? `Reels sobre ${themeLabel} com cena e ritmo do seu conteúdo`
                : narrativeLabel && contextLabel
                  ? `Reels com ${contextLabel} e ${narrativeLabel}`
                  : narrativeLabel
                    ? `Reels com ${narrativeLabel}`
                    : contextLabel
                      ? `Reels em ${contextLabel}`
                      : "Reels com cena e ritmo do seu conteúdo",
        reason: themeLabel
          ? "Cruza tema recorrente das legendas com formato, contexto e narrativa presentes nos sinais do seu conteúdo."
          : narrativeLabel || contextLabel
            ? "Combina formato forte do histórico com contexto/narrativa que aparecem nos seus conteúdos."
            : "Boa alternativa quando a força está em cena, ritmo ou reação.",
      };
    }

    if (kind === "carousel") {
      return {
        label: themeLabel && proposalLabel && isSaveSignal(engagementDriver)
          ? `Carrossel sobre ${themeLabel} para organizar ${proposalLabel} com potencial de salvamento`
          : themeLabel && proposalLabel
            ? `Carrossel sobre ${themeLabel} para organizar ${proposalLabel}`
            : themeLabel && isSaveSignal(engagementDriver)
              ? `Carrossel sobre ${themeLabel} para consulta e salvamento`
              : themeLabel
                ? `Carrossel sobre ${themeLabel} para estruturar uma ideia consultável`
                : proposalLabel && isSaveSignal(engagementDriver)
                  ? `Carrossel para organizar ${proposalLabel} com potencial de salvamento`
                  : proposalLabel
                    ? `Carrossel para organizar ${proposalLabel}`
                    : isSaveSignal(engagementDriver)
                      ? "Carrossel para consulta e salvamento"
                      : "Carrossel para estruturar uma ideia consultável",
        reason: themeLabel
          ? "Usa um tema recorrente para transformar a pauta em consulta, lista ou passo a passo."
          : "É uma alternativa quando a ideia precisa virar consulta, lista ou passo a passo.",
      };
    }

    if (kind === "stories") {
      return {
        label: themeLabel && isCommentSignal(engagementDriver)
          ? `Stories sobre ${themeLabel} para testar conversa com a audiência`
            : themeLabel && contextLabel
              ? `Stories sobre ${themeLabel} para testar conversa em ${contextLabel}`
              : themeLabel
                ? `Stories sobre ${themeLabel} para testar conversa rápida`
                : isCommentSignal(engagementDriver)
                  ? "Stories para testar conversa com a audiência"
                  : contextLabel
                    ? `Stories para testar conversa sobre ${contextLabel}`
                    : "Stories para testar conversa rápida",
        reason: themeLabel
          ? "Boa alternativa quando o tema pode virar resposta rápida antes de um post principal."
          : "Boa alternativa quando o objetivo é sentir reação antes de transformar em post principal.",
      };
    }

    if (kind === "photo") {
      return {
        label: themeLabel && contextLabel
          ? `Foto com legenda opinativa sobre ${themeLabel} e ${contextLabel}`
          : themeLabel
            ? `Foto com legenda opinativa sobre ${themeLabel}`
            : contextLabel
              ? `Foto com legenda opinativa sobre ${contextLabel}`
              : narrativeLabel
                ? `Foto com legenda opinativa em ${narrativeLabel}`
                : "Foto com legenda opinativa sobre contexto recorrente",
        reason: themeLabel
          ? "Depende mais de texto, ponto de vista e tema reconhecível do que de cena ou movimento."
          : "Depende mais de texto e ponto de vista do que de cena ou movimento.",
      };
    }

    return {
      label: `${signalLabel}, formato conectado aos seus sinais`,
      reason: "Aparece como alternativa entre os formatos observados no seu histórico.",
    };
  }

  if (params.mapKey === "narrative") {
    return {
      label: themeLabel && contextLabel
        ? `${signalLabel} sobre ${themeLabel} em ${contextLabel}`
        : themeLabel
          ? `${signalLabel} sobre ${themeLabel}`
          : contextLabel
            ? `${signalLabel} em contexto de ${contextLabel}`
            : proposalLabel
              ? `${signalLabel} com ${proposalLabel}`
              : `${signalLabel}, narrativa que aparece nos seus posts`,
      reason: themeLabel
        ? "Ancora a forma narrativa em um assunto recorrente do seu conteúdo."
        : "Cruza forma narrativa com sinais recorrentes do seu conteúdo.",
    };
  }

  if (params.mapKey === "where") {
    return {
      label: themeLabel && narrativeLabel
        ? `${signalLabel} com tema de ${themeLabel} e ${narrativeLabel} reconhecível`
        : themeLabel
          ? `${signalLabel} como contexto reconhecível para ${themeLabel}`
          : narrativeLabel
            ? `${signalLabel} com ${narrativeLabel} reconhecível`
            : `${signalLabel}, contexto presente nos posts de referência`,
      reason: themeLabel
        ? "Usa um território recorrente para dar corpo ao tema da pauta."
        : "Usa um território que aparece nos sinais analisados.",
    };
  }

  if (params.mapKey === "what") {
    const format = getPrimaryFormatSignal(params.studyContext);
    const formatLabel = displayFragment(format?.label);
    return {
      label: themeLabel
        ? `${signalLabel} sobre ${themeLabel}`
        : formatLabel
          ? `${signalLabel} em formato ${formatLabel}`
          : `${signalLabel}, proposta recorrente no seu conteúdo`,
      reason: themeLabel
        ? "Transforma um assunto recorrente em uma proposta mais concreta."
        : "Transforma uma proposta recorrente em uma decisão mais fácil de executar.",
    };
  }

  if (params.mapKey === "objective" || params.mapKey === "cta") {
    if (isCommentSignal(params.signal)) {
      return {
        label: themeLabel && contextLabel
          ? `Comentário a partir de ${themeLabel} em ${contextLabel}`
          : themeLabel
            ? `Comentário a partir de ${themeLabel}`
            : "Comentário a partir de situação reconhecível",
        reason: "Conecta a decisão ao tipo de conversa que já aparece nos sinais do histórico.",
      };
    }
    if (isSaveSignal(params.signal)) {
      return {
        label: themeLabel
          ? `Salvamento para dica sobre ${themeLabel}`
          : "Salvamento para dica consultável",
        reason: "Funciona quando a pauta pode virar lista, consulta ou passo a passo.",
      };
    }
    if (isShareSignal(params.signal)) {
      return {
        label: themeLabel
          ? `Compartilhamento por frase sobre ${themeLabel}`
          : "Compartilhamento por frase fácil de repassar",
        reason: "Ajuda quando a força está em uma ideia simples de enviar para outra pessoa.",
      };
    }
    return {
      label: `${signalLabel}, sinal de engajamento do seu histórico`,
      reason: "Usa um comportamento de audiência já presente nos sinais analisados.",
    };
  }

  if (params.mapKey === "hook") {
    if (themeLabel && isQuestionSignal(params.signal)) {
      return buildDescriptor(
        `Começar com pergunta sobre ${themeLabel}`,
        "Usa uma abertura de conversa ancorada em assunto recorrente do conteúdo.",
      );
    }
    if (themeLabel && isContrastSignal(params.signal)) {
      return buildDescriptor(
        `Mostrar contraste de ${themeLabel} logo no início`,
        "Transforma o tema em tensão rápida para segurar atenção.",
      );
    }
    if (themeLabel && contextLabel) {
      return buildDescriptor(
        `Abrir com ${themeLabel} em uma cena reconhecível`,
        "Cruza tema e contexto para deixar o gancho menos genérico.",
      );
    }
    if (themeLabel) {
      return buildDescriptor(
        `Abrir com ${themeLabel} em uma cena reconhecível`,
        "Usa um tema recorrente como ponto de entrada do post.",
      );
    }
    return buildDescriptor(
      `${signalLabel}, gancho do seu histórico`,
      "Usa uma abertura que aparece nos sinais de legenda e conteúdo.",
    );
  }

  if (params.mapKey === "how") {
    if (themeLabel && proposalLabel) {
      return buildDescriptor(
        `Organizar ${themeLabel} em ${proposalLabel}`,
        "Transforma o tema em execução mais clara para o post.",
      );
    }
    if (themeLabel && contextLabel) {
      return buildDescriptor(
        `Mostrar bastidor de ${themeLabel} com contexto real`,
        "Apoia a execução em um território recorrente do conteúdo.",
      );
    }
    if (themeLabel && narrativeLabel) {
      return buildDescriptor(
        `Transformar ${themeLabel} em cena curta`,
        "Usa a narrativa recorrente para reduzir a ideia a uma execução simples.",
      );
    }
    return buildDescriptor(
      `${signalLabel}, execução apoiada nos seus sinais`,
      "Usa narrativa, contexto ou proposta que aparecem no material analisado.",
    );
  }

  if (params.mapKey === "why") {
    if (themeLabel && (isProofSignal(params.signal) || hasAnyTerm(signalCorpus(params.signal), ["referencia"]))) {
      return buildDescriptor(
        `Porque ${themeLabel} já aparece como sinal recorrente`,
        "Conecta a justificativa ao tema e às evidências do histórico.",
      );
    }
    if (themeLabel && hasEngagementSignal(engagementDriver, params.signal)) {
      return buildDescriptor(
        `Porque ${themeLabel} cruza tema e reação da audiência`,
        "Usa o assunto recorrente junto do comportamento que ele tende a provocar.",
      );
    }
    if (themeLabel) {
      return buildDescriptor(
        `Porque ${themeLabel} já aparece no material analisado`,
        "A justificativa parte de um assunto recorrente, sem inventar dado novo.",
      );
    }
    return buildDescriptor(
      `${signalLabel}, razão apoiada no histórico`,
      "Usa engajamento, prova ou post de referência para sustentar a escolha.",
    );
  }

  if (params.mapKey === "effort") {
    const text = signalCorpus(params.signal);
    if (themeLabel && hasAnyTerm(text, ["reels", "stories", "foto", "cena"])) {
      return buildDescriptor(
        `Versão simples: ${themeLabel} em uma cena rápida`,
        "Contextualiza esforço como execução viável, não como métrica do histórico.",
      );
    }
    if (themeLabel && hasAnyTerm(text, ["carrossel", "carousel", "tutorial", "passo"])) {
      return buildDescriptor(
        `Versão média: ${themeLabel} com roteiro curto`,
        "Organiza o tema em uma execução um pouco mais preparada.",
      );
    }
    if (themeLabel) {
      return buildDescriptor(
        `Versão completa: ${themeLabel} com mais cenas e prova visual`,
        "Reserva mais produção quando a pauta precisa de contexto e sustentação.",
      );
    }
    return buildDescriptor(
      `${signalLabel}, esforço conectado ao seu conteúdo`,
      "Usa sinais do histórico apenas para contextualizar a execução.",
    );
  }

  if (params.mapKey === "brand") {
    if (params.studyContext?.brandSignals.some((signal) => signal.id === params.signal.id || signal.label === params.signal.label)) {
      return buildDescriptor(
        themeLabel || contextLabel
          ? `Marca ligada a ${signalLabel} dentro de ${themeLabel || contextLabel}`
          : `Marca ligada a ${signalLabel}`,
        "Usa sinal comercial existente sem prometer match garantido.",
      );
    }
    return buildDescriptor(
      themeLabel
        ? `Marca em contexto de ${themeLabel} sem parecer interrupção`
        : `${signalLabel}, encaixe comercial contextual`,
      "Apoia o encaixe em contexto, tema ou modo comercial já observado.",
    );
  }

  if (params.mapKey === "collab" || params.mapKey === "who") {
    if (params.studyContext?.collabSignals.some((signal) => signal.id === params.signal.id || signal.label === params.signal.label)) {
      return buildDescriptor(
        themeLabel
          ? `Collab com ${signalLabel} para ampliar ${themeLabel}`
          : `Collab com ${signalLabel}`,
        "Usa sinal de colaboração existente como ponto de partida.",
      );
    }
    return buildDescriptor(
      themeLabel
        ? `Creator complementar para discutir ${themeLabel}`
        : `${signalLabel}, creator alinhado ao contexto`,
      "Usa narrativa ou contexto recorrente para orientar o perfil da parceria.",
    );
  }

  if (params.mapKey === "schedule") {
    return buildDescriptor(
      `${signalLabel}, janela forte do histórico`,
      "Usa uma janela recorrente como contexto de cadência, sem tratar horário como certeza.",
    );
  }

  return {
    label: `${signalLabel}, sinal recorrente nos seus conteúdos`,
    reason: "Aparece entre os sinais analisados e ajuda a reduzir escolha genérica.",
  };
}

function applyStudyContextToOptions(params: {
  question: PostCreationAdaptiveQuestion;
  options: PostCreationAdaptiveQuestionOption[];
  studyContext?: PostCreationAdaptiveStudyContext | null;
}): PostCreationAdaptiveQuestionOption[] {
  const signals = getStudySignalsForMapKey(params.question.mapKey, params.studyContext)
    .filter((signal) => cleanText(signal.label))
    .slice(0, 6);
  if (!signals.length) return params.options;

  const result: PostCreationAdaptiveQuestionOption[] = [];
  const usedIds = new Set<string>();

  for (const signal of signals) {
    const existingOption = findOptionForSignal(params.options, signal);
    const id = existingOption?.id || `study-${params.question.mapKey}-${normalizeId(signal.id || signal.label)}`;
    if (!id || usedIds.has(id)) continue;

    usedIds.add(id);
    const descriptor = buildStudyContextOptionDescriptor({
      mapKey: params.question.mapKey,
      signal,
      studyContext: params.studyContext,
    });
    result.push({
      ...(existingOption || {}),
      id,
      label: limitUiLabel(descriptor.label),
      reason: descriptor.reason,
      value: existingOption?.value || signal.label,
      recommended: existingOption?.recommended,
    });
  }

  for (const option of params.options) {
    if (!usedIds.has(option.id)) {
      usedIds.add(option.id);
      result.push(option);
    }
  }

  return result;
}

function fallbackTemplatesForMapKey(mapKey: PostCreationAdaptiveQuestionMapKey) {
  return FALLBACK_OPTIONS_BY_MAP_KEY[mapKey] || GENERIC_FALLBACK_OPTIONS;
}

function buildFallbackOptions(params: {
  mapKey: PostCreationAdaptiveQuestionMapKey;
  usedIds: Set<string>;
  count: number;
}): PostCreationAdaptiveQuestionOption[] {
  const templates = [...fallbackTemplatesForMapKey(params.mapKey), ...GENERIC_FALLBACK_OPTIONS];
  const result: PostCreationAdaptiveQuestionOption[] = [];

  for (const template of templates) {
    if (result.length >= params.count) break;
    let id = template.id;
    let suffix = 2;
    while (params.usedIds.has(id)) {
      id = `${template.id}-${suffix}`;
      suffix += 1;
    }
    params.usedIds.add(id);
    result.push({
      id,
      label: template.label,
      reason: template.reason,
      value: id,
    });
  }

  return result;
}

function resolveCorrectOptionId(params: {
  question: PostCreationAdaptiveQuestion;
  answerKey: PostCreationAdaptiveAnswerKey;
  options: PostCreationAdaptiveQuestionOption[];
}): string | null {
  const fromAnswerKey = cleanText(params.answerKey.correctAnswersByQuestionId[params.question.id]);
  if (fromAnswerKey && params.options.some((option) => option.id === fromAnswerKey)) {
    return fromAnswerKey;
  }

  const recommended = params.options.find((option) => option.recommended);
  if (recommended) return recommended.id;

  return params.options[0]?.id || null;
}

function normalizeToFourOptions(params: {
  question: PostCreationAdaptiveQuestion;
  answerKey: PostCreationAdaptiveAnswerKey;
  studyContext?: PostCreationAdaptiveStudyContext | null;
}): { options: PostCreationAdaptiveQuestionOption[]; correctOptionId: string } {
  const initialOptions = applyStudyContextToOptions({
    question: params.question,
    options: cloneValidOptions(params.question.options),
    studyContext: params.studyContext,
  });
  const usedIds = new Set(initialOptions.map((option) => option.id));
  let options = initialOptions;

  if (options.length < 4) {
    options = [
      ...options,
      ...buildFallbackOptions({
        mapKey: params.question.mapKey,
        usedIds,
        count: 4 - options.length,
      }),
    ];
  }

  let correctOptionId = resolveCorrectOptionId({
    question: params.question,
    answerKey: params.answerKey,
    options,
  });

  if (!correctOptionId) {
    const [firstFallback, ...restFallback] = buildFallbackOptions({
      mapKey: params.question.mapKey,
      usedIds,
      count: 4,
    });
    options = [firstFallback, ...restFallback].filter((option): option is PostCreationAdaptiveQuestionOption => Boolean(option));
    correctOptionId = options[0]?.id || "";
  }

  if (options.length > 4) {
    const correctOption = options.find((option) => option.id === correctOptionId);
    const distractors = options.filter((option) => option.id !== correctOptionId).slice(0, 3);
    const selectedIds = new Set([correctOption?.id, ...distractors.map((option) => option.id)].filter(Boolean));
    options = options.filter((option) => selectedIds.has(option.id)).slice(0, 4);
  }

  if (options.length < 4) {
    options = [
      ...options,
      ...buildFallbackOptions({
        mapKey: params.question.mapKey,
        usedIds: new Set(options.map((option) => option.id)),
        count: 4 - options.length,
      }),
    ];
  }

  if (!options.some((option) => option.id === correctOptionId)) {
    correctOptionId = options.find((option) => option.recommended)?.id || options[0]?.id || "";
  }

  return {
    options: options.slice(0, 4),
    correctOptionId,
  };
}

function resolveCorrectReason(params: {
  mapKey: PostCreationAdaptiveQuestionMapKey;
  rationale?: string | null;
  correctOption?: PostCreationAdaptiveQuestionOption | null;
  studyContext?: PostCreationAdaptiveStudyContext | null;
}): string {
  return resolveStudyContextCorrectReason(params.mapKey, params.studyContext)
    || cleanText(params.rationale)
    || cleanText(params.correctOption?.reason)
    || CORRECT_REASON_BY_MAP_KEY[params.mapKey]
    || "A resposta foi definida pelo gabarito estratégico desta pergunta.";
}

function resolveStudyContextCorrectReason(
  mapKey: PostCreationAdaptiveQuestionMapKey,
  studyContext?: PostCreationAdaptiveStudyContext | null,
): string | null {
  if (!studyContext) return null;

  const hasFormat = Boolean(getPrimaryFormatSignal(studyContext));
  const hasNarrative = Boolean(getPrimaryNarrativeSignal(studyContext));
  const hasContext = Boolean(getPrimaryContextSignal(studyContext));
  const hasEngagement = Boolean(getPrimaryEngagementDriver(studyContext));
  const hasReferencePost = Boolean(getPrimaryReferencePost(studyContext));
  const hasTheme = Boolean(getPrimaryThemePhrase(studyContext));

  if (mapKey === "format" && hasTheme && hasFormat && (hasNarrative || hasContext)) {
    return [
      "A aposta cruza tema recorrente, formato, narrativa e contexto dos sinais analisados.",
      hasEngagement ? "O sinal de engajamento reforça essa escolha." : null,
      hasReferencePost ? "Apoiado por post de referência do seu histórico." : null,
    ].filter(Boolean).join(" ");
  }

  if (mapKey === "format" && hasFormat && (hasNarrative || hasContext)) {
    return [
      "A aposta cruza formato, narrativa e contexto recorrentes nos sinais analisados.",
      hasEngagement ? "O sinal de engajamento reforça essa escolha." : null,
      hasReferencePost ? "Apoiado por post de referência do seu histórico." : null,
    ].filter(Boolean).join(" ");
  }

  if ((mapKey === "objective" || mapKey === "cta") && hasTheme && hasEngagement) {
    return [
      "A escolha usa um tema recorrente e um sinal de engajamento do histórico.",
      hasReferencePost ? "Apoiado por post de referência do seu histórico." : null,
    ].filter(Boolean).join(" ");
  }

  if ((mapKey === "objective" || mapKey === "cta") && hasEngagement) {
    return [
      "A escolha usa um sinal de engajamento recorrente do seu histórico.",
      hasReferencePost ? "Apoiado por post de referência do seu histórico." : null,
    ].filter(Boolean).join(" ");
  }

  if ((mapKey === "narrative" || mapKey === "where" || mapKey === "what") && hasTheme && (hasNarrative || hasContext)) {
    return [
      "A aposta combina tema, narrativa e contexto recorrentes no material de estudo.",
      hasReferencePost ? "Apoiado por post de referência do seu histórico." : null,
    ].filter(Boolean).join(" ");
  }

  if ((mapKey === "narrative" || mapKey === "where" || mapKey === "what") && (hasNarrative || hasContext)) {
    return [
      "A aposta usa narrativa, contexto ou proposta recorrente nos sinais analisados.",
      hasReferencePost ? "Apoiado por post de referência do seu histórico." : null,
    ].filter(Boolean).join(" ");
  }

  return null;
}

function resolveDistractorReason(index: number): string {
  return FALLBACK_DISTRACTOR_REASONS[index % FALLBACK_DISTRACTOR_REASONS.length] || FALLBACK_DISTRACTOR_REASON;
}

export function buildPostCreationAdaptiveGameQuestions(
  params: BuildPostCreationAdaptiveGameQuestionsParams,
): PostCreationAdaptiveGameQuestion[] {
  return params.questions.map((question) => {
    const { options, correctOptionId } = normalizeToFourOptions({
      question,
      answerKey: params.answerKey,
      studyContext: params.studyContext,
    });
    const questionKey = getQuestionKey(params, question.id);
    const themeEvidence = buildThemeEvidence(params.studyContext);
    const referencePostEvidence = params.studyContext?.referencePosts[0]?.title
      ? `Post de referência: ${shortenText(params.studyContext.referencePosts[0].title, 56)}`
      : null;
    const evidence = compactEvidence([...(questionKey?.feedback.evidence || []), themeEvidence, referencePostEvidence]);
    const correctOption = options.find((option) => option.id === correctOptionId) || null;
    const correctReason = resolveCorrectReason({
      mapKey: question.mapKey,
      rationale: questionKey?.feedback.rationale,
      correctOption,
      studyContext: params.studyContext,
    });
    let distractorIndex = 0;

    return {
      id: question.id,
      type: question.type,
      title: question.title,
      helper: question.helper || null,
      mapKey: question.mapKey,
      required: question.required,
      correctOptionId,
      evidence,
      correctReason,
      options: options.map<PostCreationAdaptiveGameQuestionOption>((option) => {
        const isCorrect = option.id === correctOptionId;
        const distractorReason = isCorrect ? null : resolveDistractorReason(distractorIndex++);
        return {
          ...option,
          isCorrect,
          isDistractor: !isCorrect,
          distractorReason,
        };
      }),
    };
  });
}

export function validatePostCreationAdaptiveGameQuestion(
  question: PostCreationAdaptiveGameQuestion,
): PostCreationAdaptiveGameQuestionValidationResult {
  const errors: string[] = [];
  const optionIds = question.options.map((option) => cleanText(option.id) || "");
  const uniqueOptionIds = new Set(optionIds);
  const correctCount = question.options.filter((option) => option.isCorrect).length;
  const distractorCount = question.options.filter((option) => option.isDistractor).length;

  if (question.options.length !== 4) {
    errors.push("GameQuestion precisa ter exatamente 4 opcoes.");
  }
  if (correctCount !== 1) {
    errors.push("GameQuestion precisa ter exatamente 1 resposta certa.");
  }
  if (distractorCount !== 3) {
    errors.push("GameQuestion precisa ter exatamente 3 distratores.");
  }
  if (!cleanText(question.correctOptionId) || !optionIds.includes(question.correctOptionId)) {
    errors.push("correctOptionId precisa existir nas opcoes.");
  }
  if (optionIds.some((id) => !id)) {
    errors.push("Todas as opcoes precisam ter id.");
  }
  if (uniqueOptionIds.size !== optionIds.length) {
    errors.push("As opcoes nao podem ter ids duplicados.");
  }
  if (!cleanText(question.title)) {
    errors.push("GameQuestion precisa ter titulo.");
  }
  if (!cleanText(question.mapKey)) {
    errors.push("GameQuestion precisa ter mapKey.");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function validatePostCreationAdaptiveGameQuestions(
  questions: PostCreationAdaptiveGameQuestion[],
): PostCreationAdaptiveGameQuestionValidationResult {
  const errors = questions.flatMap((question, index) => {
    const validation = validatePostCreationAdaptiveGameQuestion(question);
    return validation.errors.map((error) => `${question.id || `question-${index}`}: ${error}`);
  });

  return {
    ok: errors.length === 0,
    errors,
  };
}
