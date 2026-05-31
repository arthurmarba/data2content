export type Data2ContentNarrativeContractInput = {
  videoSubject?: string | null;
  mainNarrative?: string | null;
  whatVideoCommunicates?: string | null;
  creatorIntent?: string | null;
  strategicReading?: string | null;
  strength?: string | null;
  attentionPoint?: string | null;
  recommendedAdjustment?: string | null;
  suggestedHook?: string | null;
  creatorSignals?: string[];
  brandTerritories?: string[];
  nextActions?: string[];
};

export type Data2ContentNarrativeContract = {
  videoSubject: string | null;
  creatorPointOfView: string;
  centralNarrativeCandidate: string;
  strategicThesis: string;
  territories: string[];
  tension: string;
  nextExperiment: string;
};

const FALLBACK_NARRATIVE = "Narrativa em observacao";
const FALLBACK_THESIS = "Este video cria um sinal inicial para o mapa narrativo.";
const FALLBACK_TENSION = "Ainda falta separar o tema do video da narrativa do creator.";
const FALLBACK_NEXT_EXPERIMENT = "Comparar esse eixo com outras leituras antes de tratar como narrativa central.";

const GENERIC_PREFIXES = [
  /^narrativa\s+em\s+observa[cç][aã]o\s*:\s*/i,
  /^sinal\s+narrativo\s*:\s*/i,
  /^esse\s+v[ií]deo\s+comunica\s+(?:uma\s+dire[cç][aã]o\s+de\s+conte[uú]do\s+ligada\s+a\s+)?/i,
  /^este\s+v[ií]deo\s+(?:comunica|mostra|revela)\s+/i,
  /^pelo\s+v[ií]deo,\s*a\s+leitura\s+principal\s+aponta\s+para\s+/i,
  /^o\s+criador\s+(?:analisa|refor[cç]a|mostra|apresenta|comenta|explica|discute)\s+/i,
  /^a\s+creator\s+(?:analisa|refor[cç]a|mostra|apresenta|comenta|explica|discute)\s+/i,
  /^o\s+creator\s+(?:analisa|refor[cç]a|mostra|apresenta|comenta|explica|discute)\s+/i,
  /^o\s+melhor\s+caminho\s+[eé]\s+/i,
];

const LOW_VALUE_PATTERNS = [
  /^cria\s+uma\s+primeira\s+pista/i,
  /^entra\s+como\s+sinal/i,
  /^pode\s+virar\s+padr[aã]o/i,
  /^refinar\s+a\s+abertura/i,
  /^testar\s+uma\s+abertura/i,
  /^a\s+narrativa\s+n[aã]o\s+(?:deixa|explicita|explora)/i,
];

const STOPWORDS = new Set([
  "para",
  "como",
  "uma",
  "um",
  "por",
  "com",
  "que",
  "esse",
  "este",
  "essa",
  "esta",
  "video",
  "vídeo",
  "criador",
  "creator",
  "analisa",
  "mostra",
  "reforca",
  "reforça",
  "aponta",
  "leitura",
  "principal",
]);

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function clean(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return null;
  return text.replace(/\.{2,}$/g, ".").trim();
}

function stripGenericPrefix(value: string): string {
  let text = clean(value) ?? "";
  for (let i = 0; i < 3; i += 1) {
    const before = text;
    for (const pattern of GENERIC_PREFIXES) {
      text = text.replace(pattern, "").trim();
    }
    if (before === text) break;
  }
  return text;
}

