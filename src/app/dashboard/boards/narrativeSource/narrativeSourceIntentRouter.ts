import type {
  NarrativeSource,
  NarrativeSourceIntent,
  NarrativeSourceIntentDetection,
} from "./narrativeSourceTypes";

type IntentRule = {
  intent: NarrativeSourceIntent;
  confidence: number;
  patterns: RegExp[];
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickOriginalQuestion(source: NarrativeSource): string {
  return (
    source.creatorQuestion?.trim() ||
    source.rawText?.trim() ||
    source.transcript?.trim() ||
    source.visualDescription?.trim() ||
    ""
  );
}

function collectSignals(text: string, patterns: RegExp[]): string[] {
  return patterns
    .map((pattern) => text.match(pattern)?.[0] || null)
    .filter((signal): signal is string => Boolean(signal));
}

const adaptToAdRule: IntentRule = {
  intent: "adapt_to_ad",
  confidence: 0.85,
  patterns: [
    /\bpubli\b/,
    /\bpublicidade\b/,
    /\bcampanha\b/,
    /\badaptar para marca\b/,
    /\btransformar (?:isso|esse video|essa ideia|esse conteudo) em publi\b/,
    /\bbriefing\b/,
    /\bpatrocinad[oa]\b/,
    /\bskincare\b.*\b(publi|campanha|publicidade|marca)\b/,
    /\b(publi|campanha|publicidade|marca)\b.*\bskincare\b/,
  ],
};

const collabRule: IntentRule = {
  intent: "collab_potential",
  confidence: 0.85,
  patterns: [
    /\bcollab\b/,
    /\bcolaboracao\b/,
    /\bconteudo junto\b/,
    /\boutro creator\b/,
    /\bcriador parceiro\b/,
    /\bparceiro\b/,
    /\bdupla\b/,
    /\bconvidad[oa]\b/,
  ],
};

const improveRule: IntentRule = {
  intent: "improve_content",
  confidence: 0.85,
  patterns: [
    /\bmelhorar\b/,
    /\bcomeco fraco\b/,
    /\bgancho fraco\b/,
    /\bcortar\b/,
    /\bregravar\b/,
    /\beditar\b/,
    /\benquadramento\b/,
    /\britmo\b/,
    /\blegenda\b/,
    /\bcapa\b/,
    /\bcta\b/,
  ],
};

const brandRule: IntentRule = {
  intent: "brand_potential",
  confidence: 0.85,
  patterns: [
    /\batrair marcas\b/,
    /\bmatch com marca\b/,
    /\bpotencial para marca\b/,
    /\bpotencial para atrair marcas\b/,
    /\bmonetizar\b/,
    /\bmarca combinaria\b/,
    /\bque marcas\b/,
    /\bcomercial\b/,
  ],
};

const positioningRule: IntentRule = {
  intent: "positioning_fit",
  confidence: 0.85,
  patterns: [
    /\bposicionamento\b/,
    /\bcombina comigo\b/,
    /\bcombina com minha conta\b/,
    /\bminha imagem\b/,
    /\bcoerencia com meu perfil\b/,
    /\bautoridade\b/,
    /\bidentidade\b/,
  ],
};

const discoverNarrativeRule: IntentRule = {
  intent: "discover_narrative",
  confidence: 0.85,
  patterns: [
    /\bqual narrativa\b/,
    /\bnarrativa (?:esse video )?comunica\b/,
    /\bque historia\b/,
    /\bo que isso diz\b/,
    /\bnao sei que narrativa\b/,
    /\bentender minha narrativa\b/,
  ],
};

const validateRule: IntentRule = {
  intent: "validate_before_posting",
  confidence: 0.85,
  patterns: [
    /\bvale postar\b/,
    /\besta bom\b/,
    /\bdevo postar\b/,
    /\bpostar ou nao\b/,
    /\binsegur[oa]\b/,
    /\bduvida se publico\b/,
  ],
};

function buildDetection(params: {
  source: NarrativeSource;
  intent: NarrativeSourceIntent;
  confidence: number;
  originalQuestion: string;
  normalizedQuestion: string;
  signals: string[];
}): NarrativeSourceIntentDetection {
  return {
    intent: params.intent,
    confidence: params.confidence,
    sourceType: params.source.sourceType,
    originalQuestion: params.originalQuestion,
    normalizedQuestion: params.normalizedQuestion,
    signals: params.signals,
  };
}

function matchRule(rule: IntentRule, text: string) {
  const signals = collectSignals(text, rule.patterns);
  return signals.length > 0 ? signals : null;
}

function hasGenericQuestion(text: string) {
  return /\?/.test(text) || /\b(voce pode|me ajuda|me ajudar|como|qual|o que|sera que)\b/.test(text);
}

export function detectNarrativeSourceIntent(source: NarrativeSource): NarrativeSourceIntentDetection {
  const originalQuestion = pickOriginalQuestion(source);
  const normalizedQuestion = normalizeText(originalQuestion);
  const campaignContext = normalizeText(source.metadata.campaignContext || "");
  const analysisText = [normalizedQuestion, campaignContext].filter(Boolean).join(" ");

  if (analysisText.length < 3) {
    return buildDetection({
      source,
      intent: "unknown",
      confidence: 0.2,
      originalQuestion,
      normalizedQuestion,
      signals: [],
    });
  }

  const adaptSignals = matchRule(adaptToAdRule, analysisText);
  if (adaptSignals) {
    return buildDetection({
      source,
      intent: adaptToAdRule.intent,
      confidence: adaptToAdRule.confidence,
      originalQuestion,
      normalizedQuestion,
      signals: adaptSignals,
    });
  }

  const collabSignals = matchRule(collabRule, analysisText);
  if (collabSignals) {
    return buildDetection({
      source,
      intent: collabRule.intent,
      confidence: collabRule.confidence,
      originalQuestion,
      normalizedQuestion,
      signals: collabSignals,
    });
  }

  const improveSignals = matchRule(improveRule, analysisText);
  if (improveSignals) {
    return buildDetection({
      source,
      intent: improveRule.intent,
      confidence: improveRule.confidence,
      originalQuestion,
      normalizedQuestion,
      signals: improveSignals,
    });
  }

  const brandSignals = matchRule(brandRule, analysisText);
  if (brandSignals) {
    return buildDetection({
      source,
      intent: brandRule.intent,
      confidence: brandRule.confidence,
      originalQuestion,
      normalizedQuestion,
      signals: brandSignals,
    });
  }

  const positioningSignals = matchRule(positioningRule, analysisText);
  if (positioningSignals) {
    return buildDetection({
      source,
      intent: positioningRule.intent,
      confidence: positioningRule.confidence,
      originalQuestion,
      normalizedQuestion,
      signals: positioningSignals,
    });
  }

  const discoverSignals = matchRule(discoverNarrativeRule, analysisText);
  if (discoverSignals) {
    return buildDetection({
      source,
      intent: discoverNarrativeRule.intent,
      confidence: discoverNarrativeRule.confidence,
      originalQuestion,
      normalizedQuestion,
      signals: discoverSignals,
    });
  }

  const validateSignals = matchRule(validateRule, analysisText);
  if (validateSignals) {
    return buildDetection({
      source,
      intent: validateRule.intent,
      confidence: validateRule.confidence,
      originalQuestion,
      normalizedQuestion,
      signals: validateSignals,
    });
  }

  if (hasGenericQuestion(originalQuestion)) {
    return buildDetection({
      source,
      intent: "general_question",
      confidence: 0.45,
      originalQuestion,
      normalizedQuestion,
      signals: ["generic_question"],
    });
  }

  return buildDetection({
    source,
    intent: "unknown",
    confidence: 0.2,
    originalQuestion,
    normalizedQuestion,
    signals: [],
  });
}
