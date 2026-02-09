import { normalizeText } from '@/app/lib/intentService';
import {
  PRICING_MULTIPLIERS,
  type CalculatorParams,
  type PubliCalculatorResult,
} from '@/app/lib/pricing/publiCalculator';

type MissingPricingField = 'format' | 'exclusivity' | 'usageRights';

export type ChatPricingParse = {
  params: Partial<CalculatorParams>;
  missing: MissingPricingField[];
  deliverablesSummary: string | null;
  deliverables: {
    reels: number;
    stories: number;
    posts: number;
    total: number;
  };
  assumptions: string[];
  signals: {
    hasDeliverables: boolean;
    hasCommercialTerms: boolean;
    hasPriceIntent: boolean;
  };
};

const PRICE_KEYWORDS = ['preco', 'valor', 'cobrar', 'precificar', 'contraproposta', 'quanto cobrar', 'quanto vale'];
const COMMERCIAL_KEYWORDS = [
  'exclusiv',
  'uso de imagem',
  'direitos de uso',
  'impulsionamento',
  'midia paga',
  'midiapaga',
  'ads',
  'orcamento',
  'proposta',
  'contrato',
  'patrocinio',
  'parceria',
];

const FORMAT_LABELS: Record<CalculatorParams['format'], string> = {
  reels: 'Reels',
  post: 'Post no feed',
  stories: 'Stories',
  pacote: 'Pacote multiformato',
  evento: 'Presença em evento',
};
const EXCLUSIVITY_LABELS: Record<CalculatorParams['exclusivity'], string> = {
  nenhuma: 'Sem exclusividade',
  '7d': 'Exclusividade 7 dias',
  '15d': 'Exclusividade 15 dias',
  '30d': 'Exclusividade 30 dias',
};
const USAGE_LABELS: Record<CalculatorParams['usageRights'], string> = {
  organico: 'Uso organico',
  midiapaga: 'Midia paga/impulsionamento',
  global: 'Uso global/perpetuo',
};
const COMPLEXITY_LABELS: Record<CalculatorParams['complexity'], string> = {
  simples: 'Producao simples',
  roteiro: 'Com roteiro',
  profissional: 'Producao profissional',
};
const AUTHORITY_LABELS: Record<CalculatorParams['authority'], string> = {
  padrao: 'Autoridade padrao',
  ascensao: 'Em ascensao',
  autoridade: 'Autoridade',
  celebridade: 'Celebridade',
};
const SEASONALITY_LABELS: Record<CalculatorParams['seasonality'], string> = {
  normal: 'Sazonalidade normal',
  alta: 'Alta demanda',
  baixa: 'Baixa demanda',
};
const FORMAT_UNIT_LABELS: Record<CalculatorParams['format'], string> = {
  reels: 'Reel',
  post: 'Post',
  stories: 'Story',
  pacote: 'Pacote',
  evento: 'Evento',
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const countMentions = (normalized: string, keywords: string[]) => {
  const group = keywords.map(escapeRegExp).join('|');
  const countRegex = new RegExp(`(\\d+)\\s*(?:${group})\\b`, 'g');
  let count = 0;
  let match: RegExpExecArray | null;
  while ((match = countRegex.exec(normalized))) {
    const value = Number(match[1]);
    if (Number.isFinite(value)) count += value;
  }
  const mentionRegex = new RegExp(`\\b(?:${group})\\b`);
  const mentioned = mentionRegex.test(normalized);
  if (!count && mentioned) count = 1;
  return { count, mentioned };
};

const formatSummary = (parts: Array<{ label: string; count: number; plural?: string }>) => {
  const summary = parts
    .filter((item) => item.count > 0)
    .map((item) => {
      const label = item.count > 1 ? (item.plural || `${item.label}s`) : item.label;
      return `${item.count} ${label}`;
    });
  return summary.length ? summary.join(' + ') : null;
};

const joinLabels = (items: string[]) => {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
};

export function parseChatPricingInput(text: string): ChatPricingParse {
  const normalized = normalizeText(text || '');
  const reels = countMentions(normalized, ['reel', 'reels']);
  const stories = countMentions(normalized, ['story', 'stories', 'storie', 'storys']);
  const posts = countMentions(normalized, ['post', 'posts', 'feed', 'carrossel', 'carousel', 'foto', 'postagem']);

  const totalDeliverables = reels.count + stories.count + posts.count;
  const formatsMentioned = [reels, stories, posts].filter((item) => item.mentioned).length;
  const packageMentioned = normalized.includes('pacote') || normalized.includes('combo');

  let format: CalculatorParams['format'] | undefined;
  let formatExplicit = false;

  if (packageMentioned) {
    format = 'pacote';
    formatExplicit = true;
  } else if (formatsMentioned > 1 || totalDeliverables > 1) {
    format = 'pacote';
  } else if (reels.mentioned) {
    format = 'reels';
    formatExplicit = true;
  } else if (stories.mentioned) {
    format = 'stories';
    formatExplicit = true;
  } else if (posts.mentioned) {
    format = 'post';
    formatExplicit = true;
  }

  let exclusivity: CalculatorParams['exclusivity'] | undefined;
  let exclusivityExplicit = false;
  if (normalized.includes('sem exclusiv') || normalized.includes('nenhuma exclusiv')) {
    exclusivity = 'nenhuma';
    exclusivityExplicit = true;
  } else if (normalized.includes('exclusiv')) {
    const dayMatch =
      normalized.match(/exclusiv[^0-9]{0,10}(\d{1,2})\s*d/) ||
      normalized.match(/(\d{1,2})\s*d[^a-z]{0,10}exclusiv/);
    const dayValue = dayMatch ? Number(dayMatch[1]) : null;
    if (dayValue === 7 || dayValue === 15 || dayValue === 30) {
      exclusivity = `${dayValue}d` as CalculatorParams['exclusivity'];
      exclusivityExplicit = true;
    }
  }

  let usageRights: CalculatorParams['usageRights'] | undefined;
  let usageExplicit = false;
  if (
    normalized.includes('midiapaga') ||
    normalized.includes('midia paga') ||
    normalized.includes('impulsionamento') ||
    normalized.includes('trafego pago') ||
    normalized.includes('ads') ||
    normalized.includes('anuncio')
  ) {
    usageRights = 'midiapaga';
    usageExplicit = true;
  } else if (
    normalized.includes('uso global') ||
    normalized.includes('global') ||
    normalized.includes('perpetuo') ||
    normalized.includes('perpetua') ||
    normalized.includes('tv')
  ) {
    usageRights = 'global';
    usageExplicit = true;
  } else if (
    normalized.includes('organico') ||
    normalized.includes('somente no meu perfil') ||
    normalized.includes('apenas no meu perfil')
  ) {
    usageRights = 'organico';
    usageExplicit = true;
  } else if (normalized.includes('uso de imagem') || normalized.includes('direitos de uso')) {
    usageRights = 'midiapaga';
  }

  let complexity: CalculatorParams['complexity'] = 'simples';
  let complexityExplicit = false;
  if (
    normalized.includes('profissional') ||
    normalized.includes('edicao avancada') ||
    normalized.includes('captacao') ||
    normalized.includes('estudio')
  ) {
    complexity = 'profissional';
    complexityExplicit = true;
  } else if (normalized.includes('roteiro') || normalized.includes('script') || normalized.includes('aprovacao')) {
    complexity = 'roteiro';
    complexityExplicit = true;
  }

  let authority: CalculatorParams['authority'] = 'padrao';
  let authorityExplicit = false;
  if (normalized.includes('celebridade') || normalized.includes('famos')) {
    authority = 'celebridade';
    authorityExplicit = true;
  } else if (normalized.includes('autoridade') || normalized.includes('referencia')) {
    authority = 'autoridade';
    authorityExplicit = true;
  } else if (normalized.includes('ascensao') || normalized.includes('crescendo')) {
    authority = 'ascensao';
    authorityExplicit = true;
  }

  let seasonality: CalculatorParams['seasonality'] = 'normal';
  let seasonalityExplicit = false;
  if (
    normalized.includes('black friday') ||
    normalized.includes('natal') ||
    normalized.includes('alta demanda') ||
    normalized.includes('alta temporada')
  ) {
    seasonality = 'alta';
    seasonalityExplicit = true;
  } else if (
    normalized.includes('baixa demanda') ||
    normalized.includes('baixa temporada') ||
    normalized.includes('janeiro') ||
    /\bpos\b/.test(normalized)
  ) {
    seasonality = 'baixa';
    seasonalityExplicit = true;
  }

  const assumptions: string[] = [];
  if (format && !formatExplicit) assumptions.push('formato pacote (por multiplas entregas)');
  if (usageRights && !usageExplicit) assumptions.push('uso de imagem como midia paga');
  if (!complexityExplicit) assumptions.push(COMPLEXITY_LABELS[complexity].toLowerCase());
  if (!authorityExplicit) assumptions.push(AUTHORITY_LABELS[authority].toLowerCase());
  if (!seasonalityExplicit) assumptions.push(SEASONALITY_LABELS[seasonality].toLowerCase());

  const deliverablesSummary = formatSummary([
    { label: 'Reel', plural: 'Reels', count: reels.count },
    { label: 'Story', plural: 'Stories', count: stories.count },
    { label: 'Post', plural: 'Posts', count: posts.count },
  ]);

  const missing: MissingPricingField[] = [];
  if (!format) missing.push('format');
  if (!exclusivity) missing.push('exclusivity');
  if (!usageRights) missing.push('usageRights');

  const hasDeliverables = Boolean(format || deliverablesSummary || packageMentioned);
  const hasCommercialTerms =
    COMMERCIAL_KEYWORDS.some((kw) => normalized.includes(kw)) ||
    Boolean(exclusivity || usageRights);
  const hasPriceIntent = PRICE_KEYWORDS.some((kw) => normalized.includes(kw));

  return {
    params: {
      format,
      exclusivity,
      usageRights,
      complexity,
      authority,
      seasonality,
    },
    missing,
    deliverablesSummary,
    deliverables: {
      reels: reels.count,
      stories: stories.count,
      posts: posts.count,
      total: totalDeliverables,
    },
    assumptions: assumptions.filter(Boolean),
    signals: {
      hasDeliverables,
      hasCommercialTerms,
      hasPriceIntent,
    },
  };
}

export function shouldHandleChatPricing(parse: ChatPricingParse, previousTopic?: string | null) {
  const topicNorm = normalizeText(previousTopic || '');
  const topicHasPrice = PRICE_KEYWORDS.some((kw) => topicNorm.includes(kw));
  if (parse.signals.hasPriceIntent) return true;
  if (parse.signals.hasDeliverables && (parse.signals.hasCommercialTerms || topicHasPrice)) return true;
  return false;
}

export function buildChatPricingClarification(missing: MissingPricingField[]) {
  const parts: string[] = [];
  if (missing.includes('format')) parts.push('a entrega exata (Reels, Stories, Post ou pacote)');
  if (missing.includes('exclusivity')) parts.push('a exclusividade (nenhuma/7d/15d/30d)');
  if (missing.includes('usageRights')) parts.push('o uso de imagem/impulsionamento (organico, midia paga ou global)');

  const message = parts.length
    ? `Faltam ${joinLabels(parts)} para eu calcular a precificacao.`
    : 'Faltam detalhes para eu calcular a precificacao.';

  const questionParts: string[] = [];
  if (missing.includes('format')) questionParts.push('Qual a entrega exata?');
  if (missing.includes('exclusivity')) questionParts.push('Tem exclusividade?');
  if (missing.includes('usageRights')) questionParts.push('Uso de imagem/impulsionamento?');

  const buttons: string[] = [];
  if (missing.includes('format')) buttons.push('Reels', 'Stories');
  if (missing.includes('exclusivity')) buttons.push('Sem exclusividade', '30 dias');
  if (missing.includes('usageRights')) buttons.push('Uso organico', 'Midia paga');

  return [
    '### Diagnostico',
    message,
    '',
    '### Plano Estrategico',
    'Com esses detalhes eu aplico a calculadora e te devolvo a faixa sugerida.',
    '',
    '### Proximo Passo',
    questionParts.join(' ') || 'Pode detalhar o pacote?',
    '',
    buttons.slice(0, 4).map((label) => `[BUTTON: ${label}]`).join('\n'),
  ].join('\n');
}

export function buildChatPricingResponse(options: {
  calculation: PubliCalculatorResult;
  parse: ChatPricingParse;
}) {
  const currency = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  });

  const { calculation, parse } = options;
  const deliverablesLine = parse.deliverablesSummary
    ? `Pacote detectado: ${parse.deliverablesSummary}.`
    : calculation.params.format
      ? `Entrega detectada: ${FORMAT_LABELS[calculation.params.format]}.`
      : null;
  const packageLine =
    calculation.params.format === 'pacote' ? 'Usei o modo pacote da calculadora para esse combo.' : null;

  const paramsSummary = [
    FORMAT_LABELS[calculation.params.format],
    EXCLUSIVITY_LABELS[calculation.params.exclusivity],
    USAGE_LABELS[calculation.params.usageRights],
    COMPLEXITY_LABELS[calculation.params.complexity],
    AUTHORITY_LABELS[calculation.params.authority],
    SEASONALITY_LABELS[calculation.params.seasonality],
  ].filter(Boolean).join(' | ');

  const assumptionsLine = parse.assumptions.length
    ? `Assumi: ${parse.assumptions.join(', ')}.`
    : null;

  const seedWarning = calculation.cpmSource === 'seed'
    ? 'Aviso: CPM inicial de mercado (sera refinado com publis reais).'
    : null;

  const formatMultipliers = PRICING_MULTIPLIERS.formato;
  const currentFormatMultiplier = formatMultipliers[calculation.params.format] || 1;
  const estimateFormatValue = (format: CalculatorParams['format']) =>
    (calculation.result.justo * (formatMultipliers[format] || 1)) / currentFormatMultiplier;

  const preferredFormats = new Set<CalculatorParams['format']>();
  if (parse.deliverables.reels > 0) preferredFormats.add('reels');
  if (parse.deliverables.stories > 0) preferredFormats.add('stories');
  if (parse.deliverables.posts > 0) preferredFormats.add('post');
  if (!preferredFormats.size) {
    if (calculation.params.format !== 'pacote') preferredFormats.add(calculation.params.format);
    if (calculation.params.format === 'pacote') {
      preferredFormats.add('reels');
      preferredFormats.add('stories');
      preferredFormats.add('post');
    }
  }

  let quantityFormats = Array.from(preferredFormats).filter((format) => format !== 'pacote' && format !== 'evento');
  if (!quantityFormats.length) {
    quantityFormats = ['reels', 'stories', 'post'];
  }

  const quantityLogicLines = [
    'Escala por quantidade (valor justo, mesmas premissas):',
    ...quantityFormats.map((format) => {
      const unitLabel = FORMAT_UNIT_LABELS[format];
      const unitValue = estimateFormatValue(format);
      return `- +1 ${unitLabel}: +${currency.format(unitValue)}.`;
    }),
    `Peso por formato: Reel (${formatMultipliers.reels.toFixed(1)}x) > Post (${formatMultipliers.post.toFixed(1)}x) > Story (${formatMultipliers.stories.toFixed(1)}x).`,
  ];

  const responseLines = [
    '### Diagnostico',
    deliverablesLine,
    packageLine,
    `Faixa sugerida pela calculadora:`,
    `- Estrategico: ${currency.format(calculation.result.estrategico)}`,
    `- Justo: ${currency.format(calculation.result.justo)}`,
    `- Premium: ${currency.format(calculation.result.premium)}`,
    '',
    '### Plano Estrategico',
    calculation.explanation || '',
    paramsSummary ? `Parametros: ${paramsSummary}.` : '',
    assumptionsLine,
    seedWarning,
    '',
    '### Logica Estrategica',
    ...quantityLogicLines,
    '',
    '### Proximo Passo',
    `Quer que eu monte a contraproposta usando o valor justo (${currency.format(calculation.result.justo)}) ou ajusto alguma premissa?`,
    '',
    '[BUTTON: Montar contraproposta]',
    '[BUTTON: Ajustar premissas]',
  ];

  return responseLines
    .filter((line) => line !== null && line !== undefined)
    .join('\n');
}

export function buildChatPricingInsufficientData(message?: string) {
  const safeMessage =
    message ||
    'Nao tenho metricas suficientes para aplicar a calculadora agora.';

  return [
    '### Diagnostico',
    safeMessage,
    '',
    '### Plano Estrategico',
    'Se quiser, posso fazer uma estimativa provisoria com CPM medio de mercado.',
    '',
    '### Proximo Passo',
    'Voce prefere estimar agora ou registrar mais publis?',
    '',
    '[BUTTON: Estimar com CPM medio]',
    '[BUTTON: Registrar novas publis]',
  ].join('\n');
}