function words(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

function isLowValueText(value: string | null | undefined): boolean {
  const text = clean(value);
  if (!text) return true;
  const normalized = normalize(text);
  return LOW_VALUE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function data2ContentTextKey(value: string | null | undefined): string {
  return normalize(stripGenericPrefix(clean(value) ?? ""))
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length >= 4)
    .slice(0, 8)
    .join(" ");
}

function limitSentence(value: string, maxLength = 180): string {
  const text = clean(value) ?? "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function isCultureBusinessCluster(value: string): boolean {
  const text = normalize(value);
  return (
    /bad\s+bunny|super\s+bowl|propriedade\s+intelectual|independencia|independência|artista|impacto\s+cultural|comunidade|industria\s+criativa|indústria\s+criativa/.test(text) &&
    /negocio|negócio|cultura|cultural|propriedade|artista|comunidade/.test(text)
  );
}

function labelFromKeywordCluster(value: string): string | null {
  const text = normalize(value);

  if (isCultureBusinessCluster(value)) {
    if (/independencia|independência|propriedade\s+intelectual/.test(text)) {
      return "Autonomia criativa como negocio cultural";
    }
    if (/comunidade|fandom/.test(text)) return "Cultura pop como comunidade";
    return "Cultura pop como negocio";
  }

  if (/humor\s+cotidiano|identificacao\s+rapida|identificação\s+rápida/.test(text)) {
    return "humor cotidiano com identificacao rapida";
  }

  if (/bastidor.*processo.*pauta/.test(text)) {
    return "bastidor, processo e pauta";
  }

  if (/rotina\s+real|vida\s+adulta/.test(text)) {
    return "rotina real com vida adulta";
  }

  if (/autoridade\s+acessivel|autoridade\s+acessível/.test(text)) {
    return "autoridade acessivel na pratica";
  }

  return null;
}

function compactLooseLabel(value: string): string | null {
  const stripped = stripGenericPrefix(value)
    .replace(/\bno\s+super\s+bowl\b/gi, "")
    .replace(/\bde\s+bad\s+bunny\b/gi, "")
    .replace(/\s*,\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return null;

  const cluster = labelFromKeywordCluster(stripped);
  if (cluster) return cluster;

  const firstClause = stripped.split(/[.;:]/)[0]?.trim() ?? stripped;
  if (words(firstClause).length <= 8 && firstClause.length <= 72 && !isLowValueText(firstClause)) {
    return firstClause;
  }

  const meaningful = words(firstClause)
    .map((word) => word.replace(/[^\p{L}\p{N}-]/gu, ""))
    .filter((word) => word.length >= 4 && !STOPWORDS.has(normalize(word)))
    .slice(0, 6);
  return meaningful.length >= 2 ? meaningful.join(" ") : null;
}

export function compactD2CNarrativeLabel(values: Array<string | null | undefined>): string {
  for (const value of values) {
    const text = clean(value);
    if (!text) continue;
    const cluster = labelFromKeywordCluster(text);
    if (cluster) return cluster;
  }

  for (const value of values) {
    const text = clean(value);
    if (!text || isLowValueText(text)) continue;
    const stripped = stripGenericPrefix(text);
    const candidate = compactLooseLabel(stripped);
    if (!candidate || isLowValueText(candidate)) continue;
    return limitSentence(candidate, 90);
  }

  return FALLBACK_NARRATIVE;
}

function inferVideoSubject(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const text = clean(value);
    if (!text) continue;
    const normalized = normalize(text);
    if (/bad\s+bunny|super\s+bowl/.test(normalized)) return "Bad Bunny no Super Bowl";
  }
  return null;
}

function isUsableVideoSubject(value: string | null): boolean {
  if (!value) return false;
  const normalized = normalize(value);
  if (/^(esse|este|o)\s+video\b|^(esse|este|o)\s+v[ií]deo\b/.test(normalized)) return false;
  if (/direcao\s+de\s+conteudo\s+ligada|leitura\s+principal|criador\s+analisa/.test(normalized)) return false;
  return value.length <= 80 && words(value).length <= 10;
}

function buildPointOfView(params: {
  label: string;
  subject: string | null;
  sourceTexts: Array<string | null | undefined>;
}): string {
  const combined = params.sourceTexts.map((item) => clean(item)).filter(Boolean).join(" ");

  if (isCultureBusinessCluster(combined)) {
    return "O creator usa cultura pop para ler autonomia artistica, propriedade intelectual e construcao de comunidade.";
  }

  if (params.subject) {
    return `O creator usa ${params.subject} para sustentar ${params.label.toLowerCase()} como ponto de vista.`;
  }

  return `O video aponta para ${params.label.toLowerCase()} como sinal do mapa narrativo.`;
}

function buildStrategicThesis(params: {
  label: string;
  pointOfView: string;
  sourceTexts: Array<string | null | undefined>;
}): string {
  const useful = params.sourceTexts
    .map((item) => clean(item))
    .filter((item): item is string => Boolean(item))
    .find((item) => !isLowValueText(item) && data2ContentTextKey(item) !== data2ContentTextKey(params.label));

  if (useful && !/^esse\s+v[ií]deo\s+comunica/i.test(useful) && !/^pelo\s+v[ií]deo/i.test(useful)) {
    return limitSentence(stripGenericPrefix(useful), 180);
  }

  return limitSentence(params.pointOfView, 180);
}

export function compactD2CTension(values: Array<string | null | undefined>): string {
  for (const value of values) {
    const text = clean(value);
    if (!text) continue;
    const normalized = normalize(text);

    if (/narrativa\s+nao\s+(?:explicita|explora|deixa\s+claro)|narrativa\s+n[aã]o\s+(?:explicita|explora|deixa\s+claro)/.test(normalized)) {
      return "Separar tema do video de narrativa";
    }
    if (/abertura|gancho|primeiros\s+segundos/.test(normalized)) {
      return "Clarear a abertura narrativa";
    }

    if (!isLowValueText(text)) return limitSentence(stripGenericPrefix(text), 90);
  }

  return FALLBACK_TENSION;
}

export function compactD2CNextExperiment(values: Array<string | null | undefined>): string {
  for (const value of values) {
    const text = clean(value);
    if (!text || isLowValueText(text)) continue;
    return limitSentence(stripGenericPrefix(text), 150);
  }
  return FALLBACK_NEXT_EXPERIMENT;
}

function uniqueTexts(values: string[], maxItems: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = clean(value);
    if (!text) continue;
    const key = data2ContentTextKey(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(limitSentence(text, 80));
    if (result.length >= maxItems) break;
  }
  return result;
}

export function buildData2ContentNarrativeContract(
  input: Data2ContentNarrativeContractInput,
): Data2ContentNarrativeContract {
  const sourceTexts = [
    input.mainNarrative,
    input.whatVideoCommunicates,
    input.strategicReading,
    input.strength,
    input.attentionPoint,
    input.recommendedAdjustment,
    ...(input.creatorSignals ?? []),
    ...(input.brandTerritories ?? []),
  ];
  const inferredSubject = inferVideoSubject([input.videoSubject, ...sourceTexts]);
  const cleanedSubject = clean(input.videoSubject);
  const videoSubject = inferredSubject ?? (isUsableVideoSubject(cleanedSubject) ? cleanedSubject : null);
  const centralNarrativeCandidate = compactD2CNarrativeLabel([
    input.mainNarrative,
    ...(input.creatorSignals ?? []),
    input.whatVideoCommunicates,
    input.strategicReading,
    ...(input.brandTerritories ?? []),
  ]);
  const creatorPointOfView = buildPointOfView({
    label: centralNarrativeCandidate,
    subject: videoSubject,
    sourceTexts,
  });
  const strategicThesis = buildStrategicThesis({
    label: centralNarrativeCandidate,
    pointOfView: creatorPointOfView,
    sourceTexts: [input.strategicReading, input.whatVideoCommunicates, input.strength],
  }) || FALLBACK_THESIS;
  const territories = uniqueTexts([
    ...(input.brandTerritories ?? []),
    ...(input.creatorSignals ?? []),
    centralNarrativeCandidate,
  ], 5);
  const tension = compactD2CTension([
    input.recommendedAdjustment,
    input.attentionPoint,
    input.suggestedHook,
  ]);
  const nextExperiment = compactD2CNextExperiment([
    ...(input.nextActions ?? []),
    input.recommendedAdjustment,
    input.suggestedHook,
  ]);

  return {
    videoSubject,
    creatorPointOfView,
    centralNarrativeCandidate,
    strategicThesis,
    territories,
    tension,
    nextExperiment,
  };
}

export function uniqueD2CTexts(values: Array<string | null | undefined>, maxItems: number): string[] {
  return uniqueTexts(values.map((value) => clean(value)).filter((value): value is string => Boolean(value)), maxItems);
}
