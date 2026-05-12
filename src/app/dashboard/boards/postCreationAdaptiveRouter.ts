import type {
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveMode,
  PostCreationAdaptiveStage,
} from "./postCreationAdaptiveTypes";

type IntentMatch = {
  mode: PostCreationAdaptiveMode;
  confidence: number;
  signals: string[];
  detectedPauta?: string | null;
  objective?: string | null;
  brandCategory?: string | null;
  sourceComment?: string | null;
};

function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactExtractedText(value?: string | null): string | null {
  const normalized = (value || "")
    .replace(/^[\s:.,;!?-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length >= 3 ? normalized : null;
}

function collectSignals(normalizedInput: string, patterns: RegExp[]): string[] {
  return patterns
    .map((pattern) => normalizedInput.match(pattern)?.[0] || null)
    .filter((signal): signal is string => Boolean(signal));
}

function findFirstCapture(normalizedInput: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = normalizedInput.match(pattern);
    const captured = compactExtractedText(match?.[1]);
    if (captured) return captured;
  }
  return null;
}

function detectCommentToPost(normalizedInput: string): IntentMatch | null {
  const patterns = [
    /\bcomentario\b/,
    /\balguem comentou\b/,
    /\bresponder comentario\b/,
    /\btransformar comentario em (post|conteudo)\b/,
    /\bduvida da audiencia\b/,
  ];
  const signals = collectSignals(normalizedInput, patterns);
  if (!signals.length) return null;

  const sourceComment = findFirstCapture(normalizedInput, [
    /(?:alguem comentou|comentario|responder comentario|transformar comentario em post|transformar comentario em conteudo)\s*(?:isso aqui|que)?\s*[:\-]?\s*(.+)/,
    /(?:duvida da audiencia)\s*[:\-]?\s*(.+)/,
  ]);

  return {
    mode: "comment_to_post",
    confidence: sourceComment ? 0.85 : 0.75,
    signals,
    sourceComment,
  };
}

function detectBrandMatch(normalizedInput: string): IntentMatch | null {
  const patterns = [
    /\bmarca\b/,
    /\bmarcas\b/,
    /\bpubli\b/,
    /\bpublicidade\b/,
    /\bparceria\b/,
    /\bcampanha\b/,
    /\bbrand\b/,
    /\bpatrocinio\b/,
    /\batrair marcas\b/,
    /\bmarca de [a-z0-9 ]+\b/,
    /\bmarcas de [a-z0-9 ]+\b/,
    /\bfone de ouvido\b/,
  ];
  const signals = collectSignals(normalizedInput, patterns);
  if (!signals.length) return null;

  const brandCategory = findFirstCapture(normalizedInput, [
    /(?:atrair|encaixar|chamar|conseguir)\s+marcas?\s+de\s+(.+)/,
    /marcas?\s+de\s+(.+)/,
    /\b(fone de ouvido)\b/,
    /\b(skincare|beleza|audio|tecnologia|moda|fitness|comida|bebida)\b/,
  ]);

  return {
    mode: "brand_match",
    confidence: brandCategory ? 0.85 : 0.72,
    signals,
    brandCategory,
  };
}

function detectCollabMatch(normalizedInput: string): IntentMatch | null {
  const patterns = [
    /\bcollab\b/,
    /\bcolab\b/,
    /\bcolaboracao\b/,
    /\bcriar com outro creator\b/,
    /\bconteudo junto\b/,
    /\bcriador parceiro\b/,
  ];
  const signals = collectSignals(normalizedInput, patterns);
  if (!signals.length) return null;

  return {
    mode: "collab_match",
    confidence: 0.82,
    signals,
  };
}

function detectWeeklyPlan(normalizedInput: string): IntentMatch | null {
  const patterns = [
    /\bplanejar (?:a )?semana\b/,
    /\bminha semana\b/,
    /\bposts da semana\b/,
    /\bcalendario\b/,
    /\bplanejamento semanal\b/,
    /\bsemana de conteudo\b/,
  ];
  const signals = collectSignals(normalizedInput, patterns);
  if (!signals.length) return null;

  return {
    mode: "weekly_plan",
    confidence: 0.78,
    signals,
  };
}

function detectFormatGuidance(normalizedInput: string): IntentMatch | null {
  const patterns = [
    /\bqual formato\b/,
    /\bque formato\b/,
    /\bem que formato\b/,
    /\bquero saber (?:o|qual) formato\b/,
    /\bformato usar\b/,
    /\bmelhor formato\b/,
    /\bformato ideal\b/,
    /\bqual formato (?:performa|funciona) melhor\b/,
    /\bdevo fazer (?:em )?(?:reels?|video|carrossel|foto|story|stories?)\b/,
    /\b(?:reels?|video|foto|carrossel|story|stories?)\s+ou\s+(?:reels?|video|foto|carrossel|story|stories?)\b/,
    /\bnao sei se faco (?:reels?|video|foto|carrossel|story|stories?)(?:,\s*(?:reels?|video|foto|carrossel|story|stories?))*\s+ou\s+(?:reels?|video|foto|carrossel|story|stories?)\b/,
    /\bpostar em reels\b/,
    /\bformato postar\b/,
    /\bfazer em carrossel\b/,
    /\btipo de post\b/,
    /\bformato performa\b/,
    /\bformato tem mais chance\b/,
    /\bfunciona melhor em (?:reels?|video|carrossel|foto|story|stories?)\b/,
  ];
  const signals = collectSignals(normalizedInput, patterns);
  if (!signals.length) return null;

  const detectedPauta = findFirstCapture(normalizedInput, [
    /(?:qual|que)\s+formato\s+(?:eu\s+)?(?:devo\s+)?(?:usar|postar|fazer)(?:\s+(?:para|pra|sobre|de|em))?\s+(.+)/,
    /(?:formato|tipo de post)\s+(?:usar|tem mais chance|performa|funciona melhor)(?:\s+(?:para|pra|sobre|de|em))?\s+(.+)/,
    /(?:reels?|video|foto|carrossel|story|stories?)\s+ou\s+(?:reels?|video|foto|carrossel|story|stories?)(?:\s+(?:para|pra|sobre|de|em))?\s+(.+)/,
    /(?:devo fazer|melhor eu fazer)(?:\s+(?:em|um|uma))?\s+(?:reels?|video|foto|carrossel|story|stories?)(?:\s+(?:para|pra|sobre|de|em))?\s+(.+)/,
  ]);

  return {
    mode: "format_guidance",
    confidence: detectedPauta ? 0.9 : 0.84,
    signals,
    detectedPauta,
  };
}

function detectDiscoverPauta(normalizedInput: string): IntentMatch | null {
  const patterns = [
    /\bnao sei o que postar\b/,
    /\bme da ideias\b/,
    /\bme de ideias\b/,
    /\bpreciso de ideias\b/,
    /\bo que postar\b/,
    /\bideia de post\b/,
    /\bideias de conteudo\b/,
  ];
  const signals = collectSignals(normalizedInput, patterns);
  if (!signals.length) return null;

  return {
    mode: "discover_pauta",
    confidence: signals.some((signal) => signal.includes("nao sei") || signal.includes("o que postar")) ? 0.85 : 0.72,
    signals,
  };
}

function detectValidatePauta(normalizedInput: string): IntentMatch | null {
  const patterns = [
    /\bquero gravar\b/,
    /\bquero fazer um video\b/,
    /\bquero fazer uma pauta\b/,
    /\bquero criar um reels\b/,
    /\bquero criar uma pauta\b/,
    /\bpensei em gravar\b/,
    /\bminha pauta\b/,
    /\bpauta sobre\b/,
    /\bvou gravar\b/,
    /\bideia de video\b/,
  ];
  const signals = collectSignals(normalizedInput, patterns);
  if (!signals.length) return null;

  const detectedPauta = findFirstCapture(normalizedInput, [
    /(?:quero|vou)\s+gravar(?:\s+(?:um|uma))?(?:\s+(?:video|reels?|pov|post|conteudo))?\s*(?:sobre|de)?\s+(.+)/,
    /pensei em gravar(?:\s+(?:um|uma))?(?:\s+(?:video|reels?|pov|post|conteudo))?\s*(?:sobre|de)?\s+(.+)/,
    /(?:quero fazer|quero criar)(?:\s+(?:um|uma))?(?:\s+(?:video|reels?|post|pauta|conteudo))\s*(?:sobre|de)?\s+(.+)/,
    /(?:minha pauta|pauta sobre|ideia de video)\s*(?:e|eh|sobre|de)?\s*[:\-]?\s*(.+)/,
  ]);

  return {
    mode: "validate_pauta",
    confidence: detectedPauta ? 0.85 : 0.68,
    signals,
    detectedPauta,
  };
}

function detectCreateByGoal(normalizedInput: string): IntentMatch | null {
  const patterns = [
    /\bquero gerar comentarios\b/,
    /\bquero gerar mais comentarios\b/,
    /\bquero mais comentarios\b/,
    /\bquero mais alcance\b/,
    /\bquero engajamento\b/,
    /\bquero salvar\b/,
    /\bquero vender\b/,
    /\bquero crescer\b/,
    /\bquero atrair seguidores\b/,
  ];
  const signals = collectSignals(normalizedInput, patterns);
  if (!signals.length) return null;

  const objective = findFirstCapture(normalizedInput, [
    /quero\s+(gerar comentarios|gerar mais comentarios|mais comentarios|mais alcance|engajamento|salvar|vender|crescer|atrair seguidores)\b/,
  ]);

  return {
    mode: "create_by_goal",
    confidence: objective ? 0.82 : 0.68,
    signals,
    objective,
  };
}

function getSuggestedStage(match: IntentMatch | null): PostCreationAdaptiveStage {
  return match?.mode && match.mode !== "unknown" ? "quiz" : "intent";
}

export function detectPostCreationAdaptiveIntent(input: string): PostCreationAdaptiveIntentDetection {
  const originalInput = typeof input === "string" ? input : "";
  const normalizedInput = normalizeInput(originalInput);

  if (!normalizedInput) {
    return {
      mode: "unknown",
      confidence: 0.25,
      normalizedInput,
      originalInput,
      detectedPauta: null,
      objective: null,
      brandCategory: null,
      sourceComment: null,
      signals: [],
      suggestedStage: "intent",
    };
  }

  const match =
    detectCommentToPost(normalizedInput) ||
    detectBrandMatch(normalizedInput) ||
    detectCollabMatch(normalizedInput) ||
    detectFormatGuidance(normalizedInput) ||
    detectDiscoverPauta(normalizedInput) ||
    detectWeeklyPlan(normalizedInput) ||
    detectValidatePauta(normalizedInput) ||
    detectCreateByGoal(normalizedInput);

  if (!match) {
    return {
      mode: "unknown",
      confidence: 0.25,
      normalizedInput,
      originalInput,
      detectedPauta: null,
      objective: null,
      brandCategory: null,
      sourceComment: null,
      signals: [],
      suggestedStage: "intent",
    };
  }

  return {
    mode: match.mode,
    confidence: match.confidence,
    normalizedInput,
    originalInput,
    detectedPauta: match.detectedPauta || null,
    objective: match.objective || null,
    brandCategory: match.brandCategory || null,
    sourceComment: match.sourceComment || null,
    signals: match.signals,
    suggestedStage: getSuggestedStage(match),
  };
}
