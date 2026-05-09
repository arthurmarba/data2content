import { Types } from 'mongoose';

import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import BrandNarrativeProfile from '@/app/models/BrandNarrativeProfile';
import BrandNarrativeReport, {
  type IBrandNarrativeReport,
  type IBrandNarrativeReportContent,
  type IBrandNarrativeReportEvidencePost,
  type IBrandNarrativeReportMetricsSummary,
  type IBrandNarrativeReportNarrativeFormulaStep,
  type IBrandNarrativeReportPauta,
  type BrandNarrativeReportMatchLevel,
} from '@/app/models/BrandNarrativeReport';
import Metric from '@/app/models/Metric';
import User from '@/app/models/User';

export const BRAND_NARRATIVE_REPORT_DISCLAIMER =
  'Este relatório foi gerado pela Data2Content com base em possível match narrativo entre creator, pauta e marca observada externamente. Isso não indica relação comercial, ação em andamento, aprovação, contato prévio ou registro formal da marca na Data2Content.';

const EVIDENCE_LOOKBACK_DAYS = 180;
const MAX_EVIDENCE_POSTS = 6;

export type CreateBrandNarrativeReportInput = {
  userId: string;
  decision?: Record<string, unknown>;
  pauta?: IBrandNarrativeReportPauta;
  brandMatch: {
    brandId: string;
    brandName: string;
    slug: string;
    category?: string[];
    subcategories?: string[];
    matchScore?: number;
    matchLevel?: BrandNarrativeReportMatchLevel;
    confidenceScore?: number;
    matchedSignals?: string[];
    rationale: string;
    insertionAngle: string;
    suggestedDeliverables: string[];
    suggestedApproachMessage?: string;
    disclaimer: string;
  };
  baseUrl?: string;
};

export type CreateBrandNarrativeReportResult = {
  reportId: string;
  publicSlug: string;
  publicUrl: string;
  status: string;
};

type MetricLike = {
  _id?: unknown;
  id?: unknown;
  description?: string | null;
  postLink?: string | null;
  coverUrl?: string | null;
  thumbnailUrl?: string | null;
  postDate?: Date | string | null;
  format?: string[] | string | null;
  stats?: {
    views?: unknown;
    reach?: unknown;
    likes?: unknown;
    comments?: unknown;
    shares?: unknown;
    saved?: unknown;
    total_interactions?: unknown;
  } | null;
  theme?: string | null;
  context?: string[];
  proposal?: string[];
  contentIntent?: string[];
  narrativeForm?: string[];
  contentSignals?: string[];
  proofStyle?: string[];
  commercialMode?: string[];
};

let reportIndexesPromise: Promise<unknown> | null = null;
const BRAND_REPORT_PUBLIC_DEBUG = process.env.NODE_ENV === 'development';

function ensureReportIndexes() {
  if (!reportIndexesPromise) {
    reportIndexesPromise = BrandNarrativeReport.createIndexes();
  }
  return reportIndexesPromise;
}

function debugPublicReportLookup(message: string, payload?: Record<string, unknown>) {
  if (!BRAND_REPORT_PUBLIC_DEBUG) return;
  console.debug('[BRAND_REPORT_PUBLIC_LOOKUP]', message, payload || {});
}

export function resolveBrandReportAppBaseUrl(requestBaseUrl?: string | null) {
  const candidate =
    requestBaseUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000';
  return candidate.replace(/\/+$/, '');
}

export function resolveBrandReportPublicUrl(publicSlug: string, requestBaseUrl?: string | null) {
  return `${resolveBrandReportAppBaseUrl(requestBaseUrl)}/brand-report/${publicSlug}`;
}

function toObjectId(value?: string | null) {
  if (!value || !Types.ObjectId.isValid(value)) return null;
  return new Types.ObjectId(value);
}

function cleanString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function cleanStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = cleanString(value);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function toSafeNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
}

function normalizeTerm(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ');
}

function tokenize(value?: string | null) {
  return normalizeTerm(value || '')
    .split(/\s+/)
    .map((token) => token.replace(/s$/, ''))
    .filter((token) => token.length > 2);
}

function formatPtBrDecimal(value: number, decimals: number) {
  const factor = 10 ** decimals;
  const truncated = Math.floor(value * factor) / factor;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(truncated).replace(/,0+$/, '');
}

export function formatBrandReportMetricCompact(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1_000_000) {
    const amount = value / 1_000_000;
    return `${formatPtBrDecimal(amount, amount >= 10 ? 1 : 2)}M`;
  }
  if (value >= 1_000) {
    const amount = value / 1_000;
    return `${formatPtBrDecimal(amount, amount >= 10 ? 0 : 1)} mil`;
  }
  return new Intl.NumberFormat('pt-BR').format(Math.round(value));
}

export function formatBrandReportMetricLong(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1_000_000) {
    const amount = value / 1_000_000;
    const formatted = formatPtBrDecimal(amount, amount >= 10 ? 1 : 2);
    return `${formatted} ${amount < 2 ? 'milhão' : 'milhões'}`;
  }
  if (value >= 1_000) {
    const amount = value / 1_000;
    return `${formatPtBrDecimal(amount, amount >= 10 ? 0 : 1)} mil`;
  }
  return new Intl.NumberFormat('pt-BR').format(Math.round(value));
}

function getCreatorDisplayName(user: any) {
  return cleanString(user?.mediaKitDisplayName) || cleanString(user?.name) || cleanString(user?.username) || 'Creator';
}

function getCreatorHandle(user: any) {
  const username = cleanString(user?.username) || cleanString(user?.instagram?.username);
  if (!username) return null;
  return username.startsWith('@') ? username : `@${username}`;
}

function getCreatorProfilePictureUrl(user: any) {
  return (
    cleanString(user?.profile_picture_url) ||
    cleanString(user?.image) ||
    cleanString(user?.providerImage) ||
    cleanString(user?.instagram?.profile_picture_url) ||
    cleanString(user?.instagram?.profilePictureUrl)
  );
}

function resolveMetricFormat(format: MetricLike['format']) {
  if (Array.isArray(format)) return format.find((item) => cleanString(item)) || null;
  return cleanString(format);
}

function buildEvidenceTitle(description?: string | null) {
  const normalized = cleanString(description);
  if (!normalized) return null;
  return normalized.length > 92 ? `${normalized.slice(0, 89).trim()}...` : normalized;
}

export function mapMetricToEvidencePost(metric: MetricLike): IBrandNarrativeReportEvidencePost {
  const stats = metric.stats || {};
  const postDate = metric.postDate ? new Date(metric.postDate) : null;

  return {
    id: String((metric._id as any)?.toString?.() || metric.id || metric.postLink || ''),
    title: buildEvidenceTitle(metric.description),
    description: cleanString(metric.description),
    postLink: cleanString(metric.postLink),
    coverUrl: cleanString(metric.coverUrl) || cleanString(metric.thumbnailUrl),
    postDate: postDate && Number.isFinite(postDate.getTime()) ? postDate : null,
    format: resolveMetricFormat(metric.format),
    views: toSafeNumber(stats.views),
    reach: toSafeNumber(stats.reach),
    likes: toSafeNumber(stats.likes),
    comments: toSafeNumber(stats.comments),
    shares: toSafeNumber(stats.shares),
    saved: toSafeNumber(stats.saved),
    totalInteractions: toSafeNumber(stats.total_interactions),
  };
}

export function summarizeEvidenceMetrics(
  evidencePosts: IBrandNarrativeReportEvidencePost[],
  postsAnalyzed = evidencePosts.length
): IBrandNarrativeReportMetricsSummary {
  const sum = (field: keyof IBrandNarrativeReportEvidencePost) =>
    evidencePosts.reduce((total, post) => {
      const value = post[field];
      return total + (typeof value === 'number' && Number.isFinite(value) ? value : 0);
    }, 0);
  const max = (field: keyof IBrandNarrativeReportEvidencePost) =>
    evidencePosts.reduce<number | null>((top, post) => {
      const value = post[field];
      if (typeof value !== 'number' || !Number.isFinite(value)) return top;
      return top === null ? value : Math.max(top, value);
    }, null);

  const totalViews = sum('views');
  const totalReach = sum('reach');
  const totalInteractions = sum('totalInteractions');
  const evidenceCount = evidencePosts.length;

  return {
    postsAnalyzed,
    evidenceCount,
    totalViews,
    totalReach,
    totalInteractions,
    avgViews: evidenceCount ? Math.round(totalViews / evidenceCount) : null,
    avgInteractions: evidenceCount ? Math.round(totalInteractions / evidenceCount) : null,
    topViews: max('views'),
    topInteractions: max('totalInteractions'),
  };
}

function buildEvidenceSearchTerms(input: CreateBrandNarrativeReportInput) {
  const terms = new Set<string>();
  const add = (value?: string | null) => tokenize(value).forEach((term) => terms.add(term));
  const addList = (values?: string[]) => cleanStringArray(values).forEach(add);

  add(input.pauta?.title);
  add(input.pauta?.description);
  add(input.pauta?.reason);
  add(input.pauta?.theme);
  addList(input.pauta?.keywords);
  addList(input.brandMatch.matchedSignals);
  addList(input.brandMatch.category);
  addList(input.brandMatch.subcategories);

  return terms;
}

