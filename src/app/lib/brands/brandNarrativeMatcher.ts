import { connectToDatabase } from '@/app/lib/mongoose';
import { idsToLabels } from '@/app/lib/classification';
import { v2IdsToLabels } from '@/app/lib/classificationV2';
import { v25IdsToLabels } from '@/app/lib/classificationV2_5';
import BrandNarrativeProfile from '@/app/models/BrandNarrativeProfile';
import type { IBrandNarrativeProfile } from '@/app/models/BrandNarrativeProfile';
import type {
  BrandNarrativeMatchInput,
  BrandNarrativeMatchLevel,
  BrandNarrativeMatchResult,
} from '@/app/lib/brands/brandNarrativeMatchTypes';

export const BRAND_NARRATIVE_MATCH_DISCLAIMER =
  'Marca sugerida por possível match narrativo. Isso não indica relação comercial, ação em andamento ou registro formal da marca na Data2Content.';

const DEFAULT_MATCH_LIMIT = 6;
const MAX_MATCH_LIMIT = 12;
const MIN_RELEVANT_SCORE = 0.18;
const FIELD_MATCH_CAP = 3;
const SCORE_NORMALIZATION_DENOMINATOR = 110;
const CLEAR_DOMAIN_LOW_ANCHOR_SCORE_CAP = 0.6;
const CLEAR_DOMAIN_NO_ANCHOR_SCORE_CAP = 0.55;
const CHILD_FAMILY_NO_CONTEXT_SCORE_CAP = 0.39;
const SPORT_NO_CONTEXT_SCORE_CAP = 0.39;
const MAX_MATCH_SCORE = 0.96;

type BrandNarrativeProfileLike = Pick<
  IBrandNarrativeProfile,
  | '_id'
  | 'brandName'
  | 'slug'
  | 'category'
  | 'subcategories'
  | 'territories'
  | 'contexts'
  | 'narrativeForms'
  | 'contentIntents'
  | 'contentSignals'
  | 'tones'
  | 'proofStyles'
  | 'commercialModes'
  | 'products'
  | 'campaignKeywords'
  | 'avoidContexts'
  | 'insertionIdeas'
  | 'confidenceScore'
>;

type WeightedBrandField =
  | 'category'
  | 'subcategories'
  | 'contexts'
  | 'territories'
  | 'narrativeForms'
  | 'contentIntents'
  | 'commercialModes'
  | 'tones'
  | 'proofStyles'
  | 'campaignKeywords'
  | 'products'
  | 'insertionIdeas';

const FIELD_WEIGHTS: Array<{ field: WeightedBrandField; weight: number }> = [
  { field: 'category', weight: 3.2 },
  { field: 'subcategories', weight: 2.4 },
  { field: 'contexts', weight: 3 },
  { field: 'territories', weight: 3 },
  { field: 'narrativeForms', weight: 2.5 },
  { field: 'contentIntents', weight: 2 },
  { field: 'commercialModes', weight: 2 },
  { field: 'proofStyles', weight: 1.5 },
  { field: 'tones', weight: 1 },
  { field: 'campaignKeywords', weight: 1 },
  { field: 'products', weight: 1 },
  { field: 'insertionIdeas', weight: 1 },
];

const DOMAIN_SCORE_FIELDS: WeightedBrandField[] = [
  'category',
  'subcategories',
  'contexts',
  'territories',
  'products',
  'campaignKeywords',
];

const GENERIC_NARRATIVE_TERMS = new Set([
  'acao',
  'aprendizado',
  'aspiracional',
  'bastidor',
  'base',
  'banco digital',
  'bem',
  'bem estar',
  'conectar',
  'conexao',
  'confianca',
  'conteudo',
  'cotidiano',
  'conquista',
  'cuidado',
  'demonstrar experiencia',
  'demonstrar',
  'descoberta',
  'desafio',
  'depois',
  'digital',
  'evolucao',
  'experiencia',
  'experiencia real',
  'humano',
  'humana',
  'gerar identificacao',
  'gerar',
  'inspiracao',
  'inspirador',
  'inspirar',
  'jornada',
  'dia',
  'lifestyle',
  'pauta',
  'pre evento',
  'preparacao',
  'produto',
  'produto em uso',
  'produto em uso real',
  'real',
  'registrar jornada',
  'resultado',
  'rotina',
  'rotina de trabalho',
  'rotina premium',
  'semana',
  'superacao',
  'transformacao',
  'mostrar',
  'uso',
  'uso cotidiano',
  'vida',
  'estar',
]);

const VERY_LOW_VALUE_TERMS = new Set(['ant', 'antes', 'depois']);

const DOMAIN_ANCHORS: Record<string, string[]> = {
  sport: [
    'corrida',
    'corrida de rua',
    'treino',
    'prova',
    'prova esportiva',
    'meia maratona',
    'maratona',
    'performance',
    'tenis de corrida',
    'tenis',
    'atleta',
    'rua',
    'longao',
    'pace',
    'hidratacao',
    'esporte',
    'esportivo',
    'fitness',
  ],
  beauty: [
    'maquiagem',
    'skincare',
    'pele',
    'cabelo',
    'beleza',
    'perfume',
    'autocuidado',
    'salao',
    'produto de beleza',
    'hidratante',
    'make',
    'dermocosmetico',
  ],
  family: [
    'bebe',
    'filho',
    'mae',
    'maternidade',
    'paternidade',
    'fralda',
    'casa',
    'familia',
    'rotina familiar',
    'infantil',
  ],
  food: [
    'comida',
    'receita',
    'alimentacao',
    'saudavel',
    'delivery',
    'mercado',
    'suplemento',
    'suplementacao',
    'lanche',
    'marmita',
    'pre treino',
    'pos treino',
  ],
  lifestyle_wellness: [
    'bem estar',
    'bem estar digital',
    'autocuidado',
    'descanso',
    'relaxar',
    'relaxamento',
    'rotina saudavel',
    'rotina de bem estar',
    'rotina de autocuidado',
    'saude mental',
    'ansiedade',
    'estresse',
    'pausa',
    'desconexao',
    'desconectar',
    'sono',
    'equilibrio',
    'qualidade de vida',
    'casa',
    'caos domestico',
    'conforto',
    'barulho',
    'obra',
    'humor cotidiano',
    'frustracao leve',
    'ritual',
    'cuidado pessoal',
    'rotina real',
    'celular',
    'smartphone',
    'notificacao',
    'notificacoes',
    'tela',
    'tempo de tela',
    'internet',
    'conexao',
    'conectividade',
    'foco',
    'produtividade',
    'modo descanso',
    'modo nao perturbe',
    'app',
    'aplicativo',
    'tecnologia',
    'telefone',
    'rotina digital',
    'casa conectada',
    'home office',
    'vida saudavel',
    'lanche saudavel',
    'mercado natural',
    'produtos naturais',
  ],
  digital_wellbeing: [
    'celular',
    'smartphone',
    'notificacao',
    'notificacoes',
    'tela',
    'tempo de tela',
    'internet',
    'conexao',
    'desconectar',
    'foco',
    'produtividade',
    'modo descanso',
    'modo nao perturbe',
    'app',
    'aplicativo',
    'tecnologia',
    'rotina digital',
    'bem estar digital',
  ],
  noise_sleep_comfort: [
    'barulho',
    'vizinho',
    'som',
    'som alto',
    'ruido',
    'descanso interrompido',
    'relaxamento interrompido',
    'tentar relaxar',
    'sono',
    'dormir',
    'pausa interrompida',
    'casa',
    'conforto',
    'silencio',
    'fone',
    'fone de ouvido',
    'cancelamento de ruido',
    'audio',
    'musica',
    'caixa de som',
    'rotina domestica',
    'caos domestico',
    'humor cotidiano',
  ],
};