function scoreMetricForEvidence(metric: MetricLike, terms: Set<string>) {
  const haystack = [
    metric.description,
    metric.theme,
    ...(metric.context || []),
    ...(metric.proposal || []),
    ...(metric.contentIntent || []),
    ...(metric.narrativeForm || []),
    ...(metric.contentSignals || []),
    ...(metric.proofStyle || []),
    ...(metric.commercialMode || []),
  ]
    .flatMap((value) => tokenize(value))
    .join(' ');

  let termScore = 0;
  terms.forEach((term) => {
    if (haystack.includes(term)) termScore += 1;
  });

  const interactions = toSafeNumber(metric.stats?.total_interactions) || 0;
  const views = toSafeNumber(metric.stats?.views) || 0;
  const recencyMs = metric.postDate ? new Date(metric.postDate).getTime() : 0;
  const recencyScore = Number.isFinite(recencyMs) ? recencyMs / 10000000000000 : 0;

  return termScore * 1000000 + interactions * 3 + views + recencyScore;
}

function selectEvidencePosts(metrics: MetricLike[], input: CreateBrandNarrativeReportInput) {
  const terms = buildEvidenceSearchTerms(input);
  return metrics
    .map((metric) => ({
      metric,
      score: scoreMetricForEvidence(metric, terms),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_EVIDENCE_POSTS)
    .map(({ metric }) => mapMetricToEvidencePost(metric))
    .filter((post) => post.id);
}

type StrategicReportTextParams = {
  creatorName: string;
  brandName: string;
  pauta?: IBrandNarrativeReportPauta;
  match: {
    category?: string[];
    subcategories?: string[];
    matchedSignals?: string[];
    rationale?: string | null;
    insertionAngle?: string | null;
    suggestedDeliverables?: string[];
    suggestedApproachMessage?: string | null;
    disclaimer?: string | null;
  };
  evidencePosts: IBrandNarrativeReportEvidencePost[];
  metricsSummary: IBrandNarrativeReportMetricsSummary;
};

export type BrandNarrativeDeckPresentation = {
  heroThesis: {
    eyebrow: string;
    title: string;
    subtitle: string;
    disclaimer: string;
  };
  organicSeriesProof: {
    title: string;
    summary: string;
    metrics: Array<{ label: string; value: string }>;
  };
  narrativeFormulaTitle: string;
  narrativeFormulaSteps: IBrandNarrativeReportNarrativeFormulaStep[];
  evidenceStoryline: Array<{
    role: string;
    title: string;
    description: string;
    reason: string;
    metricHighlight: string;
    metricLabel: string;
    proof: string | null;
    postLink: string | null;
    coverUrl: string | null;
    metrics: Array<{ label: string; value: string }>;
    tags: string[];
  }>;
  brandMatchMatrix: Array<{
    dimension: string;
    evidence: string;
    brandRelevance: string;
  }>;
  brandInsertionThesis: {
    title: string;
    body: string;
    guardrail: string;
  };
  activationTimeline: Array<{
    phase: string;
    stepLabel: string;
    title: string;
    description: string;
    suggestedFormat: string;
    brandRole: string;
  }>;
  commercialRecap: {
    title: string;
    bullets: string[];
    disclaimer: string;
  };
  suggestedNextStep: string;
  approachMessageTitle: string;
  approachMessageIntro: string;
  finalCta: {
    title: string;
    body: string;
    suggestedMessage: string;
  };
};

const WEAK_REPORT_CHIP_TERMS = new Set([
  'a',
  'as',
  'ao',
  'aos',
  'com',
  'da',
  'das',
  'de',
  'deita',
  'do',
  'dos',
  'e',
  'em',
  'essa',
  'esse',
  'está',
  'esta',
  'mais',
  'não',
  'na',
  'nas',
  'no',
  'nos',
  'o',
  'os',
  'para',
  'pessoa',
  'por',
  'quando',
  'que',
  'seu',
  'sua',
  'tenta',
  'tema base',
  'toca',
  'tocar',
  'um',
  'uma',
  'voce',
  'você',
]);

function hasAnyTerm(values: Array<string | null | undefined>, anchors: string[]) {
  const haystack = values.flatMap((value) => tokenize(value)).join(' ');
  return anchors.some((anchor) => {
    const tokens = tokenize(anchor);
    if (!tokens.length) return false;
    if (tokens.length > 1) return tokens.every((token) => haystack.includes(token));
    const [token] = tokens;
    return Boolean(token && haystack.includes(token));
  });
}

function getCreatorReference(creatorName: string) {
  const cleanName = cleanString(creatorName);
  if (!cleanName || normalizeTerm(cleanName) === 'creator') return 'a criadora';
  return cleanName.split(/\s+/)[0] || cleanName;
}

function cleanSituationText(value?: string | null) {
  const cleanValue = cleanString(value);
  if (!cleanValue) return 'uma situação cotidiana reconhecível';
  return cleanValue
    .replace(/^pov:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^quando\s+/i, '')
    .replace(/^você\s+tenta\s+/i, 'tentar ')
    .replace(/^voce\s+tenta\s+/i, 'tentar ');
}

function isUsefulReportChip(value: string) {
  const normalized = normalizeTerm(value);
  if (!normalized || normalized.length < 3) return false;
  if (WEAK_REPORT_CHIP_TERMS.has(normalized)) return false;
  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length === 0) return false;
  return !tokens.every((token) => WEAK_REPORT_CHIP_TERMS.has(token));
}

function normalizeReportChipDisplay(value: string) {
  const normalized = normalizeTerm(value);
  if (normalized === 'notificacao' || normalized === 'notificacoes') return 'notificações';
  if (normalized === 'equilibrio digital') return 'equilíbrio digital';
  if (normalized === 'bem estar') return 'bem-estar';
  if (normalized === 'rotina digital') return 'rotina digital';
  return value.trim();
}

function pushChip(target: string[], value?: string | null) {
  const cleanValue = cleanString(value);
  if (!cleanValue || !isUsefulReportChip(cleanValue)) return;
  const displayValue = normalizeReportChipDisplay(cleanValue);
  const normalized = normalizeTerm(displayValue);
  if (target.some((item) => normalizeTerm(item) === normalized)) return;
  target.push(displayValue);
}

function resolveReportDomain(params: StrategicReportTextParams) {
  const values = [
    params.brandName,
    params.pauta?.title,
    params.pauta?.description,
    params.pauta?.reason,
    params.pauta?.theme,
    ...(params.pauta?.keywords || []),
    ...(params.match.category || []),
    ...(params.match.subcategories || []),
    ...(params.match.matchedSignals || []),
    params.match.insertionAngle,
    params.match.rationale,
  ];

  if (
    hasAnyTerm(values, [
      'apple',
      'samsung',
      'motorola',
      'claro',
      'vivo',
      'celular',
      'smartphone',
      'notificação',
      'notificações',
      'rotina digital',
      'tecnologia',
      'foco',
      'tempo de tela',
    ])
  ) {
    return 'technology';
  }
  if (
    hasAnyTerm(values, [
      'beleza',
      'autocuidado',
      'cuidado pessoal',
      'skincare',
      'pele',
      'cabelo',
      'fragrância',
      'autoestima',
      'hidratação',
    ])
  ) {
    return 'beauty';
  }
  if (
    hasAnyTerm(values, [
      'alimentação',
      'lanche',
      'chá',
      'comida',
      'saudável',
      'rotina saudável',
      'bem estar',
      'produtos naturais',
    ])
  ) {
    return 'foodWellness';
  }
  if (
    hasAnyTerm(values, [
      'corrida',
      'corredor',
      'corredora',
      'maratona',
      'meia maratona',
      'treino',
      'prova',
      'km',
      'quilômetro',
      'quilometro',
      'running',
      'esporte',
      'esportivo',
      'performance',
      'chegada',
    ])
  ) {
    return 'sportsRunning';
  }
  return 'general';
}

function firstNonEmpty(values: Array<string | null | undefined>) {
  return values.map(cleanString).find(Boolean) || null;
}

function buildSignalPhrase(params: StrategicReportTextParams) {
  const signals = cleanStringArray(params.match.matchedSignals).slice(0, 4);
  if (signals.length >= 2) return signals.join(', ');
  return firstNonEmpty([params.pauta?.theme, params.pauta?.title]) || 'a narrativa proposta';
}

function buildOpportunityThesis(params: StrategicReportTextParams) {
  const domain = resolveReportDomain(params);
  const situation = cleanSituationText(params.pauta?.title);
  if (domain === 'technology') {
    return `A oportunidade está em transformar uma situação cotidiana, ${situation}, em uma narrativa onde ${params.brandName} entra como parte da conversa sobre foco, notificações e equilíbrio digital.`;
  }
  if (domain === 'beauty') {
    return `A oportunidade está em transformar ${situation} em uma narrativa de autocuidado possível, com ${params.brandName} aparecendo como pausa, ritual e cuidado pessoal dentro da rotina real.`;
  }
  if (domain === 'foodWellness') {
    return `A oportunidade está em transformar ${situation} em uma narrativa de pausa saudável, com ${params.brandName} entrando como um gesto simples de equilíbrio no dia a dia.`;
  }
  return `A oportunidade está em conectar ${params.brandName} a uma narrativa orgânica sobre ${buildSignalPhrase(params)}, com presença de marca contextual e sem interromper a história.`;
}

function buildStrategicBrandFit(params: StrategicReportTextParams) {
  const domain = resolveReportDomain(params);
  const insertionAngle = cleanString(params.match.insertionAngle);
  if (domain === 'technology') {
    return `${params.brandName} combina com essa pauta porque a tecnologia é parte do conflito central da narrativa: a tentativa de relaxar é interrompida pelo celular, pelas notificações ou pela rotina digital. A marca pode ser inserida de forma natural ao conectar recursos de foco, organização da rotina digital e uso mais consciente da tecnologia com uma situação cotidiana que a audiência já reconhece.`;
  }
  if (domain === 'beauty') {
    return `${params.brandName} combina com essa pauta porque a narrativa abre espaço para um ritual de autocuidado em uma rotina imperfeita. A marca pode aparecer como cuidado pessoal, pausa breve, autoestima ou conforto sem transformar o conteúdo em uma promessa comercial forçada.`;
  }
  if (domain === 'foodWellness') {
    return `${params.brandName} combina com essa pauta quando o bem-estar aparece como um gesto simples dentro da rotina. A marca pode entrar como chá, lanche, escolha prática ou pequeno ritual de pausa, sustentando a ideia de equilíbrio possível no dia a dia.`;
  }
  return `${cleanString(params.match.rationale) || `${params.brandName} tem aderência aos sinais principais da pauta.`} ${insertionAngle || ''}`.trim();
}

function buildNarrativeFormula(params: StrategicReportTextParams) {
  const domain = resolveReportDomain(params);
  const situation = cleanSituationText(params.pauta?.title);
  const creatorReference = getCreatorReference(params.creatorName);

  if (domain === 'technology') {
    return [
      {
        title: 'Conflito reconhecível',
        description: `${creatorReference} tenta relaxar ou criar uma pausa dentro de ${situation}.`,
      },
      {
        title: 'Desenvolvimento da situação',
        description: 'O celular interrompe a pausa com notificações, excesso de estímulos ou uma rotina digital que a audiência reconhece.',
      },
      {
        title: 'Entrada natural da marca',
        description: `${params.brandName} entra como parte da conversa sobre foco, notificações e equilíbrio digital, sem deslocar a narrativa para uma publi forçada.`,
      },
    ];
  }

  if (domain === 'beauty') {
    return [
      {
        title: 'Conflito reconhecível',
        description: `A rotina sai do controle e transforma ${situation} em uma tentativa imperfeita de pausa.`,
      },
      {
        title: 'Desenvolvimento da situação',
        description: 'A narrativa mostra humor cotidiano, frustração leve e a busca por um momento próprio no meio do caos.',
      },
      {
        title: 'Entrada natural da marca',
        description: `${params.brandName} entra como ritual rápido de autocuidado, cuidado pessoal ou conforto possível dentro da rotina real.`,
      },
    ];
  }

  if (domain === 'foodWellness') {
    return [
      {
        title: 'Conflito reconhecível',
        description: `A pausa desejada aparece dentro de ${situation}, mas a rotina não colabora totalmente.`,
      },
      {
        title: 'Desenvolvimento da situação',
        description: 'O conteúdo explora a tentativa de recuperar equilíbrio por meio de pequenos gestos cotidianos.',
      },
      {
        title: 'Entrada natural da marca',
        description: `${params.brandName} entra como pausa saudável, lanche, chá ou ritual simples de descanso.`,
      },
    ];
  }

  return [
    {
      title: 'Conflito reconhecível',
      description: `A narrativa parte de ${situation}, uma situação fácil de reconhecer na rotina.`,
    },
    {
      title: 'Desenvolvimento da situação',
      description: `A pauta desenvolve os sinais de ${buildSignalPhrase(params)} até criar um contexto claro para a audiência.`,
    },
    {
      title: 'Entrada natural da marca',
      description: `${params.brandName} entra como elemento funcional da história, sem interromper a lógica do conteúdo.`,
    },
  ];
}

function buildCampaignConcept(params: StrategicReportTextParams) {
  const domain = resolveReportDomain(params);
  if (domain === 'technology') return 'Quando a pausa encontra a tecnologia';
  if (domain === 'beauty') return 'Autocuidado possível no meio do caos';
  if (domain === 'foodWellness') return 'Uma pausa saudável dentro da rotina real';
  const theme = firstNonEmpty([params.pauta?.theme, buildSignalPhrase(params)]);
  return theme ? `${params.brandName} dentro de ${theme}` : `Uma narrativa orgânica para ${params.brandName}`;
}

function buildStrategicCampaignIdea(params: StrategicReportTextParams) {
  const domain = resolveReportDomain(params);
  const pautaTitle = cleanString(params.pauta?.title) || 'a pauta selecionada';
  const creatorReference = getCreatorReference(params.creatorName);
  if (domain === 'technology') {
    return `Um Reels em formato POV mostrando ${creatorReference} tentando relaxar, mas sendo interrompida pelo celular. ${params.brandName} entra como parte da solução narrativa: recursos de foco, organização da rotina digital e uma relação mais equilibrada com a tecnologia.`;
  }
  if (domain === 'beauty') {
    return `Um Reels em formato POV partindo de "${pautaTitle}" e mostrando uma pausa de autocuidado possível dentro de uma rotina real. ${params.brandName} entra como ritual rápido, cuidado pessoal ou recurso de autoestima sem esconder o caos cotidiano.`;
  }
  if (domain === 'foodWellness') {
    return `Um Reels em formato POV partindo de "${pautaTitle}" e transformando a pausa em um gesto simples de bem-estar. ${params.brandName} entra como lanche, chá ou escolha prática que ajuda a marcar um intervalo real no dia.`;
  }
  return `Um conteúdo narrativo partindo de "${pautaTitle}", com a marca entrando de forma orgânica no conflito da pauta e na solução cotidiana apresentada pela criadora.`;
}

function buildBrandRole(params: StrategicReportTextParams) {
  const domain = resolveReportDomain(params);
  const creatorReference = getCreatorReference(params.creatorName);
  if (domain === 'technology') {
    return `${params.brandName} entra porque o celular e a tecnologia já fazem parte do conflito central. A marca não precisa interromper a história: ela participa da conversa sobre foco, notificações e uso mais consciente da rotina digital.`;
  }
  if (domain === 'beauty') {
    return `${params.brandName} entra como gesto de autocuidado dentro da rotina de ${creatorReference}. O papel da marca é tornar a pausa possível, não vender uma rotina perfeita.`;
  }
  if (domain === 'foodWellness') {
    return `${params.brandName} entra como pequeno ritual de equilíbrio dentro do dia. O produto funciona como apoio narrativo para a pausa, não como interrupção publicitária.`;
  }
  return `${params.brandName} entra como elemento natural da situação apresentada, conectando o território da marca ao comportamento que a audiência já reconhece.`;
}

function buildOrganicEntry(params: StrategicReportTextParams) {
  const domain = resolveReportDomain(params);
  const creatorReference = getCreatorReference(params.creatorName);
  if (domain === 'technology') {
    return `${params.brandName} pode aparecer como parte da rotina de ${creatorReference}, não como uma interrupção da história. O produto entra no próprio conflito narrativo: o celular que tira a paz, mas também pode ser usado de forma mais consciente.`;
  }
  if (domain === 'beauty') {
    return `${params.brandName} pode aparecer no momento em que ${creatorReference} tenta recuperar uma pausa possível. O produto entra como gesto de cuidado pessoal, não como bloco publicitário separado da narrativa.`;
  }
  if (domain === 'foodWellness') {
    return `${params.brandName} pode entrar como um pequeno ritual de descanso dentro da rotina de ${creatorReference}. O produto funciona melhor quando aparece como pausa prática, não como promessa de transformação.`;
  }
  const insertionAngle = cleanString(params.match.insertionAngle);
  if (insertionAngle) return insertionAngle;
  return `A marca pode entrar como parte funcional da narrativa, conectando ${buildSignalPhrase(params)} a uma situação real da rotina da criadora.`;
}

function buildDeckHeroTitle(params: StrategicReportTextParams) {
  const creatorName = cleanString(params.creatorName);
  if (!creatorName || normalizeTerm(creatorName) === 'creator') {
    return `${params.brandName} dentro de uma narrativa já validada pela audiência.`;
  }
  return `${params.brandName} dentro de uma narrativa já validada pela audiência de ${creatorName}.`;
}

function buildDeckHeroSubtitle(params: StrategicReportTextParams) {
  const domain = resolveReportDomain(params);
  const situation = cleanSituationText(params.pauta?.title);

  if (domain === 'technology') {
    return `A oportunidade está em transformar uma tensão cotidiana, a tentativa de relaxar enquanto o celular interrompe, em uma narrativa onde ${params.brandName} entra de forma natural na conversa sobre foco, notificações e equilíbrio digital.`;
  }
  if (domain === 'beauty') {
    return `A oportunidade está em transformar ${situation} em uma narrativa sobre autocuidado possível, com ${params.brandName} entrando como parte natural de uma rotina real.`;
  }
  if (domain === 'foodWellness') {
    return `A oportunidade está em transformar ${situation} em uma narrativa de pausa e bem-estar, com ${params.brandName} entrando como gesto simples dentro do dia a dia.`;
  }
  if (domain === 'sportsRunning') {
    return `A oportunidade está em transformar uma jornada de esforço, preparação e chegada emocional em uma narrativa onde ${params.brandName} entra de forma natural no contexto da performance.`;
  }
  return `A oportunidade está em transformar ${situation} em uma narrativa orgânica sobre ${buildSignalPhrase(params)}, com ${params.brandName} entrando sem interromper a história.`;
}

function buildEvidenceReading(params: StrategicReportTextParams) {
  const evidenceCount = params.metricsSummary.evidenceCount || 0;
  const totalViews = params.metricsSummary.totalViews || 0;
  const totalInteractions = params.metricsSummary.totalInteractions || 0;
  const evidenceTags = Array.from(
    new Set(params.evidencePosts.flatMap((post) => getBrandReportEvidenceTags(post, params.match.matchedSignals || [])))
  ).slice(0, 4);
  const tagPhrase = evidenceTags.length ? evidenceTags.join(', ') : buildSignalPhrase(params);
  const creatorReference = getCreatorReference(params.creatorName);
  const situation = cleanSituationText(params.pauta?.title);

  if (!evidenceCount) {
    return 'Ainda não há evidências orgânicas suficientes para afirmar recorrência de performance nessa narrativa. Mesmo assim, a fórmula criativa pode ser avaliada como hipótese estratégica antes de uma abordagem comercial.';
  }

  const metricsSentence =
    totalViews > 0 || totalInteractions > 0
      ? ` A base selecionada soma aproximadamente ${formatBrandReportMetricLong(totalViews)} de visualizações e ${formatBrandReportMetricLong(totalInteractions)} de interações.`
      : '';

  return `Os conteúdos selecionados mostram que a audiência responde quando ${creatorReference} transforma ${situation} em ${tagPhrase}. Isso sustenta a entrada de ${params.brandName} porque a campanha parte de uma linguagem já validada organicamente, com menor risco de parecer uma publicidade desconectada.${metricsSentence}`;
}

function buildOrganicProofText(params: StrategicReportTextParams) {
  const evidenceCount = params.metricsSummary.evidenceCount || 0;
  const totalViews = params.metricsSummary.totalViews || 0;
  const totalInteractions = params.metricsSummary.totalInteractions || 0;
  const signalPhrase = buildSignalPhrase(params);

  if (!evidenceCount) {
    return `Este relatório foi gerado com base na pauta selecionada e no encaixe narrativo da marca. Ainda não há volume suficiente de posts orgânicos relacionados para consolidar prova quantitativa específica, então a oportunidade deve ser tratada como hipótese criativa para avaliação manual.`;
  }

  const metricsSentence =
    totalViews > 0 || totalInteractions > 0
      ? ` Os ${evidenceCount} conteúdos selecionados somam aproximadamente ${formatBrandReportMetricLong(totalViews)} de visualizações e ${formatBrandReportMetricLong(totalInteractions)} de interações.`
      : '';

  return `Os conteúdos selecionados mostram que a audiência já responde a narrativas de ${signalPhrase}. Esse comportamento sustenta a oportunidade de inserir a marca em uma história que tem aderência orgânica antes de qualquer abordagem comercial.${metricsSentence}`;
}

function buildApproachMessageForBrand(params: StrategicReportTextParams) {
  return `Olá, equipe ${params.brandName}. Identifiquei uma oportunidade de conteúdo em que ${params.brandName} pode entrar de forma natural em uma narrativa que minha audiência já vem validando organicamente. Preparei um relatório com a tese criativa, evidências de performance e uma sugestão de ativação. Posso enviar para vocês avaliarem?`;
}

function buildDomainSuggestedExecution(params: StrategicReportTextParams) {
  const domain = resolveReportDomain(params);
  if (domain === 'technology') {
    return [
      'Reels POV sobre interrupção digital e tentativa de pausa',
      'Stories mostrando bastidores da rotina digital',
      'Recorte curto com reflexão sobre notificações e foco',
      'Sequência de bastidores com uso cotidiano da tecnologia',
    ];
  }
  if (domain === 'beauty') {
    return [
      'Reels POV com ritual de pausa em meio ao caos',
      'Stories mostrando produto dentro da rotina real',
      'Recorte curto sobre autocuidado possível no dia a dia',
    ];
  }
  if (domain === 'foodWellness') {
    return [
      'Reels com pausa saudável no meio da rotina',
      'Stories mostrando produto como ritual de descanso',
      'Recorte curto sobre rotina equilibrada',
    ];
  }
  return cleanStringArray(params.match.suggestedDeliverables);
}

function buildActivationPlan(params: StrategicReportTextParams) {
  const domain = resolveReportDomain(params);
  if (domain === 'technology') {
    return [
      {
        title: 'Stories de contexto',
        description: 'Apresentar a tentativa de relaxar e o excesso de estímulos digitais na rotina.',
      },
      {
        title: 'Reels principal',
        description: 'POV da pausa interrompida pelo celular, com humor cotidiano e conflito reconhecível.',
      },
      {
        title: 'Entrada da marca',
        description: `${params.brandName} entra pela conversa sobre foco, notificações e uso mais consciente da tecnologia.`,
      },
      {
        title: 'Stories de continuidade',
        description: 'Mostrar bastidores da rotina digital e como a tecnologia aparece no dia a dia.',
      },
      {
        title: 'Recorte pós-campanha',
        description: 'Reflexão leve sobre equilíbrio, presença e relação com as notificações.',
      },
    ];
  }
  if (domain === 'beauty') {
    return [
      {
        title: 'Stories de contexto',
        description: 'Apresentar o caos cotidiano e a tentativa de criar uma pausa possível.',
      },
      {
        title: 'Reels principal',
        description: 'POV com tentativa de pausa, interrupções e humor de rotina real.',
      },
      {
        title: 'Entrada da marca',
        description: `${params.brandName} aparece como ritual rápido de autocuidado dentro da cena, não como anúncio separado.`,
      },
      {
        title: 'Stories de continuidade',
        description: 'Mostrar o produto em uso sem esconder interrupções, pressa ou imperfeições do dia.',
      },
      {
        title: 'Recorte pós-campanha',
        description: 'Fechar com uma reflexão curta sobre autocuidado possível, sem romantizar a rotina.',
      },
    ];
  }
  if (domain === 'foodWellness') {
    return [
      {
        title: 'Stories de contexto',
        description: 'Mostrar o momento em que a rotina pede uma pausa simples.',
      },
      {
        title: 'Reels principal',
        description: 'Narrar a busca por um intervalo real no meio do dia.',
      },
      {
        title: 'Entrada da marca',
        description: `Inserir ${params.brandName} como chá, lanche ou escolha prática que marca a pausa.`,
      },
      {
        title: 'Stories de continuidade',
        description: 'Mostrar o produto como pequeno ritual de descanso e equilíbrio.',
      },
      {
        title: 'Recorte pós-campanha',
        description: 'Retomar a ideia de rotina equilibrada com tom leve e cotidiano.',
      },
    ];
  }

  return [
    {
      title: 'Stories de contexto',
      description: 'Abrir o contexto da pauta e preparar a audiência para o conflito narrativo.',
    },
    {
      title: 'Reels principal',
      description: 'Executar a narrativa principal com conflito, desenvolvimento e resolução cotidiana.',
    },
    {
      title: 'Entrada da marca',
      description: `${params.brandName} entra como parte orgânica da situação, sem interromper a história.`,
    },
    {
      title: 'Stories de continuidade',
      description: 'Mostrar a presença da marca em uso real, sem deslocar o conteúdo para um anúncio isolado.',
    },
    {
      title: 'Recorte pós-campanha',
      description: 'Fechar com aprendizado, comentário ou continuidade da pauta.',
    },
  ];
}

function buildCommercialClose(params: StrategicReportTextParams) {
  return `Essa proposta parte de uma narrativa orgânica já coerente com a audiência de ${params.creatorName}. ${params.brandName} entra em uma história reconhecível, sustentada por dados de performance e com menor risco de parecer uma publicidade desconectada.`;
}

function buildUsefulPautaChips(params: StrategicReportTextParams) {
  const chips: string[] = [];

  const domain = resolveReportDomain(params);
  if (domain === 'technology') {
    ['relaxar', 'celular', 'notificações', 'foco', 'rotina digital', 'equilíbrio digital'].forEach((chip) =>
      pushChip(chips, chip)
    );
  } else if (domain === 'beauty') {
    ['autocuidado', 'pausa', 'rotina real', 'cuidado pessoal'].forEach((chip) => pushChip(chips, chip));
  } else if (domain === 'foodWellness') {
    ['pausa saudável', 'bem-estar', 'rotina equilibrada'].forEach((chip) => pushChip(chips, chip));
  }

  cleanStringArray(params.match.matchedSignals).forEach((chip) => pushChip(chips, chip));
  cleanStringArray(params.pauta?.keywords).forEach((chip) => pushChip(chips, chip));
  pushChip(chips, params.pauta?.theme);
  return chips.slice(0, 8);
}

function buildStrategicReportContent(params: StrategicReportTextParams): IBrandNarrativeReportContent {
  const creatorName = params.creatorName || 'Creator';
  const brandName = params.brandName;
  const pautaTitle = cleanString(params.pauta?.title) || 'pauta selecionada';
  const opportunityThesis = buildOpportunityThesis(params);

  return {
    headline: `Relatório de match narrativo: ${creatorName} + ${brandName}`,
    executiveSummary: opportunityThesis,
    narrativeThesis: opportunityThesis,
    narrativeFormula: buildNarrativeFormula(params),
    brandFit: buildStrategicBrandFit(params),
    evidenceReading: buildEvidenceReading(params),
    organicProof: buildOrganicProofText(params),
    campaignConcept: buildCampaignConcept(params),
    campaignIdea: buildStrategicCampaignIdea(params),
    activationPlan: buildActivationPlan(params),
    brandRole: buildBrandRole(params),
    commercialClose: buildCommercialClose(params),
    suggestedExecution: buildDomainSuggestedExecution(params),
    creatorApproachMessage: buildApproachMessageForBrand(params),
    disclaimer: BRAND_NARRATIVE_REPORT_DISCLAIMER,
  };
}

type BrandReportEvidenceTagPost = Partial<Omit<IBrandNarrativeReportEvidencePost, 'postDate'>> & {
  postDate?: Date | string | null;
};

export function getBrandReportEvidenceTags(post: BrandReportEvidenceTagPost, matchedSignals: string[] = []) {
  const values = [
    post.title,
    post.description,
    post.format,
    ...matchedSignals,
  ];
  const tags: string[] = [];
  const add = (label: string) => {
    if (!tags.includes(label)) tags.push(label);
  };

  if (hasAnyTerm(values, ['humor', 'pov', 'engraçado', 'cotidiano'])) add('Humor cotidiano');
  if (hasAnyTerm(values, ['rotina', 'dia a dia', 'vida real', 'uso cotidiano'])) add('Rotina real');
  if (hasAnyTerm(values, ['relaxar', 'descanso', 'pausa', 'sono'])) add('Relaxamento');
  if (hasAnyTerm(values, ['interrupção', 'interrompido', 'notificação', 'celular', 'toca', 'barulho'])) add('Interrupção');
  if ((post.totalInteractions || 0) >= 10_000) add('Alta interação');

  return tags.slice(0, 3);
}

export function buildPublicBrandNarrativeReportPresentation(report: any) {
  const brandName = cleanString(report?.brand?.brandName) || 'Marca';
  const creatorName = cleanString(report?.creator?.name) || 'Creator';
  const match = report?.match || {};
  const evidencePosts = Array.isArray(report?.evidencePosts) ? report.evidencePosts : [];
  const metricsSummary = report?.metricsSummary || {};
  const content = buildStrategicReportContent({
    creatorName,
    brandName,
    pauta: report?.pauta || {},
    match: {
      category: cleanStringArray(report?.brand?.category),
      subcategories: cleanStringArray(report?.brand?.subcategories),
      matchedSignals: cleanStringArray(match.matchedSignals),
      rationale: cleanString(match.rationale),
      insertionAngle: cleanString(match.insertionAngle),
      suggestedDeliverables: cleanStringArray(match.suggestedDeliverables || report?.reportContent?.suggestedExecution),
      suggestedApproachMessage: cleanString(match.suggestedApproachMessage),
      disclaimer: cleanString(match.disclaimer),
    },
    evidencePosts,
    metricsSummary,
  });
  const presentationParams = {
    creatorName,
    brandName,
    pauta: report?.pauta || {},
    match: {
      category: cleanStringArray(report?.brand?.category),
      subcategories: cleanStringArray(report?.brand?.subcategories),
      matchedSignals: cleanStringArray(match.matchedSignals),
      rationale: cleanString(match.rationale),
      insertionAngle: cleanString(match.insertionAngle),
      suggestedDeliverables: cleanStringArray(match.suggestedDeliverables || report?.reportContent?.suggestedExecution),
      suggestedApproachMessage: cleanString(match.suggestedApproachMessage),
      disclaimer: cleanString(match.disclaimer),
    },
    evidencePosts,
    metricsSummary,
  };

  return {
    content,
    organicEntry: buildOrganicEntry(presentationParams),
    chips: buildUsefulPautaChips(presentationParams),
    metrics: {
      postsAnalyzed: formatBrandReportMetricCompact(metricsSummary.postsAnalyzed),
      evidenceCount: formatBrandReportMetricCompact(metricsSummary.evidenceCount),
      totalViews: formatBrandReportMetricCompact(metricsSummary.totalViews),
      totalInteractions: formatBrandReportMetricCompact(metricsSummary.totalInteractions),
    },
  };
}

function buildDeckMetricList(metricsSummary: Partial<IBrandNarrativeReportMetricsSummary>) {
  return [
    { label: 'Base analisada', value: formatBrandReportMetricCompact(metricsSummary.postsAnalyzed) },
    { label: 'Evidências orgânicas', value: formatBrandReportMetricCompact(metricsSummary.evidenceCount) },
    { label: 'Visualizações', value: formatBrandReportMetricCompact(metricsSummary.totalViews) },
    { label: 'Interações', value: formatBrandReportMetricCompact(metricsSummary.totalInteractions) },
  ];
}

function normalizeDeckMetricsSummary(
  metricsSummary: Partial<IBrandNarrativeReportMetricsSummary>,
  evidencePosts: IBrandNarrativeReportEvidencePost[]
): IBrandNarrativeReportMetricsSummary {
  return {
    postsAnalyzed: metricsSummary.postsAnalyzed || 0,
    evidenceCount: metricsSummary.evidenceCount || evidencePosts.length,
    totalViews: metricsSummary.totalViews || null,
    totalReach: metricsSummary.totalReach || null,
    totalInteractions: metricsSummary.totalInteractions || null,
    avgViews: metricsSummary.avgViews || null,
    avgInteractions: metricsSummary.avgInteractions || null,
    topViews: metricsSummary.topViews || null,
    topInteractions: metricsSummary.topInteractions || null,
  };
}

function buildDeckEvidenceStoryline(
  evidencePosts: IBrandNarrativeReportEvidencePost[],
  params: StrategicReportTextParams
): BrandNarrativeDeckPresentation['evidenceStoryline'] {
  const domain = resolveReportDomain(params);
  const matchedSignals = params.match.matchedSignals || [];
  const situation = cleanSituationText(params.pauta?.title);
  const roleCycle = evidencePosts.length >= 3
    ? ['Conexão', 'Conflito', 'Resolução', 'Prova de performance', 'Entrada natural da marca']
    : ['Conexão', 'Prova de performance'];

  const buildRole = (index: number) => roleCycle[Math.min(index, roleCycle.length - 1)] || 'Prova de performance';
  const buildReason = (post: IBrandNarrativeReportEvidencePost, tags: string[]) => {
    const hasPerformance = (post.views || 0) >= 100_000 || (post.totalInteractions || 0) >= 10_000;
    if (domain === 'technology') {
      return 'Esse conteúdo mostra que celular, notificações e foco já fazem parte do conflito narrativo que a audiência reconhece.';
    }
    if (domain === 'sportsRunning') {
      return 'Esse conteúdo mostra que a audiência acompanha a jornada de esforço, deslocamento e chegada emocional.';
    }
    if (domain === 'beauty') {
      return 'Esse conteúdo mostra que a audiência responde a momentos de pausa, cuidado pessoal e rotina real.';
    }
    if (domain === 'foodWellness') {
      return 'Esse conteúdo mostra que a audiência responde quando a pausa aparece como gesto simples de bem-estar dentro da rotina.';
    }
    if (tags.includes('Alta interação') || hasPerformance) {
      return `Esse conteúdo mostra que a audiência já respondeu a uma narrativa reconhecível sobre ${buildSignalPhrase(params)}.`;
    }
    return `Esse conteúdo ajuda a sustentar a hipótese de que ${situation} pode virar uma narrativa orgânica para a audiência.`;
  };
  const buildMetric = (post: IBrandNarrativeReportEvidencePost) => {
    if ((post.views || 0) > 0) {
      return { metricHighlight: formatBrandReportMetricCompact(post.views), metricLabel: 'visualizações' };
    }
    if ((post.totalInteractions || 0) > 0) {
      return { metricHighlight: formatBrandReportMetricCompact(post.totalInteractions), metricLabel: 'interações' };
    }
    if ((post.reach || 0) > 0) {
      return { metricHighlight: formatBrandReportMetricCompact(post.reach), metricLabel: 'alcance' };
    }
    return { metricHighlight: '0', metricLabel: 'métrica disponível' };
  };

  return evidencePosts.slice(0, 6).map((post, index) => {
    const tags = getBrandReportEvidenceTags(post, matchedSignals);
    const metric = buildMetric(post);
    const metrics = [
      { label: 'Visualizações', value: formatBrandReportMetricCompact(post.views) },
      { label: 'Interações', value: formatBrandReportMetricCompact(post.totalInteractions) },
    ];
    const proofParts: string[] = [];
    if (tags.length) proofParts.push(tags.join(' + '));
    if ((post.views || 0) > 0) proofParts.push(`${formatBrandReportMetricCompact(post.views)} visualizações`);
    if ((post.totalInteractions || 0) > 0) {
      proofParts.push(`${formatBrandReportMetricCompact(post.totalInteractions)} interações`);
    }

    return {
      role: buildRole(index),
      title: cleanString(post.title) || cleanString(post.description) || `Evidência orgânica ${index + 1}`,
      description:
        cleanString(post.description) ||
        'Conteúdo orgânico selecionado como sinal de aderência narrativa com a audiência.',
      reason: buildReason(post, tags),
      metricHighlight: metric.metricHighlight,
      metricLabel: metric.metricLabel,
      proof: proofParts.length ? proofParts.join(' | ') : null,
      postLink: cleanString(post.postLink),
      coverUrl: cleanString(post.coverUrl),
      metrics,
      tags,
    };
  });
}

function buildDeckActivationTimeline(params: StrategicReportTextParams): BrandNarrativeDeckPresentation['activationTimeline'] {
  const domain = resolveReportDomain(params);
  const brandName = params.brandName;
  const formatFromSuggested = (fallback: string) => cleanStringArray(params.match.suggestedDeliverables)[0] || fallback;

  if (domain === 'technology') {
    return [
      {
        phase: 'Etapa 1',
        stepLabel: 'Contexto',
        title: 'Apresentar a tensão cotidiana',
        description: 'Abrir a história com a tentativa de relaxar enquanto o celular, as notificações e os estímulos digitais interrompem a pausa.',
        suggestedFormat: 'Stories ou Reels curto',
        brandRole: `${brandName} pode aparecer primeiro como território da conversa, sem entrar como anúncio.`,
      },
      {
        phase: 'Etapa 2',
        stepLabel: 'Preparação',
        title: 'Mostrar rotina digital e bastidores',
        description: 'Explorar o problema antes da solução: excesso de tela, alertas, rotina corrida e tentativa de criar foco.',
        suggestedFormat: 'Stories de bastidor',
        brandRole: `A presença de ${brandName} pode ser preparada como parte do contexto de uso cotidiano da tecnologia.`,
      },
      {
        phase: 'Etapa 3',
        stepLabel: 'Conteúdo principal',
        title: 'Reels/POV com conflito e entrada da marca',
        description: 'Construir o conteúdo principal em cima do conflito reconhecível e inserir a marca como caminho possível de organização digital.',
        suggestedFormat: formatFromSuggested('Reels/POV'),
        brandRole: `${brandName} pode entrar como parte da conversa sobre foco, notificações e equilíbrio digital.`,
      },
      {
        phase: 'Etapa 4',
        stepLabel: 'Continuidade',
        title: 'Desdobrar uso cotidiano e reflexão',
        description: 'Continuar a narrativa com stories, bastidores ou comentários sobre como a tecnologia aparece na rotina real.',
        suggestedFormat: 'Stories de continuidade',
        brandRole: `A marca pode seguir presente como recurso de rotina, não como interrupção publicitária.`,
      },
      {
        phase: 'Etapa 5',
        stepLabel: 'Pós-campanha',
        title: 'Recorte sobre foco e equilíbrio digital',
        description: 'Fechar com um aprendizado leve sobre presença, foco, notificações e uma relação mais consciente com a tecnologia.',
        suggestedFormat: 'Recorte curto',
        brandRole: `${brandName} pode ser retomada como parte do aprendizado, sem promessa de resultado garantido.`,
      },
    ];
  }

  if (domain === 'sportsRunning') {
    return [
      {
        phase: 'Etapa 1',
        stepLabel: 'Contexto',
        title: 'Apresentar desafio, prova ou objetivo',
        description: 'Abrir a campanha com a meta da jornada: preparação, distância, prova, expectativa ou desafio pessoal.',
        suggestedFormat: 'Stories de contexto',
        brandRole: `${brandName} pode entrar como marca associada ao território da jornada, sem antecipar uma venda.`,
      },
      {
        phase: 'Etapa 2',
        stepLabel: 'Preparação',
        title: 'Treino, kit e bastidores',
        description: 'Mostrar treino, rotina, preparação do kit, deslocamento ou expectativa antes do momento principal.',
        suggestedFormat: 'Stories ou bastidores',
        brandRole: `A marca pode ser explorada como parte real da preparação e do equipamento usado na jornada.`,
      },
      {
        phase: 'Etapa 3',
        stepLabel: 'Conteúdo principal',
        title: 'Jornada de esforço e uso real da marca',
        description: 'Transformar o esforço, o deslocamento e a chegada em uma narrativa principal com presença natural da marca.',
        suggestedFormat: formatFromSuggested('Reels de jornada'),
        brandRole: `${brandName} pode aparecer no uso real durante a experiência, como apoio narrativo da performance.`,
      },
      {
        phase: 'Etapa 4',
        stepLabel: 'Continuidade',
        title: 'Stories durante ou depois da experiência',
        description: 'Desdobrar bastidores, sensação pós-prova, recuperação, comentários da audiência ou detalhes do percurso.',
        suggestedFormat: 'Stories de continuidade',
        brandRole: `A marca pode continuar como parte da experiência vivida, sem virar bloco publicitário isolado.`,
      },
      {
        phase: 'Etapa 5',
        stepLabel: 'Pós-campanha',
        title: 'Resultado, aprendizado e fechamento emocional',
        description: 'Fechar a narrativa com resultado, emoção, aprendizado ou próximos passos da jornada esportiva.',
        suggestedFormat: 'Recorte de fechamento',
        brandRole: `${brandName} pode ser conectada ao significado da jornada, sem prometer resultado esportivo.`,
      },
    ];
  }

  if (domain === 'beauty') {
    return [
      {
        phase: 'Etapa 1',
        stepLabel: 'Contexto',
        title: 'Apresentar rotina real ou tensão cotidiana',
        description: 'Abrir com uma situação imperfeita da rotina: pressa, pausa difícil, autoestima ou tentativa de cuidado.',
        suggestedFormat: 'Stories de contexto',
        brandRole: `${brandName} pode aparecer como território de cuidado possível, sem vender uma rotina perfeita.`,
      },
      {
        phase: 'Etapa 2',
        stepLabel: 'Preparação',
        title: 'Bastidor do ritual ou momento de pausa',
        description: 'Mostrar o antes do ritual: ambiente, rotina, escolha do produto ou tentativa de criar um momento próprio.',
        suggestedFormat: 'Stories de bastidor',
        brandRole: `A marca pode ser preparada como parte do ritual, integrada ao contexto da criadora.`,
      },
      {
        phase: 'Etapa 3',
        stepLabel: 'Conteúdo principal',
        title: 'Transformação possível, cuidado ou ritual',
        description: 'Construir o conteúdo principal em torno de cuidado pessoal possível, sem prometer transformação perfeita.',
        suggestedFormat: formatFromSuggested('Reels de ritual'),
        brandRole: `${brandName} pode entrar como gesto de autocuidado dentro da história, não como anúncio separado.`,
      },
      {
        phase: 'Etapa 4',
        stepLabel: 'Continuidade',
        title: 'Uso e comentários de rotina',
        description: 'Continuar com stories de uso, comentários de rotina e contexto real depois do conteúdo principal.',
        suggestedFormat: 'Stories de continuidade',
        brandRole: `A marca pode seguir presente como parte do cuidado cotidiano e da conversa com a audiência.`,
      },
      {
        phase: 'Etapa 5',
        stepLabel: 'Pós-campanha',
        title: 'Resultado emocional ou aprendizado',
        description: 'Fechar com uma reflexão sobre pausa, autoestima, cuidado possível ou aprendizado da rotina.',
        suggestedFormat: 'Recorte de fechamento',
        brandRole: `${brandName} pode ser retomada pelo papel emocional do cuidado, sem prometer resultado garantido.`,
      },
    ];
  }

  return [
    {
      phase: 'Etapa 1',
      stepLabel: 'Contexto',
      title: 'Abrir a situação que a audiência reconhece',
      description: 'Apresentar o contexto da pauta e o comportamento que já faz sentido na rotina da criadora.',
      suggestedFormat: 'Stories de contexto',
      brandRole: `${brandName} pode ser introduzida como território possível, sem antecipar uma abordagem publicitária.`,
    },
    {
      phase: 'Etapa 2',
      stepLabel: 'Preparação',
      title: 'Preparar o conflito ou desejo da narrativa',
      description: 'Mostrar bastidores, expectativa ou elementos que tornam a entrada da marca mais contextual.',
      suggestedFormat: 'Stories de bastidor',
      brandRole: `A marca pode ser preparada como parte do cenário e da lógica do conteúdo.`,
    },
    {
      phase: 'Etapa 3',
      stepLabel: 'Conteúdo principal',
      title: 'Executar a narrativa principal',
      description: 'Construir o conteúdo com começo, desenvolvimento e entrada natural da marca dentro da história.',
      suggestedFormat: formatFromSuggested('Reels principal'),
      brandRole: `${brandName} pode entrar como elemento funcional da narrativa, sem interromper o conteúdo.`,
    },
    {
      phase: 'Etapa 4',
      stepLabel: 'Continuidade',
      title: 'Desdobrar a presença em uso real',
      description: 'Continuar a conversa com bastidores, stories ou comentários que mantenham a linguagem orgânica.',
      suggestedFormat: 'Stories de continuidade',
      brandRole: `A marca pode seguir presente como parte da rotina, não como peça isolada.`,
    },
    {
      phase: 'Etapa 5',
      stepLabel: 'Pós-campanha',
      title: 'Fechar com aprendizado ou próximo passo',
      description: 'Encerrar com reflexão, recorte ou continuidade editorial da pauta.',
      suggestedFormat: 'Recorte pós-campanha',
      brandRole: `${brandName} pode ser retomada como parte do aprendizado da história, sem promessa de resultado.`,
    },
  ];
}

function buildCommercialRecapTitle(params: StrategicReportTextParams) {
  const domain = resolveReportDomain(params);
  if (domain === 'sportsRunning') return 'Uma jornada pronta para conversa';
  if (domain === 'technology') return 'Uma oportunidade pronta para conversa';
  if (domain === 'beauty') return 'Um ritual pronto para conversa';
  return 'Uma oportunidade pronta para conversa';
}

function buildCommercialRecapBullets(params: StrategicReportTextParams, organicSummary: string, commercialClose?: string | null) {
  const domain = resolveReportDomain(params);
  const creatorReference = getCreatorReference(params.creatorName);
  const evidenceCount = params.metricsSummary.evidenceCount || params.evidencePosts.length || 0;
  const bullets = [
    evidenceCount > 0
      ? 'A oportunidade parte de sinais orgânicos reais: a audiência já respondeu à narrativa antes de qualquer proposta comercial.'
      : 'A oportunidade deve ser tratada como hipótese criativa para validação, já organizada em tese, papel da marca e caminho possível de ativação.',
  ];

  if (domain === 'technology') {
    bullets.push(
      `${params.brandName} pode entrar pela conversa sobre foco, notificações e equilíbrio digital, preservando a linguagem natural de ${creatorReference}.`
    );
  } else if (domain === 'sportsRunning') {
    bullets.push(
      `${params.brandName} pode ser explorada dentro de uma jornada de preparação, esforço e fechamento emocional, sem transformar a história em anúncio isolado.`
    );
  } else if (domain === 'beauty') {
    bullets.push(
      `${params.brandName} pode entrar como parte de um ritual de cuidado possível, mantendo a rotina real como centro da narrativa.`
    );
  } else {
    bullets.push(
      `${params.brandName} pode entrar como parte funcional da história, sem deslocar a linguagem orgânica da criadora.`
    );
  }

  bullets.push(
    cleanString(commercialClose) ||
      organicSummary ||
      'A leitura comercial organiza tese, evidências e sugestão de ativação para facilitar uma conversa objetiva com a marca.'
  );
  bullets.push(
    'O próximo passo é abrir conversa para avaliar aderência, timing e guardrails de marca, sem tratar este relatório como parceria confirmada.'
  );

  return bullets;
}

function buildSuggestedNextStep(params: StrategicReportTextParams) {
  return `Abrir uma conversa consultiva com a equipe ${params.brandName}, compartilhando o relatório como hipótese criativa de ativação para avaliação.`;
}

function buildFinalCtaBody(params: StrategicReportTextParams) {
  const creatorReference = getCreatorReference(params.creatorName);
  const evidenceCount = params.metricsSummary.evidenceCount || params.evidencePosts.length || 0;
  if (!evidenceCount) {
    return `Essa oportunidade organiza uma hipótese criativa de entrada para ${params.brandName}, com uma ativação pensada para preservar a linguagem natural de ${creatorReference}. O próximo passo é avaliar aderência, timing e guardrails antes de qualquer abordagem comercial.`;
  }
  return `Essa oportunidade parte de uma narrativa que já mostrou resposta orgânica da audiência. ${params.brandName} pode entrar como parte da história, com uma ativação pensada para preservar a linguagem natural de ${creatorReference} e transformar o match narrativo em uma conversa comercial mais objetiva.`;
}

export function buildBrandNarrativeDeckPresentation(report: any): BrandNarrativeDeckPresentation {
  const brandName = cleanString(report?.brand?.brandName) || 'Marca';
  const creatorName = cleanString(report?.creator?.name) || 'Creator';
  const match = report?.match || {};
  const evidencePosts = (Array.isArray(report?.evidencePosts) ? report.evidencePosts : []) as IBrandNarrativeReportEvidencePost[];
  const metricsSummary = (report?.metricsSummary || {}) as Partial<IBrandNarrativeReportMetricsSummary>;
  const matchedSignals = cleanStringArray(match.matchedSignals);
  const suggestedExecution = cleanStringArray(match.suggestedDeliverables || report?.reportContent?.suggestedExecution);
  const presentation = buildPublicBrandNarrativeReportPresentation(report);
  const content = presentation.content;
  const strategicParams: StrategicReportTextParams = {
    creatorName,
    brandName,
    pauta: report?.pauta || {},
    match: {
      category: cleanStringArray(report?.brand?.category),
      subcategories: cleanStringArray(report?.brand?.subcategories),
      matchedSignals,
      rationale: cleanString(match.rationale),
      insertionAngle: cleanString(match.insertionAngle),
      suggestedDeliverables: suggestedExecution,
      suggestedApproachMessage: cleanString(match.suggestedApproachMessage),
      disclaimer: cleanString(match.disclaimer),
    },
    evidencePosts,
    metricsSummary: normalizeDeckMetricsSummary(metricsSummary, evidencePosts),
  };
  const narrativeFormulaSteps = Array.isArray(content.narrativeFormula) && content.narrativeFormula.length
    ? content.narrativeFormula
    : buildNarrativeFormula(strategicParams);
  const signalPhrase = buildSignalPhrase(strategicParams);
  const evidenceCount = metricsSummary.evidenceCount || evidencePosts.length;
  const totalViews = metricsSummary.totalViews || 0;
  const totalInteractions = metricsSummary.totalInteractions || 0;
  const metricsPhrase =
    totalViews > 0 || totalInteractions > 0
      ? ` A seleção soma aproximadamente ${formatBrandReportMetricLong(totalViews)} de visualizações e ${formatBrandReportMetricLong(totalInteractions)} de interações.`
      : '';
  const disclaimer = BRAND_NARRATIVE_REPORT_DISCLAIMER;
  const organicSummary = evidenceCount
    ? `A oportunidade parte de ${evidenceCount} conteúdos orgânicos que indicam resposta da audiência a ${signalPhrase}.${metricsPhrase}`
    : 'A oportunidade ainda deve ser tratada como hipótese estratégica: não há evidências orgânicas suficientes para consolidar prova quantitativa específica nessa narrativa.';
  return {
    heroThesis: {
      eyebrow: 'Oportunidade narrativa validada organicamente',
      title: buildDeckHeroTitle(strategicParams),
      subtitle: buildDeckHeroSubtitle(strategicParams) || content.narrativeThesis || content.executiveSummary,
      disclaimer,
    },
    organicSeriesProof: {
      title: 'Prova de narrativa orgânica',
      summary: organicSummary,
      metrics: buildDeckMetricList(metricsSummary),
    },
    narrativeFormulaTitle: content.campaignConcept
      ? `Fórmula narrativa: ${content.campaignConcept}`
      : 'Fórmula narrativa da oportunidade',
    narrativeFormulaSteps,
    evidenceStoryline: buildDeckEvidenceStoryline(evidencePosts, strategicParams),
    brandMatchMatrix: [
      {
        dimension: 'Território narrativo',
        evidence: signalPhrase,
        brandRelevance: content.brandFit,
      },
      {
        dimension: 'Prova orgânica',
        evidence: content.organicProof,
        brandRelevance: `${brandName} entra com mais força quando a leitura comercial parte de um comportamento já observado, não de uma promessa de parceria ou campanha ativa.`,
      },
      {
        dimension: 'Papel da marca',
        evidence: content.brandRole || presentation.organicEntry,
        brandRelevance:
          cleanString(match.insertionAngle) ||
          'A marca aparece como parte funcional da história, preservando a lógica do conteúdo orgânico.',
      },
    ],
    brandInsertionThesis: {
      title: 'Como a marca entra sem parecer publi forçada',
      body: content.brandRole || presentation.organicEntry,
      guardrail:
        'A entrada deve ser apresentada como hipótese de ativação e possibilidade narrativa. Este relatório não indica relação comercial, aprovação, aceite ou campanha ativa da marca.',
    },
    activationTimeline: buildDeckActivationTimeline(strategicParams),
    commercialRecap: {
      title: buildCommercialRecapTitle(strategicParams),
      bullets: buildCommercialRecapBullets(strategicParams, organicSummary, content.commercialClose),
      disclaimer,
    },
    suggestedNextStep: buildSuggestedNextStep(strategicParams),
    approachMessageTitle: 'Mensagem sugerida para abordagem',
    approachMessageIntro:
      'Use este texto como ponto de partida para abrir uma conversa consultiva. Ele apresenta a oportunidade sem assumir parceria, aprovação ou campanha ativa.',
    finalCta: {
      title: 'Próximo passo',
      body: buildFinalCtaBody(strategicParams),
      suggestedMessage: content.creatorApproachMessage,
    },
  };
}

export function buildReportContent(params: {
  creatorName: string;
  brandName: string;
  pauta?: IBrandNarrativeReportPauta;
  match: CreateBrandNarrativeReportInput['brandMatch'];
  evidencePosts: IBrandNarrativeReportEvidencePost[];
  metricsSummary: IBrandNarrativeReportMetricsSummary;
}): IBrandNarrativeReportContent {
  return buildStrategicReportContent(params);
}

export function serializePublicBrandNarrativeReport(report: any) {
  if (!report) return null;
  const brand = report.brand || {};
  return {
    publicSlug: report.publicSlug,
    status: report.status,
    brand: {
      brandName: brand.brandName,
      slug: brand.slug || null,
      category: cleanStringArray(brand.category),
      subcategories: cleanStringArray(brand.subcategories),
    },
    creator: report.creator,
    pauta: report.pauta,
    match: report.match,
    evidencePosts: Array.isArray(report.evidencePosts)
      ? report.evidencePosts.map((post: any) => ({
          title: post.title || null,
          description: post.description || null,
          postLink: post.postLink || null,
          coverUrl: post.coverUrl || null,
          postDate: post.postDate || null,
          format: post.format || null,
          views: typeof post.views === 'number' && Number.isFinite(post.views) ? post.views : null,
          reach: typeof post.reach === 'number' && Number.isFinite(post.reach) ? post.reach : null,
          likes: typeof post.likes === 'number' && Number.isFinite(post.likes) ? post.likes : null,
          comments: typeof post.comments === 'number' && Number.isFinite(post.comments) ? post.comments : null,
          shares: typeof post.shares === 'number' && Number.isFinite(post.shares) ? post.shares : null,
          saved: typeof post.saved === 'number' && Number.isFinite(post.saved) ? post.saved : null,
          totalInteractions:
            typeof post.totalInteractions === 'number' && Number.isFinite(post.totalInteractions)
              ? post.totalInteractions
              : null,
        }))
      : [],
    metricsSummary: report.metricsSummary,
    reportContent: report.reportContent,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
}

export async function getPublicBrandNarrativeReportBySlug(slug: string) {
  const publicSlug = cleanString(slug);
  if (!publicSlug) return null;

  await connectToDatabase();
  debugPublicReportLookup('buscando relatório active por publicSlug', { publicSlug });
  const report = await BrandNarrativeReport.findOne({
    publicSlug,
    status: 'active',
  })
    .select('-userId -decisionSnapshot')
    .lean()
    .exec();

  if (!report && BRAND_REPORT_PUBLIC_DEBUG) {
    const existingReport = await BrandNarrativeReport.findOne({ publicSlug })
      .select('publicSlug status')
      .lean()
      .exec();
    debugPublicReportLookup('relatório active não encontrado', {
      publicSlug,
      foundAnyStatus: Boolean(existingReport),
      status: (existingReport as any)?.status || null,
    });
  } else if (report) {
    debugPublicReportLookup('relatório active encontrado', {
      publicSlug,
      status: (report as any).status,
    });
  }

  return serializePublicBrandNarrativeReport(report);
}

async function fetchCreatorSnapshot(userId: Types.ObjectId) {
  const user = await User.findById(userId)
    .select('name mediaKitDisplayName username profile_picture_url image providerImage mediaKitSlug instagram')
    .lean()
    .exec();

  return {
    user,
    creator: {
      name: getCreatorDisplayName(user),
      handle: getCreatorHandle(user),
      profilePictureUrl: getCreatorProfilePictureUrl(user),
      mediaKitSlug: cleanString((user as any)?.mediaKitSlug),
    },
  };
}

async function fetchEvidenceMetrics(userId: Types.ObjectId) {
  const since = new Date(Date.now() - EVIDENCE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  return Metric.find({
    user: userId,
    postDate: { $gte: since },
  })
    .sort({ postDate: -1 })
    .limit(80)
    .select(
      'description postLink coverUrl thumbnailUrl postDate format stats.views stats.reach stats.likes stats.comments stats.shares stats.saved stats.total_interactions theme context proposal contentIntent narrativeForm contentSignals proofStyle commercialMode'
    )
    .lean()
    .exec();
}

async function resolveBrandSnapshot(input: CreateBrandNarrativeReportInput) {
  const brandObjectId = toObjectId(input.brandMatch.brandId);
  const brandDoc = brandObjectId
    ? await BrandNarrativeProfile.findById(brandObjectId)
        .select('brandName slug category subcategories')
        .lean()
        .exec()
    : await BrandNarrativeProfile.findOne({ slug: input.brandMatch.slug })
        .select('brandName slug category subcategories')
        .lean()
        .exec();

  return {
    brandId: brandObjectId,
    brandName: cleanString((brandDoc as any)?.brandName) || input.brandMatch.brandName,
    slug: cleanString((brandDoc as any)?.slug) || input.brandMatch.slug || null,
    category: cleanStringArray((brandDoc as any)?.category).length
      ? cleanStringArray((brandDoc as any)?.category)
      : cleanStringArray(input.brandMatch.category),
    subcategories: cleanStringArray((brandDoc as any)?.subcategories).length
      ? cleanStringArray((brandDoc as any)?.subcategories)
      : cleanStringArray(input.brandMatch.subcategories),
  };
}

async function createReportWithUniqueSlug(payload: Record<string, unknown>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await BrandNarrativeReport.create(payload);
    } catch (error: any) {
      if (error?.code !== 11000 || attempt === 2) throw error;
      delete payload.publicSlug;
    }
  }
  return BrandNarrativeReport.create(payload);
}

async function incrementBrandReportUsage(brandId?: Types.ObjectId | null) {
  if (!brandId) return;
  try {
    await BrandNarrativeProfile.updateOne(
      { _id: brandId },
      {
        $inc: { 'usageStats.reportsGenerated': 1 },
        $set: { 'usageStats.lastUsedAt': new Date() },
      }
    ).exec();
  } catch (error) {
    logger.warn('[BRAND_NARRATIVE_REPORT] Falha ao atualizar usageStats da marca.', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function createBrandNarrativeReport(
  input: CreateBrandNarrativeReportInput
): Promise<CreateBrandNarrativeReportResult> {
  const userObjectId = toObjectId(input.userId);
  if (!userObjectId) {
    throw new Error('userId inválido para relatório de match narrativo.');
  }

  await connectToDatabase();
  await ensureReportIndexes();

  const [creatorSnapshot, brandSnapshot, metrics] = await Promise.all([
    fetchCreatorSnapshot(userObjectId),
    resolveBrandSnapshot(input),
    fetchEvidenceMetrics(userObjectId),
  ]);

  const evidencePosts = selectEvidencePosts(metrics as MetricLike[], input);
  const metricsSummary = summarizeEvidenceMetrics(evidencePosts, metrics.length);
  const creatorName = creatorSnapshot.creator.name || 'Creator';
  const reportContent = buildReportContent({
    creatorName,
    brandName: brandSnapshot.brandName,
    pauta: input.pauta,
    match: input.brandMatch,
    evidencePosts,
    metricsSummary,
  });

  const report = await createReportWithUniqueSlug({
    userId: userObjectId,
    status: 'active',
    brand: brandSnapshot,
    creator: creatorSnapshot.creator,
    pauta: input.pauta || {},
    decisionSnapshot: input.decision || undefined,
    match: {
      matchScore: input.brandMatch.matchScore ?? null,
      matchLevel: input.brandMatch.matchLevel,
      confidenceScore: input.brandMatch.confidenceScore ?? null,
      matchedSignals: cleanStringArray(input.brandMatch.matchedSignals),
      rationale: input.brandMatch.rationale,
      insertionAngle: input.brandMatch.insertionAngle,
      suggestedDeliverables: cleanStringArray(input.brandMatch.suggestedDeliverables),
      suggestedApproachMessage: cleanString(input.brandMatch.suggestedApproachMessage),
      disclaimer: input.brandMatch.disclaimer,
    },
    evidencePosts,
    metricsSummary,
    reportContent,
  }) as IBrandNarrativeReport;

  await incrementBrandReportUsage(brandSnapshot.brandId);

  return {
    reportId: String(report._id),
    publicSlug: report.publicSlug,
    publicUrl: resolveBrandReportPublicUrl(report.publicSlug, input.baseUrl),
    status: report.status,
  };
}