const STOP_WORDS = new Set([
  'a',
  'as',
  'ao',
  'aos',
  'com',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'em',
  'estar',
  'base',
  'bem',
  'dia',
  'pauta',
  'resultado',
  'semana',
  'vida',
  'na',
  'nas',
  'no',
  'nos',
  'o',
  'os',
  'para',
  'por',
  'que',
  'um',
  'uma',
]);

type NarrativeContext = {
  hasLifestyleWellness: boolean;
  hasDomesticChaos: boolean;
  hasDigitalWellbeing: boolean;
  hasNoiseSleepComfort: boolean;
  hasWeakRelaxOnly: boolean;
  hasSportContext: boolean;
  hasChildFamilyContext: boolean;
  contextualSignals: string[];
};

const CHILD_FAMILY_BRAND_TERMS = [
  'bebe',
  'baby',
  'infantil',
  'maternidade',
  'paternidade',
  'filho',
  'filhos',
  'crianca',
  'criancas',
  'familia',
  'rotina familiar',
  'rotina com bebe',
  'cuidado infantil',
  'alimentacao infantil',
  'fralda',
  'fraldas',
  'kit bebe',
  'shampoo infantil',
  'pele delicada',
  'mordedor',
  'mamadeira',
  'chupeta',
];

const CHILD_FAMILY_INPUT_ANCHORS = [
  'bebe',
  'filho',
  'filhos',
  'crianca',
  'criancas',
  'maternidade',
  'mae',
  'pai',
  'paternidade',
  'familia',
  'rotina com bebe',
  'casa com crianca',
  'casa com criancas',
];

const SPORT_BRAND_TERMS = [
  'adidas',
  'nike',
  'asics',
  'garmin',
  'olympikus',
  'decathlon',
  'track field',
  'trackfield',
  'centauro',
  'gatorade',
  'growth supplements',
  'integralmedica',
  'esporte',
  'esportivo',
  'corrida',
  'corrida de rua',
  'performance',
  'treino',
  'prova esportiva',
  'lifestyle esportivo',
  'tenis de corrida',
  'tenis de performance',
  'isotonico',
  'hidratacao esportiva',
  'pace',
  'longao',
  'atleta',
  'fitness',
];

const SPORT_BRAND_NAME_TERMS = SPORT_BRAND_TERMS.slice(0, 12);

const SPORT_INPUT_ANCHORS = [
  'corrida',
  'corrida de rua',
  'treino',
  'prova',
  'prova esportiva',
  'meia maratona',
  'maratona',
  'academia',
  'esporte',
  'performance',
  'atleta',
  'tenis de corrida',
  'hidratacao esportiva',
  'fitness',
  'pace',
  'longao',
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeNarrativeTerm(value: string | null | undefined): string {
  if (!value) return '';
  const normalized = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized
    .split(' ')
    .map((part) => {
      if (part === 'tenis' || part === 'asics') return part;
      if (part.length > 4 && part.endsWith('oes')) return `${part.slice(0, -3)}ao`;
      if (part.length > 4 && part.endsWith('ais')) return `${part.slice(0, -3)}al`;
      if (part.length > 3 && part.endsWith('es')) return part.slice(0, -2);
      if (part.length > 3 && part.endsWith('s')) return part.slice(0, -1);
      return part;
    })
    .join(' ');
}

function pushUnique(target: string[], values: Array<string | null | undefined>) {
  const seen = new Set(target);
  for (const value of values) {
    const normalized = normalizeNarrativeTerm(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    target.push(normalized);
  }
}

function stringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function labelsWithFallback(values: string[] | undefined, resolver: (ids: string[]) => string[]): string[] {
  const raw = stringArray(values);
  const labels = resolver(raw);
  return raw.flatMap((value, index) => {
    const label = labels[index];
    return label && label !== value ? [value, label] : [value];
  });
}

function tokenizeText(value: string | null | undefined): string[] {
  const normalized = normalizeNarrativeTerm(value);
  if (!normalized) return [];
  return normalized
    .split(' ')
    .map((token) => normalizeNarrativeTerm(token))
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

export function buildNarrativeInputTerms(input: BrandNarrativeMatchInput): string[] {
  const terms: string[] = [];
  const decision = input.decision || {};
  const categories = input.categories || {};
  const pauta = input.pauta || {};

  pushUnique(terms, labelsWithFallback(decision.contextId ? [decision.contextId] : [], (ids) => idsToLabels(ids, 'context')));
  pushUnique(terms, labelsWithFallback(decision.proposalId ? [decision.proposalId] : [], (ids) => idsToLabels(ids, 'proposal')));
  pushUnique(terms, labelsWithFallback(decision.toneId ? [decision.toneId] : [], (ids) => idsToLabels(ids, 'tone')));
  pushUnique(terms, labelsWithFallback(decision.referenceId ? [decision.referenceId] : [], (ids) => idsToLabels(ids, 'reference')));
  pushUnique(terms, labelsWithFallback(decision.formatId ? [decision.formatId] : [], (ids) => idsToLabels(ids, 'format')));
  pushUnique(terms, labelsWithFallback(decision.intentId ? [decision.intentId] : [], (ids) => v2IdsToLabels(ids, 'contentIntent')));
  pushUnique(terms, labelsWithFallback(decision.narrativeId ? [decision.narrativeId] : [], (ids) => v2IdsToLabels(ids, 'narrativeForm')));
  pushUnique(terms, [decision.themeId, decision.pautaId, decision.durationId, decision.dayId, decision.hourId]);

  pushUnique(terms, labelsWithFallback(categories.context, (ids) => idsToLabels(ids, 'context')));
  pushUnique(terms, labelsWithFallback(categories.proposal, (ids) => idsToLabels(ids, 'proposal')));
  pushUnique(terms, labelsWithFallback(categories.tone, (ids) => idsToLabels(ids, 'tone')));
  pushUnique(terms, labelsWithFallback(categories.reference, (ids) => idsToLabels(ids, 'reference')));
  pushUnique(terms, labelsWithFallback(categories.contentIntent, (ids) => v2IdsToLabels(ids, 'contentIntent')));
  pushUnique(terms, labelsWithFallback(categories.narrativeForm, (ids) => v2IdsToLabels(ids, 'narrativeForm')));
  pushUnique(terms, labelsWithFallback(categories.contentSignals, (ids) => v2IdsToLabels(ids, 'contentSignal')));
  pushUnique(terms, labelsWithFallback(categories.stance, (ids) => v25IdsToLabels(ids, 'stance')));
  pushUnique(terms, labelsWithFallback(categories.proofStyle, (ids) => v25IdsToLabels(ids, 'proofStyle')));
  pushUnique(terms, labelsWithFallback(categories.commercialMode, (ids) => v25IdsToLabels(ids, 'commercialMode')));

  pushUnique(terms, [
    pauta.title,
    pauta.description,
    pauta.reason,
    pauta.theme,
    ...(Array.isArray(pauta.keywords) ? pauta.keywords : []),
  ]);
  pushUnique(terms, [
    ...tokenizeText(pauta.title),
    ...tokenizeText(pauta.description),
    ...tokenizeText(pauta.reason),
    ...tokenizeText(pauta.theme),
  ]);

  return terms;
}

function buildNarrativeInputSearchText(input: BrandNarrativeMatchInput): string {
  const categories = input.categories || {};
  const pauta = input.pauta || {};
  return normalizeNarrativeTerm(
    [
      pauta.title,
      pauta.description,
      pauta.reason,
      pauta.theme,
      ...(Array.isArray(pauta.keywords) ? pauta.keywords : []),
      ...(categories.context || []),
      ...(categories.proposal || []),
      ...(categories.contentIntent || []),
      ...(categories.narrativeForm || []),
      ...(categories.contentSignals || []),
      ...(categories.proofStyle || []),
      ...(categories.commercialMode || []),
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function hasRawInputPhrase(searchText: string, value: string): boolean {
  const normalized = normalizeNarrativeTerm(value);
  return searchText === normalized || phraseIncludesTerm(searchText, normalized);
}

function hasWeakRelaxOnlyInInput(input: BrandNarrativeMatchInput): boolean {
  const searchText = buildNarrativeInputSearchText(input);
  if (!hasRawInputPhrase(searchText, 'relaxar')) return false;
  return ![
    'autocuidado',
    'cuidado pessoal',
    'pausa',
    'sono',
    'dormir',
    'barulho',
    'vizinho',
    'som',
    'ruido',
    'celular',
    'smartphone',
    'notificacao',
    'notificacoes',
    'rotina digital',
    'bem estar digital',
  ].some((term) => hasRawInputPhrase(searchText, term));
}

function normalizeBrandValues(values: string[] | undefined): string[] {
  const result: string[] = [];
  pushUnique(result, values || []);
  for (const value of values || []) {
    pushUnique(result, tokenizeText(value));
  }
  return result;
}

function phraseIncludesTerm(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  if (haystack === needle) return true;

  const haystackWords = haystack.split(' ').filter(Boolean);
  const needleWords = needle.split(' ').filter(Boolean);
  if (needleWords.length === 0) return false;

  if (needleWords.length === 1) {
    const [needleWord] = needleWords;
    return Boolean(needleWord && haystackWords.includes(needleWord));
  }

  return ` ${haystack} `.includes(` ${needle} `);
}

function termsMatch(inputTerm: string, brandTerm: string): boolean {
  if (!inputTerm || !brandTerm) return false;
  if (phraseIncludesTerm(inputTerm, brandTerm)) return true;
  if (phraseIncludesTerm(brandTerm, inputTerm)) return true;
  return false;
}

function findFieldMatches(inputTerms: string[], brandValues: string[] | undefined): string[] {
  const brandTerms = normalizeBrandValues(brandValues);
  const matches: string[] = [];
  const seen = new Set<string>();

  for (const brandTerm of brandTerms) {
    if (!inputTerms.some((inputTerm) => termsMatch(inputTerm, brandTerm))) continue;
    if (seen.has(brandTerm)) continue;
    seen.add(brandTerm);
    matches.push(brandTerm);
  }

  return matches;
}

function findAvoidContextMatches(inputTerms: string[], avoidContexts: string[] | undefined): string[] {
  const avoidTerms: string[] = [];
  pushUnique(avoidTerms, avoidContexts || []);

  return avoidTerms.filter((avoidTerm) =>
    inputTerms.some((inputTerm) => inputTerm === avoidTerm || phraseIncludesTerm(inputTerm, avoidTerm))
  );
}

function isGenericNarrativeTerm(value: string): boolean {
  if (GENERIC_NARRATIVE_TERMS.has(value) || VERY_LOW_VALUE_TERMS.has(value)) return true;

  const tokens = value.split(' ').filter((token) => token && !STOP_WORDS.has(token));
  return tokens.length > 0 && tokens.every((token) => GENERIC_NARRATIVE_TERMS.has(token) || VERY_LOW_VALUE_TERMS.has(token));
}

function getDomainAnchorsFromTerms(terms: string[], domain: string): string[] {
  const anchors = DOMAIN_ANCHORS[domain] || [];
  const matches: string[] = [];
  const seen = new Set<string>();

  for (const anchor of anchors) {
    const normalizedAnchor = normalizeNarrativeTerm(anchor);
    if (!terms.some((term) => phraseIncludesTerm(term, normalizedAnchor))) continue;
    if (seen.has(normalizedAnchor)) continue;
    seen.add(normalizedAnchor);
    matches.push(normalizedAnchor);
  }

  return matches;
}

function getBrandDomainTerms(brand: BrandNarrativeProfileLike): string[] {
  const values = DOMAIN_SCORE_FIELDS.flatMap((field) => stringArray(brand[field]));
  return normalizeBrandValues(values);
}

function resolveInputDomainProfile(inputTerms: string[]) {
  const domains = Object.keys(DOMAIN_ANCHORS)
    .map((domain) => ({
      domain,
      anchors: getDomainAnchorsFromTerms(inputTerms, domain),
    }))
    .filter((entry) => entry.anchors.length > 0)
    .sort((left, right) => right.anchors.length - left.anchors.length);

  const primary = domains[0] || null;
  return {
    domains,
    primaryDomain: primary?.domain || null,
    primaryAnchors: primary?.anchors || [],
    hasClearDomain: Boolean(primary && primary.anchors.length >= 2),
  };
}

function anchorsCompatible(inputAnchor: string, brandAnchor: string): boolean {
  if (inputAnchor === brandAnchor) return true;

  const anchorFamilies = [
    ['tenis', 'tenis de corrida'],
    ['meia maratona', 'maratona'],
    ['corrida', 'corrida de rua'],
    ['prova', 'prova esportiva'],
    ['treino', 'pre treino', 'pos treino'],
    ['esporte', 'esportivo', 'fitness', 'atleta'],
    ['performance'],
    ['hidratacao'],
    ['pace'],
    ['longao'],
    ['bem estar', 'autocuidado', 'cuidado pessoal', 'rotina de autocuidado', 'rotina saudavel', 'rotina de bem estar'],
    ['relaxar', 'relaxamento', 'descanso', 'pausa', 'sono', 'ritual', 'conforto', 'autocuidado', 'cuidado pessoal'],
    ['saude mental', 'ansiedade', 'estresse', 'equilibrio', 'qualidade de vida', 'pausa', 'desconexao', 'desconectar'],
    ['bem estar digital', 'celular', 'smartphone', 'telefone', 'notificacao', 'notificacoes', 'tela', 'tempo de tela', 'modo descanso', 'modo nao perturbe'],
    ['bem estar digital', 'internet', 'conexao', 'conectividade', 'rotina digital', 'tecnologia', 'app', 'aplicativo', 'produtividade', 'foco'],
    ['casa', 'conforto', 'casa conectada', 'home office'],
    ['barulho', 'som alto', 'som', 'vizinho', 'ruido', 'descanso interrompido', 'relaxamento interrompido', 'pausa interrompida', 'caos domestico', 'rotina domestica', 'humor cotidiano'],
    ['silencio', 'fone', 'fone de ouvido', 'cancelamento de ruido', 'audio', 'musica', 'caixa de som', 'conforto', 'sono', 'descanso'],
    ['rotina saudavel', 'lanche saudavel', 'alimentacao', 'mercado natural', 'produtos naturais', 'vida saudavel'],
  ];

  return anchorFamilies.some(
    (family) => family.includes(inputAnchor) && family.includes(brandAnchor)
  );
}

function resolveBrandDomainAnchorMatches(
  brand: BrandNarrativeProfileLike,
  domain: string | null,
  inputAnchors: string[]
): string[] {
  if (!domain || inputAnchors.length === 0) return [];
  const brandTerms = getBrandDomainTerms(brand);
  const domainAnchors = getDomainAnchorsFromTerms(brandTerms, domain);

  return inputAnchors.filter((inputAnchor) =>
    domainAnchors.some((brandAnchor) => anchorsCompatible(inputAnchor, brandAnchor))
  );
}

function getMatchSpecificityMultiplier(match: string, domainAnchorMatches: string[]): number {
  if (domainAnchorMatches.some((anchor) => termsMatch(match, anchor))) {
    return match.includes(' ') ? 1.55 : 1.35;
  }
  if (VERY_LOW_VALUE_TERMS.has(match)) return 0.08;
  if (GENERIC_NARRATIVE_TERMS.has(match)) return 0.22;
  if (match.includes(' ')) return 1.05;
  return 0.8;
}

function inputHasTerm(inputTerms: string[], value: string): boolean {
  const normalized = normalizeNarrativeTerm(value);
  return inputTerms.some((term) => termsMatch(term, normalized));
}

function inputContainsTerm(inputTerms: string[], value: string): boolean {
  const normalized = normalizeNarrativeTerm(value);
  return inputTerms.some((term) => term === normalized || phraseIncludesTerm(term, normalized));
}

function resolveNarrativeContext(inputTerms: string[]): NarrativeContext {
  const hasLifestyleWellness = [
    'estilo de vida',
    'bem estar',
    'autocuidado',
    'relaxar',
    'descanso',
    'pausa',
    'rotina real',
  ].some((term) => inputHasTerm(inputTerms, term));
  const hasDomesticChaos = [
    'obra',
    'barulho',
    'caos domestico',
    'casa',
    'rotina real',
    'humor cotidiano',
    'frustracao',
  ].filter((term) => inputHasTerm(inputTerms, term)).length >= 2;
  const hasDigitalWellbeing = [
    'celular',
    'notificacao',
    'notificacoes',
    'tempo de tela',
    'bem estar digital',
    'rotina digital',
  ].some((term) => inputHasTerm(inputTerms, term));
  const noiseSleepTerms = [
    'barulho',
    'som alto',
    'som',
    'vizinho',
    'ruido',
    'silencio',
    'fone',
    'fone de ouvido',
    'cancelamento de ruido',
    'audio',
    'musica',
    'caixa de som',
  ];
  const noiseSleepTermCount = noiseSleepTerms.filter((term) => inputHasTerm(inputTerms, term)).length;
  const hasNoiseSleepComfort = noiseSleepTermCount >= 2;
  const hasSportContext = SPORT_INPUT_ANCHORS.some((term) => inputContainsTerm(inputTerms, term));
  const weakRelaxSupportTerms = [
    'autocuidado',
    'cuidado pessoal',
    'pausa',
    'sono',
    'dormir',
    'barulho',
    'vizinho',
    'som',
    'ruido',
    'celular',
    'smartphone',
    'notificacao',
    'notificacoes',
    'rotina digital',
    'bem estar digital',
  ].map(normalizeNarrativeTerm);
  const hasWeakRelaxSupport = weakRelaxSupportTerms.some((supportTerm) =>
    inputTerms.some((inputTerm) => inputTerm === supportTerm || phraseIncludesTerm(inputTerm, supportTerm))
  );
  const hasWeakRelaxOnly =
    inputHasTerm(inputTerms, 'relaxar') &&
    !hasNoiseSleepComfort &&
    !hasDomesticChaos &&
    !hasDigitalWellbeing &&
    !hasSportContext &&
    !hasWeakRelaxSupport;
  const hasChildFamilyContext = CHILD_FAMILY_INPUT_ANCHORS.some((term) => inputContainsTerm(inputTerms, term));
  const contextualSignals: string[] = [];

  if (inputContainsTerm(inputTerms, 'bebe')) contextualSignals.push('bebe');
  if (inputContainsTerm(inputTerms, 'crianca')) contextualSignals.push('crianca');
  if (inputContainsTerm(inputTerms, 'familia')) contextualSignals.push('familia');
  if (inputHasTerm(inputTerms, 'obra')) contextualSignals.push('obra');
  if (inputHasTerm(inputTerms, 'barulho')) contextualSignals.push('barulho');
  if (inputHasTerm(inputTerms, 'vizinho')) contextualSignals.push('vizinho');
  if (inputHasTerm(inputTerms, 'som alto')) contextualSignals.push('som alto');
  if (inputHasTerm(inputTerms, 'som')) contextualSignals.push('som');
  if (inputHasTerm(inputTerms, 'ruido')) contextualSignals.push('ruido');
  if (inputHasTerm(inputTerms, 'silencio')) contextualSignals.push('silencio');
  if (inputHasTerm(inputTerms, 'fone')) contextualSignals.push('fone');
  if (inputHasTerm(inputTerms, 'cancelamento de ruido')) contextualSignals.push('cancelamento de ruido');
  if (inputHasTerm(inputTerms, 'descanso')) contextualSignals.push('descanso');
  if (hasDomesticChaos) contextualSignals.push('caos domestico', 'humor cotidiano');
  if (hasNoiseSleepComfort) contextualSignals.push('pausa interrompida', 'rotina domestica');
  if (inputHasTerm(inputTerms, 'relaxar')) contextualSignals.push('relaxar');
  if (inputHasTerm(inputTerms, 'pausa')) contextualSignals.push('pausa');
  if (inputHasTerm(inputTerms, 'autocuidado')) contextualSignals.push('autocuidado');
  if (inputHasTerm(inputTerms, 'rotina real')) contextualSignals.push('rotina real');

  return {
    hasLifestyleWellness,
    hasDomesticChaos,
    hasDigitalWellbeing,
    hasNoiseSleepComfort,
    hasWeakRelaxOnly:
      hasWeakRelaxOnly &&
      !contextualSignals.some((signal) => !['relaxar', 'rotina real'].includes(signal)),
    hasSportContext,
    hasChildFamilyContext,
    contextualSignals,
  };
}

function brandHasDailyTechnologySignal(brand: BrandNarrativeProfileLike): boolean {
  const brandTerms = normalizeBrandValues([
    ...(brand.products || []),
    ...(brand.campaignKeywords || []),
  ]);
  const dailyTechnologyAnchors = [
    'iphone',
    'galaxy',
    'smartphone',
    'smartphones',
    'celular',
    'plano movel',
    'internet residencial',
    'internet em casa',
    'fibra',
    '5g',
    'servico digital',
    'servicos digitais',
    'rotina digital',
    'conexao confiavel',
    'casa conectada',
    'fone',
    'fones',
    'airpods',
    'galaxy watch',
    'apple watch',
  ].map(normalizeNarrativeTerm);

  return dailyTechnologyAnchors.some((anchor) =>
    brandTerms.some((brandTerm) => brandTerm === anchor || phraseIncludesTerm(brandTerm, anchor))
  );
}

function brandTermsForCopy(brand: BrandNarrativeProfileLike): string[] {
  return normalizeBrandValues([
    ...(brand.category || []),
    ...(brand.subcategories || []),
    ...(brand.territories || []),
    ...(brand.contexts || []),
    ...(brand.products || []),
    ...(brand.campaignKeywords || []),
    ...(brand.insertionIdeas || []),
  ]);
}

function brandHasAnyTerm(brand: BrandNarrativeProfileLike, values: string[]): boolean {
  const brandTerms = brandTermsForCopy(brand);
  return values
    .map(normalizeNarrativeTerm)
    .some((value) => brandTerms.some((term) => termsMatch(term, value)));
}

function isChildFamilyBrand(brand: BrandNarrativeProfileLike): boolean {
  const brandName = normalizeNarrativeTerm(brand.brandName);
  if (CHILD_FAMILY_BRAND_TERMS.some((term) => phraseIncludesTerm(brandName, normalizeNarrativeTerm(term)))) {
    return true;
  }

  const brandTerms = brandTermsForCopy(brand);
  return CHILD_FAMILY_BRAND_TERMS
    .map(normalizeNarrativeTerm)
    .some((value) => brandTerms.some((term) => term === value || phraseIncludesTerm(term, value)));
}

function isSportBrand(brand: BrandNarrativeProfileLike): boolean {
  const brandName = normalizeNarrativeTerm(brand.brandName);
  if (SPORT_BRAND_NAME_TERMS.some((term) => phraseIncludesTerm(brandName, normalizeNarrativeTerm(term)))) {
    return true;
  }

  if (isFoodWellnessBrand(brand) || isBeautyCareBrand(brand) || isChildFamilyBrand(brand)) return false;

  if (SPORT_BRAND_TERMS.some((term) => phraseIncludesTerm(brandName, normalizeNarrativeTerm(term)))) {
    return true;
  }

  const brandTerms = brandTermsForCopy(brand);
  return SPORT_BRAND_TERMS
    .map(normalizeNarrativeTerm)
    .some((value) => brandTerms.some((term) => term === value || phraseIncludesTerm(term, value)));
}

function isBrand(brand: BrandNarrativeProfileLike, value: string): boolean {
  return normalizeNarrativeTerm(brand.brandName) === normalizeNarrativeTerm(value);
}

function isBeautyCareBrand(brand: BrandNarrativeProfileLike): boolean {
  return brandHasAnyTerm(brand, [
    'beleza',
    'skincare',
    'cuidado pessoal',
    'autocuidado',
    'perfume',
    'hidratante',
    'maquiagem',
    'cabelo',
  ]);
}

function isFoodWellnessBrand(brand: BrandNarrativeProfileLike): boolean {
  if (
    isBrand(brand, 'Mundo Verde') ||
    isBrand(brand, 'Bio Mundo') ||
    isBrand(brand, 'Mãe Terra') ||
    isBrand(brand, 'Liv Up') ||
    isBrand(brand, 'Jasmine') ||
    isBrand(brand, 'Taeq')
  ) {
    return true;
  }

  const categories = normalizeBrandValues(brand.category || []);
  const hasFoodCategory = categories.some((category) =>
    ['alimentacao', 'saude', 'bem estar'].some((value) => termsMatch(category, value))
  );
  const isNonFoodCategory = categories.some((category) =>
    ['beleza', 'familia', 'maternidade', 'tecnologia', 'financa', 'esporte'].some((value) =>
      termsMatch(category, value)
    )
  );

  return hasFoodCategory && !isNonFoodCategory;
}

function resolveBrandSpecificSignals(brand: BrandNarrativeProfileLike, context: NarrativeContext): string[] {
  if (!context.hasLifestyleWellness) return [];
  if (context.hasNoiseSleepComfort && brandHasDailyTechnologySignal(brand)) {
    return ['barulho', 'som', 'pausa interrompida'];
  }
  if (isBrand(brand, 'Natura')) return ['autocuidado natural', 'ritual', 'pausa'];
  if (isBrand(brand, 'O Boticário')) return ['fragrancia', 'autoestima', 'cuidado pessoal'];
  if (isBrand(brand, "L'Oréal Paris")) return ['skincare', 'cabelo', 'cuidado pessoal'];
  if (isBrand(brand, 'Nivea')) return ['hidratacao', 'pele', 'cuidado diario', 'conforto'];
  if (isBrand(brand, 'Mundo Verde') || isBrand(brand, 'Bio Mundo')) {
    return ['pausa saudavel', 'produtos naturais', 'rotina saudavel'];
  }
  if (isBrand(brand, 'Mãe Terra')) return ['pausa saudavel', 'lanche natural', 'rotina leve'];
  if (brandHasDailyTechnologySignal(brand)) return ['celular', 'notificacao', 'rotina digital'];
  if (isBeautyCareBrand(brand)) return ['autocuidado', 'cuidado pessoal'];
  return [];
}

function hasLifestyleWellnessSignal(signals: string[]): boolean {
  return signals.some((signal) =>
    [
      'autocuidado',
      'descanso',
      'relaxar',
      'relaxamento',
      'rotina saudavel',
      'saude mental',
      'pausa',
      'desconexao',
      'desconectar',
      'sono',
      'equilibrio',
      'conforto',
      'ritual',
      'cuidado pessoal',
      'celular',
      'smartphone',
      'notificacao',
      'notificacoes',
      'tempo de tela',
      'internet',
      'conexao',
      'foco',
      'produtividade',
      'app',
      'aplicativo',
      'tecnologia',
      'rotina digital',
      'barulho',
      'som',
      'som alto',
      'vizinho',
      'ruido',
      'pausa interrompida',
      'rotina domestica',
      'silencio',
      'fone',
      'audio',
      'musica',
    ].some((anchor) => termsMatch(signal, anchor))
  );
}

function resolveMatchLevel(score: number, hasClearDomain: boolean, domainAnchorMatches: string[]): BrandNarrativeMatchLevel {
  if (score >= 0.7 && (!hasClearDomain || domainAnchorMatches.length > 0)) return 'alto';
  if (score >= 0.4) return 'medio';
  return 'baixo';
}

function humanSignal(signal: string): string {
  return signal.replace(/\s+/g, ' ').trim();
}

function buildRationale(brand: BrandNarrativeProfileLike, matchedSignals: string[], context: NarrativeContext): string {
  if (context.hasNoiseSleepComfort) {
    if (brandHasDailyTechnologySignal(brand)) {
      return `${brand.brandName} combina porque o conflito da pauta é o descanso interrompido pelo som do vizinho. A inserção pode acontecer pelo território de áudio, foco, silêncio ou controle do ambiente sonoro.`;
    }
    if (isBeautyCareBrand(brand)) {
      return `${brand.brandName} combina porque a narrativa mostra uma tentativa de pausa em meio ao ruído doméstico. A inserção funciona como ritual de autocuidado possível mesmo quando o descanso perfeito não acontece.`;
    }
    if (isFoodWellnessBrand(brand)) {
      return `${brand.brandName} combina se a pauta for tratada como pequena pausa de bem-estar no meio do barulho, com produto entrando como chá, lanche ou ritual simples enquanto a casa não colabora.`;
    }
    if (brandHasAnyTerm(brand, ['casa', 'conforto', 'sono', 'silencio', 'rotina domestica'])) {
      return `${brand.brandName} combina porque a pauta fala de conforto, descanso e ambiente doméstico. A marca pode entrar como parte da tentativa de transformar a casa em um espaço de pausa, mesmo com interferências externas.`;
    }
  }

  if (context.hasDomesticChaos) {
    if (isBrand(brand, 'Natura')) {
      return 'A Natura combina com essa pauta porque a narrativa fala de tentar criar um momento de calma mesmo quando a rotina sai do controle. A marca pode entrar pelo território de autocuidado natural, presença e pequenos rituais de respiro dentro de um dia caótico.';
    }
    if (isBrand(brand, 'O Boticário')) {
      return 'O Boticário combina com essa pauta quando o relaxamento vira uma tentativa de recuperar o humor e a autoestima apesar do caos da obra. A marca pode aparecer como fragrância, cuidado pessoal ou ritual rápido para transformar um momento estressante em pausa possível.';
    }
    if (isBrand(brand, "L'Oréal Paris")) {
      return "A L'Oréal Paris combina com essa pauta pelo lado do autocuidado prático em meio à rotina real. A marca pode entrar como cuidado de pele ou cabelo enquanto o criador tenta manter um momento próprio mesmo com barulho, interrupções e bagunça ao redor.";
    }
    if (isBrand(brand, 'Nivea')) {
      return 'Nivea combina com essa pauta pelo cuidado diário e acessível. A marca pode aparecer como hidratação, conforto e pausa simples em um momento em que o descanso perfeito não acontece.';
    }
    if (isFoodWellnessBrand(brand)) {
      return `${brand.brandName} combina se a pauta for tratada como pausa saudável no meio do caos doméstico, com produto entrando como chá, lanche ou pequeno ritual de bem-estar enquanto a obra atrapalha o descanso.`;
    }
    if (brandHasDailyTechnologySignal(brand)) {
      return `${brand.brandName} combina com essa pauta porque o conflito passa pela rotina real em casa e pela tentativa de preservar uma pausa em meio a interrupções. A marca pode entrar como tecnologia cotidiana usada para lidar melhor com barulho, distrações e pequenos limites do dia.`;
    }
    if (isBeautyCareBrand(brand)) {
      const signals = matchedSignals.slice(0, 2).join(' e ') || 'autocuidado';
      return `${brand.brandName} combina com essa pauta pelo território de ${signals} em uma rotina imperfeita. A marca pode aparecer como cuidado rápido para recuperar uma sensação de pausa mesmo quando a obra, o barulho e o caos doméstico quebram o clima.`;
    }
  }

  if (hasLifestyleWellnessSignal(matchedSignals)) {
    if (brandHasDailyTechnologySignal(brand)) {
      return `${brand.brandName} combina porque a pauta fala de rotina, descanso e estímulos digitais. A marca pode entrar pelo uso cotidiano de tecnologia, mostrando equilíbrio na relação com celular, notificações e momentos de pausa.`;
    }
    if (isBeautyCareBrand(brand)) {
      const signals = matchedSignals.slice(0, 3).join(', ');
      return `${brand.brandName} combina porque a pauta fala de pausa e autocuidado dentro de uma rotina real. A inserção pode usar ${signals || 'cuidado pessoal'} como ponto de entrada, sem transformar a pauta em promessa comercial.`;
    }
    if (isFoodWellnessBrand(brand)) {
      return `${brand.brandName} combina porque a pauta pode tratar bem-estar como uma pausa pequena e possível na rotina. O produto entra melhor como lanche, chá ou escolha prática dentro de um momento de descanso real.`;
    }
  }

  const signals = matchedSignals.slice(0, 3).join(', ');
  if (signals) {
    return `A marca combina com essa pauta porque a narrativa cruza ${signals}. A inserção pode acontecer como parte natural da história, sem transformar a pauta em promessa de ação comercial.`;
  }
  return `A marca aparece como uma aproximação possível pelo território narrativo e pelo tipo de contexto da pauta. A inserção deve ser tratada como hipótese de abordagem, não como ação comercial em andamento.`;
}

function buildInsertionAngle(brand: BrandNarrativeProfileLike, matchedSignals: string[], context: NarrativeContext): string {
  if (context.hasNoiseSleepComfort) {
    if (brandHasDailyTechnologySignal(brand)) {
      return 'A marca pode entrar como apoio para lidar com barulho, som alto, foco ou controle do ambiente sonoro durante a tentativa de pausa.';
    }
    if (isBeautyCareBrand(brand)) {
      return 'A marca pode entrar como ritual rápido de autocuidado quando o criador tenta relaxar, mas o som do vizinho quebra o clima.';
    }
    if (isFoodWellnessBrand(brand)) {
      return 'A marca pode entrar como chá, lanche ou pequeno ritual de pausa enquanto o barulho atrapalha o descanso.';
    }
    if (brandHasAnyTerm(brand, ['casa', 'conforto', 'sono', 'silencio', 'rotina domestica'])) {
      return 'A marca pode entrar pelo conforto da casa e pela tentativa de criar um ambiente de descanso mesmo com ruídos externos.';
    }
  }

  if (context.hasDomesticChaos) {
    if (isBrand(brand, 'Natura')) {
      return 'A marca pode entrar como um ritual de autocuidado natural no momento em que o criador tenta recuperar a calma apesar do barulho da obra.';
    }
    if (isBrand(brand, 'O Boticário')) {
      return 'A marca pode entrar como fragrância ou cuidado pessoal usado para marcar uma pausa possível no meio do caos doméstico.';
    }
    if (isBrand(brand, "L'Oréal Paris")) {
      return 'A marca pode entrar como cuidado rápido de pele ou cabelo enquanto o criador tenta manter seu momento de autocuidado mesmo com a obra acontecendo.';
    }
    if (isBrand(brand, 'Nivea')) {
      return 'A marca pode entrar como hidratação e conforto em uma rotina real, onde nem todo momento de descanso sai como planejado.';
    }
    if (isFoodWellnessBrand(brand)) {
      return 'A marca pode entrar como chá, lanche ou pequeno ritual de pausa saudável enquanto o barulho da obra atrapalha o descanso.';
    }
    if (brandHasDailyTechnologySignal(brand)) {
      return 'A marca pode entrar como tecnologia cotidiana usada para reduzir distrações, organizar a pausa ou lidar melhor com uma casa barulhenta.';
    }
  }

  if (hasLifestyleWellnessSignal(matchedSignals)) {
    const hasDigitalSignal = matchedSignals.some((signal) =>
      ['celular', 'smartphone', 'notificacao', 'notificacoes', 'tempo de tela', 'internet', 'conexao', 'tecnologia', 'rotina digital'].some((anchor) =>
        termsMatch(signal, anchor)
      )
    );

    if (hasDigitalSignal) {
      return 'A marca pode entrar mostrando como a tecnologia faz parte da rotina, mas também precisa ser usada com equilíbrio.';
    }

    return 'A marca pode entrar organicamente como ritual de pausa, autocuidado ou conforto dentro de uma rotina real.';
  }

  const idea = brand.insertionIdeas?.[0] || 'produto ou serviço em uso real';
  const signal = matchedSignals[0] || brand.territories?.[0] || 'rotina do criador';
  return `A marca pode entrar organicamente via ${idea}, conectando ${signal} à experiência real do criador.`;
}

function buildDeliverables(brand: BrandNarrativeProfileLike, input: BrandNarrativeMatchInput, context: NarrativeContext): string[] {
  if (context.hasNoiseSleepComfort) {
    if (brandHasDailyTechnologySignal(brand)) {
      return [
        '1 Reels narrativo com pausa interrompida pelo som do vizinho',
        'Stories mostrando áudio, foco ou tecnologia em uso real na rotina',
        'Recorte com humor sobre barulho, casa e tentativa de descanso',
      ];
    }
    if (isBeautyCareBrand(brand)) {
      return [
        '1 Reels narrativo com tentativa de relaxar interrompida pelo som do vizinho',
        'Stories mostrando ritual de autocuidado possível no meio do barulho',
        'Recorte em tom leve sobre tentar pausar mesmo quando a casa não colabora',
      ];
    }
    if (isFoodWellnessBrand(brand)) {
      return [
        '1 Reels narrativo com pausa de bem-estar no meio do barulho',
        'Stories mostrando chá, lanche ou produto como ritual de descanso',
        'Recorte com humor sobre buscar calma apesar do som do vizinho',
      ];
    }
  }

  if (context.hasDomesticChaos) {
    if (isBrand(brand, 'Natura')) {
      return [
        '1 Reels narrativo com tentativa de pausa interrompida pela obra',
        'Stories mostrando ritual de autocuidado natural dentro de uma rotina real e imperfeita',
        'Sequência de pequeno respiro no meio do caos doméstico',
        'Recorte em tom leve sobre tentar relaxar sem romantizar a rotina',
      ];
    }
    if (isBrand(brand, 'O Boticário')) {
      return [
        '1 Reels narrativo com tentativa de pausa interrompida pela obra',
        'Stories mostrando fragrância ou cuidado pessoal como pausa possível no caos',
        'Sequência rápida de autoestima e humor enquanto a obra atrapalha',
        'Recorte em tom leve sobre recuperar o clima sem esconder a rotina real',
      ];
    }
    if (isBrand(brand, "L'Oréal Paris")) {
      return [
        '1 Reels narrativo com tentativa de pausa interrompida pela obra',
        'Stories mostrando skincare ou cuidado de cabelo em uma rotina real e imperfeita',
        'Sequência de autocuidado rápido no meio do caos',
        'Recorte em tom leve sobre manter um momento próprio mesmo com barulho ao redor',
      ];
    }
    if (isBeautyCareBrand(brand)) {
      return [
        '1 Reels narrativo com tentativa de pausa interrompida pela obra',
        'Stories mostrando o produto dentro de uma rotina real e imperfeita',
        'Sequência de autocuidado rápido no meio do caos',
        'Recorte em tom leve sobre tentar relaxar sem romantizar a rotina',
      ];
    }
    if (isFoodWellnessBrand(brand)) {
      return [
        '1 Reels narrativo com pausa saudável no meio do barulho',
        'Stories mostrando chá, lanche ou produto como pequeno ritual de descanso',
        'Recorte com humor sobre buscar calma mesmo quando a casa não colabora',
      ];
    }
    if (brandHasDailyTechnologySignal(brand)) {
      return [
        '1 Reels narrativo sobre tentar pausar enquanto a rotina insiste em interromper',
        'Stories mostrando recurso, app ou aparelho como apoio em uma rotina real',
        'Recorte com humor sobre notificações, barulho e tentativa de foco',
      ];
    }
    return [
      '1 Reels narrativo sobre conforto possível em meio ao caos doméstico',
      'Stories de bastidores da rotina real',
      'Recorte sobre transformar um ambiente imperfeito em momento de pausa',
    ];
  }

  const format = normalizeNarrativeTerm(input.decision?.formatId || '');
  const deliverables = new Set<string>();

  if (format.includes('carousel')) {
    deliverables.add('1 Carrossel narrativo');
  } else if (format.includes('photo')) {
    deliverables.add('1 Foto com legenda narrativa');
  } else {
    deliverables.add('1 Reels narrativo');
  }

  deliverables.add('Stories de bastidores');

  for (const idea of brand.insertionIdeas || []) {
    if (deliverables.size >= 5) break;
    if (normalizeNarrativeTerm(idea).includes('kit') || normalizeNarrativeTerm(idea).includes('recebimento')) {
      deliverables.add('Recebimento de kit');
      continue;
    }
    if (normalizeNarrativeTerm(idea).includes('review')) {
      deliverables.add('Review curto da experiência');
      continue;
    }
    if (normalizeNarrativeTerm(idea).includes('produto') || normalizeNarrativeTerm(idea).includes('uso')) {
      deliverables.add('Reels final com produto em uso');
    }
  }

  if (deliverables.size < 5) deliverables.add('Recorte de aprendizado ou resultado');
  return Array.from(deliverables).slice(0, 5);
}

function buildApproachMessage(): string {
  return 'Tenho uma narrativa orgânica que conversa com os territórios da marca e gostaria de compartilhar uma proposta de conteúdo baseada em dados e encaixe narrativo.';
}

function prioritizeMatchedSignals(signals: string[], domainAnchorMatches: string[]): string[] {
  const uniqueSignals: string[] = [];
  pushUnique(uniqueSignals, [...domainAnchorMatches, ...signals]);

  return uniqueSignals
    .sort((left, right) => {
      const leftExactDomainIndex = domainAnchorMatches.findIndex((anchor) => anchor === left);
      const rightExactDomainIndex = domainAnchorMatches.findIndex((anchor) => anchor === right);
      const leftIsExactDomain = leftExactDomainIndex >= 0;
      const rightIsExactDomain = rightExactDomainIndex >= 0;
      if (leftIsExactDomain !== rightIsExactDomain) return leftIsExactDomain ? -1 : 1;
      if (leftIsExactDomain && rightIsExactDomain && leftExactDomainIndex !== rightExactDomainIndex) {
        return leftExactDomainIndex - rightExactDomainIndex;
      }

      const leftDomainIndex = domainAnchorMatches.findIndex((anchor) => anchorsCompatible(anchor, left));
      const rightDomainIndex = domainAnchorMatches.findIndex((anchor) => anchorsCompatible(anchor, right));
      const leftIsDomain = leftDomainIndex >= 0;
      const rightIsDomain = rightDomainIndex >= 0;
      if (leftIsDomain !== rightIsDomain) return leftIsDomain ? -1 : 1;
      if (leftIsDomain && rightIsDomain && leftDomainIndex !== rightDomainIndex) {
        return leftDomainIndex - rightDomainIndex;
      }

      const leftGeneric = isGenericNarrativeTerm(left);
      const rightGeneric = isGenericNarrativeTerm(right);
      if (leftGeneric !== rightGeneric) return leftGeneric ? 1 : -1;

      return right.length - left.length;
    })
    .filter((signal) => !isGenericNarrativeTerm(signal))
    .map(humanSignal)
    .filter(Boolean)
    .slice(0, 6);
}

export function scoreBrandNarrativeMatch(
  brand: BrandNarrativeProfileLike,
  input: BrandNarrativeMatchInput
): BrandNarrativeMatchResult | null {
  const inputTerms = buildNarrativeInputTerms(input);
  if (inputTerms.length === 0) return null;

  const narrativeContext = resolveNarrativeContext(inputTerms);
  const hasWeakRelaxOnly = hasWeakRelaxOnlyInInput(input);
  const domainProfile = resolveInputDomainProfile(inputTerms);
  const inputHasSpecificTerms = inputTerms.some((term) => !isGenericNarrativeTerm(term));
  const primaryDomainAnchorMatches = resolveBrandDomainAnchorMatches(
    brand,
    domainProfile.primaryDomain,
    domainProfile.primaryAnchors
  );
  const digitalInputAnchors = getDomainAnchorsFromTerms(inputTerms, 'digital_wellbeing');
  const digitalDomainAnchorMatches = resolveBrandDomainAnchorMatches(
    brand,
    'digital_wellbeing',
    digitalInputAnchors
  );
  const domainAnchorMatches = Array.from(new Set([...primaryDomainAnchorMatches, ...digitalDomainAnchorMatches]));
  const domainScore = clamp(domainAnchorMatches.length / 4, 0, 1);
  let rawScore = 0;
  let specificMatchCount = 0;
  const matchedSignals: string[] = [];

  for (const { field, weight } of FIELD_WEIGHTS) {
    const matches = findFieldMatches(inputTerms, brand[field]);
    if (matches.length === 0) continue;

    const cappedCount = Math.min(matches.length, FIELD_MATCH_CAP);
    const weightedMatches = matches
      .slice()
      .sort((left, right) => {
        const leftMultiplier = getMatchSpecificityMultiplier(left, domainAnchorMatches);
        const rightMultiplier = getMatchSpecificityMultiplier(right, domainAnchorMatches);
        return rightMultiplier - leftMultiplier || right.length - left.length;
      })
      .slice(0, cappedCount);

    rawScore += weightedMatches.reduce(
      (sum, match) => sum + weight * getMatchSpecificityMultiplier(match, domainAnchorMatches),
      0
    );
    specificMatchCount += weightedMatches.filter((match) => !isGenericNarrativeTerm(match)).length;
    pushUnique(matchedSignals, weightedMatches);
  }

  const avoidMatches = findAvoidContextMatches(inputTerms, brand.avoidContexts);
  const avoidPenalty = avoidMatches.length > 0 ? Math.min(0.45, avoidMatches.length * 0.22) : 0;
  const confidenceBoost = clamp(Number(brand.confidenceScore) || 0, 0, 1) * 0.06;
  const domainBoost = domainProfile.hasClearDomain && domainAnchorMatches.length > 0 ? domainScore * 0.16 : 0;
  const prePenaltyScore = clamp(rawScore / SCORE_NORMALIZATION_DENOMINATOR + confidenceBoost + domainBoost, 0, MAX_MATCH_SCORE);
  const uncappedScore = clamp(prePenaltyScore * (1 - avoidPenalty), 0, MAX_MATCH_SCORE);
  const domainCappedScore = domainProfile.hasClearDomain
    ? domainAnchorMatches.length === 0
      ? Math.min(uncappedScore, CLEAR_DOMAIN_NO_ANCHOR_SCORE_CAP)
      : domainAnchorMatches.length < 2
        ? Math.min(uncappedScore, CLEAR_DOMAIN_LOW_ANCHOR_SCORE_CAP)
        : uncappedScore
    : uncappedScore;
  const genericCappedScore = !domainProfile.hasClearDomain && (!inputHasSpecificTerms || specificMatchCount === 0)
    ? Math.min(domainCappedScore, 0.65)
    : domainCappedScore;
  const contextualDisplaySignals =
    (narrativeContext.hasDomesticChaos || narrativeContext.hasDigitalWellbeing || narrativeContext.hasNoiseSleepComfort) && domainAnchorMatches.length > 0
      ? [...narrativeContext.contextualSignals, ...resolveBrandSpecificSignals(brand, narrativeContext)]
      : [];
  const displaySignalPriorityAnchors = [
    ...contextualDisplaySignals,
    ...domainAnchorMatches,
  ];
  const cleanSignals = prioritizeMatchedSignals(
    [...matchedSignals, ...contextualDisplaySignals],
    displaySignalPriorityAnchors
  );
  const signalQualityCappedScore = cleanSignals.length > 0 ? genericCappedScore : Math.min(genericCappedScore, 0.39);
  const weakRelaxCappedScore = hasWeakRelaxOnly
    ? Math.min(signalQualityCappedScore, 0.39)
    : signalQualityCappedScore;
  const lifestyleDomainFloor =
    avoidMatches.length === 0 &&
    !hasWeakRelaxOnly &&
    (domainProfile.primaryDomain === 'lifestyle_wellness' || domainProfile.primaryDomain === 'digital_wellbeing') &&
    domainAnchorMatches.length >= 2 &&
    cleanSignals.length > 0
      ? Math.max(weakRelaxCappedScore, 0.42)
      : weakRelaxCappedScore;
  const digitalWellbeingFloor =
    avoidMatches.length === 0 &&
    digitalInputAnchors.length >= 2 &&
    digitalDomainAnchorMatches.length > 0 &&
    brandHasDailyTechnologySignal(brand) &&
    cleanSignals.length > 0
      ? Math.max(lifestyleDomainFloor, 0.8)
      : lifestyleDomainFloor;
  const noiseSleepComfortFloor =
    avoidMatches.length === 0 &&
    narrativeContext.hasNoiseSleepComfort &&
    cleanSignals.length > 0 &&
    (brandHasDailyTechnologySignal(brand) ||
      isBeautyCareBrand(brand) ||
      brandHasAnyTerm(brand, ['casa', 'conforto', 'sono', 'silencio', 'rotina domestica']))
      ? Math.max(digitalWellbeingFloor, 0.46)
      : digitalWellbeingFloor;
  const foodWellnessFloor =
    avoidMatches.length === 0 &&
    !narrativeContext.hasSportContext &&
    isFoodWellnessBrand(brand) &&
    cleanSignals.length > 0
      ? Math.max(noiseSleepComfortFloor, 0.42)
      : noiseSleepComfortFloor;
  const childFamilyContextCappedScore =
    isChildFamilyBrand(brand) && !narrativeContext.hasChildFamilyContext
      ? Math.min(foodWellnessFloor, CHILD_FAMILY_NO_CONTEXT_SCORE_CAP)
      : foodWellnessFloor;
  const sportContextCappedScore =
    isSportBrand(brand) && !narrativeContext.hasSportContext
      ? Math.min(childFamilyContextCappedScore, SPORT_NO_CONTEXT_SCORE_CAP)
      : childFamilyContextCappedScore;
  const matchScore = clamp(sportContextCappedScore, 0, MAX_MATCH_SCORE);

  if (matchScore < MIN_RELEVANT_SCORE && rawScore <= 0) return null;

  return {
    brandId: String(brand._id),
    brandName: brand.brandName,
    slug: brand.slug,
    category: brand.category || [],
    subcategories: brand.subcategories?.length ? brand.subcategories : undefined,
    matchScore: Number(matchScore.toFixed(2)),
    matchLevel: resolveMatchLevel(matchScore, domainProfile.hasClearDomain, domainAnchorMatches),
    confidenceScore: Number((Number(brand.confidenceScore) || 0).toFixed(2)),
    matchedSignals: cleanSignals,
    rationale: buildRationale(brand, cleanSignals, narrativeContext),
    insertionAngle: buildInsertionAngle(brand, cleanSignals, narrativeContext),
    suggestedDeliverables: buildDeliverables(brand, input, narrativeContext),
    suggestedApproachMessage: buildApproachMessage(),
    disclaimer: BRAND_NARRATIVE_MATCH_DISCLAIMER,
  };
}

export function rankBrandNarrativeMatches(
  brands: BrandNarrativeProfileLike[],
  input: BrandNarrativeMatchInput,
  limit = DEFAULT_MATCH_LIMIT
): BrandNarrativeMatchResult[] {
  const safeLimit = clamp(Math.floor(Number(limit) || DEFAULT_MATCH_LIMIT), 1, MAX_MATCH_LIMIT);
  return brands
    .map((brand) => scoreBrandNarrativeMatch(brand, input))
    .filter((match): match is BrandNarrativeMatchResult => Boolean(match))
    .sort((left, right) => right.matchScore - left.matchScore || right.confidenceScore - left.confidenceScore)
    .slice(0, safeLimit);
}

export function normalizeBrandNarrativeMatchLimit(limit: unknown): number {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed)) return DEFAULT_MATCH_LIMIT;
  return clamp(Math.floor(parsed), 1, MAX_MATCH_LIMIT);
}

export async function matchBrandsForNarrative(
  input: BrandNarrativeMatchInput
): Promise<BrandNarrativeMatchResult[]> {
  const limit = normalizeBrandNarrativeMatchLimit(input.limit);
  await connectToDatabase();

  const brands = await BrandNarrativeProfile.find({
    archivedAt: { $exists: false },
    validationStatus: 'validated',
    status: { $in: ['observed_external', 'human_validated', 'ai_generated', 'brand_registered'] },
  })
    .select(
      'brandName slug category subcategories territories contexts narrativeForms contentIntents contentSignals tones proofStyles commercialModes products campaignKeywords avoidContexts insertionIdeas confidenceScore'
    )
    .lean<BrandNarrativeProfileLike[]>();

  return rankBrandNarrativeMatches(brands, input, limit);
}
