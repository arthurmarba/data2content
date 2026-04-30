import { Types } from 'mongoose';
import { getCategoryById } from '@/app/lib/classification';
import { getV2CategoryById } from '@/app/lib/classificationV2';
import { getV25CategoryById } from '@/app/lib/classificationV2_5';
import { logger } from '@/app/lib/logger';
import type { PlannerCategories, PlannerFormat } from '@/types/planner';
import { getBlockSampleCaptions, type BlockCategorySelection } from '@/utils/getBlockSampleCaptions';
import { generatePautaIdeas, type GeneratedPautaIdea } from '@/app/lib/planner/ai';

export type SlotPautasResult = {
  keyword: string;
  pautas: GeneratedPautaIdea[];
  captions: string[];
  source: 'ai';
  retrievalMode: 'strict' | 'focused' | 'relaxed' | 'broad' | 'none';
};

function formatPlannerFormatLabel(format?: string) {
  switch (format) {
    case 'reel':
      return 'Reel';
    case 'photo':
      return 'Foto';
    case 'carousel':
      return 'Carrossel';
    case 'story':
      return 'Story';
    case 'live':
      return 'Live';
    case 'long_video':
      return 'Vídeo longo';
    default:
      return format || 'Formato';
  }
}

function formatPlannerWindowLabel(dayOfWeek?: number, blockStartHour?: number) {
  const weekdays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const day = typeof dayOfWeek === 'number' && Number.isFinite(dayOfWeek)
    ? weekdays[dayOfWeek === 7 ? 0 : dayOfWeek] || null
    : null;
  const hour =
    typeof blockStartHour === 'number' && Number.isFinite(blockStartHour)
      ? `${String(blockStartHour).padStart(2, '0')}h`
      : null;
  return day && hour ? `${day}, ${hour}` : day || hour || null;
}

function formatPlannerDurationLabel(durationId?: string) {
  const normalized = String(durationId || '').trim();
  if (!normalized) return null;
  return normalized;
}

function buildBranchSummary(
  categories: PlannerCategories,
  format?: PlannerFormat,
  dayOfWeek?: number,
  blockStartHour?: number,
  durationId?: string,
) {
  const context = categories.context?.[0] ? getCategoryById(categories.context[0], 'context') : null;
  const proposal = categories.proposal?.[0] ? getCategoryById(categories.proposal[0], 'proposal') : null;
  const tone = categories.tone ? getCategoryById(categories.tone, 'tone') : null;
  const reference = categories.reference?.[0] ? getCategoryById(categories.reference[0], 'reference') : null;
  const contentIntent = categories.contentIntent?.[0]
    ? getV2CategoryById(categories.contentIntent[0], 'contentIntent')
    : null;
  const narrativeForm = categories.narrativeForm?.[0]
    ? getV2CategoryById(categories.narrativeForm[0], 'narrativeForm')
    : null;
  const proofStyle = categories.proofStyle?.[0]
    ? getV25CategoryById(categories.proofStyle[0], 'proofStyle')
    : null;
  const commercialMode = categories.commercialMode?.[0]
    ? getV25CategoryById(categories.commercialMode[0], 'commercialMode')
    : null;
  const formatCategory = (prefix: string, id: string | undefined, category: { label?: string; description?: string } | null | undefined) => {
    if (!id) return null;
    const label = category?.label || id;
    const description = category?.description ? ` - ${category.description}` : '';
    return `${prefix}: ${label}${description}`;
  };

  const summary = [
    formatCategory('Contexto', categories.context?.[0], context),
    formatCategory('Proposta', categories.proposal?.[0], proposal),
    formatCategory('Tom', categories.tone, tone),
    formatCategory('Referência', categories.reference?.[0], reference),
    formatCategory('Intenção', categories.contentIntent?.[0], contentIntent),
    formatCategory('Narrativa', categories.narrativeForm?.[0], narrativeForm),
    formatCategory('Prova', categories.proofStyle?.[0], proofStyle),
    formatCategory('Comercial', categories.commercialMode?.[0], commercialMode),
    format ? `Formato: ${formatPlannerFormatLabel(format)}` : null,
    formatPlannerDurationLabel(durationId) ? `Duração: ${formatPlannerDurationLabel(durationId)}` : null,
    formatPlannerWindowLabel(dayOfWeek, blockStartHour) ? `Janela: ${formatPlannerWindowLabel(dayOfWeek, blockStartHour)}` : null,
  ].filter(Boolean) as string[];

  return summary.slice(0, 10);
}

function normalizeCategoryIds(values?: string[] | string) {
  return (Array.isArray(values) ? values : values ? [values] : [])
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
}

function buildEditorialGuidance(categories: PlannerCategories, format?: PlannerFormat) {
  const contextIds = normalizeCategoryIds(categories.context);
  const proposalIds = normalizeCategoryIds(categories.proposal);
  const referenceIds = normalizeCategoryIds(categories.reference);
  const intentIds = normalizeCategoryIds(categories.contentIntent);
  const narrativeIds = normalizeCategoryIds(categories.narrativeForm);
  const proofIds = normalizeCategoryIds(categories.proofStyle);
  const commercialIds = normalizeCategoryIds(categories.commercialMode);
  const contentSignalIds = normalizeCategoryIds(categories.contentSignals);
  const stanceIds = normalizeCategoryIds(categories.stance);
  const tone = String(categories.tone || '').trim().toLowerCase();
  const hasAny = (ids: string[], matches: string[]) => matches.some((match) => ids.includes(match));
  const guidance: string[] = [];

  if (
    proposalIds.includes('humor_scene') ||
    tone === 'humorous' ||
    intentIds.includes('entertain') ||
    narrativeIds.includes('sketch_scene')
  ) {
    guidance.push('Humor/cena: gere situações filmáveis com timing, contraste e obstáculo visível; evite dica, palestra ou conselho disfarçado.');
  }

  if (
    hasAny(proposalIds, ['tips', 'tutorial', 'guide', 'how_to']) ||
    intentIds.includes('teach') ||
    tone === 'educational' ||
    narrativeIds.includes('tutorial')
  ) {
    guidance.push('Educacional: transforme o tema em problema prático, erro comum, passo aplicável ou checklist específico; mantenha utilidade acima da piada.');
  }

  if (
    hasAny(proposalIds, ['positioning_authority', 'comparison']) ||
    intentIds.includes('build_authority') ||
    tone === 'critical' ||
    hasAny(stanceIds, ['contrarian', 'myth_busting', 'opinionated'])
  ) {
    guidance.push('Autoridade/opinião: proponha ponto de vista claro, mito vs verdade, comparação ou tensão do mercado; evite frase neutra e genérica.');
  }

  if (
    proposalIds.includes('message_motivational') ||
    intentIds.includes('inspire') ||
    tone === 'inspirational'
  ) {
    guidance.push('Inspiracional: a pauta deve nascer de uma cena concreta e terminar com virada leve de significado, sem autoajuda ou frase pronta.');
  }

  if (
    hasAny(proposalIds, ['publi_divulgation', 'call_to_action']) ||
    intentIds.includes('convert') ||
    commercialIds.length > 0 ||
    tone === 'promotional'
  ) {
    guidance.push('Conversão/comercial: conecte desejo, objeção ou prova de uso em situação real; não pare em chamada para comprar ou divulgação genérica.');
  }

  if (
    hasAny(proposalIds, ['review', 'unboxing']) ||
    hasAny(narrativeIds, ['review', 'unboxing']) ||
    hasAny(proofIds, ['demonstration', 'before_after', 'opinion'])
  ) {
    guidance.push('Review/prova: gere teste, demonstração, antes/depois, opinião ou bastidor verificável; o título deve prometer observação concreta.');
  }

  if (proposalIds.includes('news') || intentIds.includes('inform') || narrativeIds.includes('news_update')) {
    guidance.push('Informativo/notícia: foque no que mudou, por que importa e impacto prático; não invente fatos externos sem base nas referências.');
  }

  if (proposalIds.includes('q&a') || narrativeIds.includes('q_and_a') || intentIds.includes('connect')) {
    guidance.push('Conexão/pergunta: use dúvida, comentário, situação compartilhável ou resposta curta para aproximar o público sem ficar abstrato.');
  }

  if (proposalIds.includes('behind_the_scenes') || narrativeIds.includes('behind_the_scenes')) {
    guidance.push('Bastidores: mostre processo, preparação, erro, detalhe de rotina ou decisão por trás do conteúdo; evite resultado final sem contexto.');
  }

  if (proposalIds.includes('comparison') || narrativeIds.includes('comparison')) {
    guidance.push('Comparação: deixe claro o contraste entre duas escolhas, expectativas, perfis ou momentos; cada lado precisa ser visualizável.');
  }

  if (proposalIds.includes('react') || narrativeIds.includes('reaction')) {
    guidance.push('React: a pauta precisa partir de reação/opinião a algo identificável; inclua gatilho, reação e consequência.');
  }

  if (proposalIds.includes('trend') || referenceIds.includes('trend') || contentSignalIds.includes('trend')) {
    guidance.push('Trend: adapte a tendência ao tema e ao contexto do criador; evite copiar formato viral sem recorte próprio.');
  }

  if (proposalIds.includes('lifestyle') || narrativeIds.includes('day_in_the_life')) {
    guidance.push('Lifestyle/rotina: use microcenas do cotidiano, hábitos, horários, casa, rua, trabalho ou família; mantenha o tema como conflito central.');
  }

  if (contextIds.includes('relationships_family')) {
    guidance.push('Relacionamentos/família: prefira cenas naturais como grupo, áudio, almoço, jantar, casa, visita, churrasco ou conversa atravessada.');
  }

  if (format === 'reel' || format === 'story' || format === 'long_video') {
    guidance.push('Formato vídeo: cada título deve sugerir a primeira cena dos 3-5 segundos iniciais.');
  } else if (format === 'carousel') {
    guidance.push('Formato carrossel: cada título deve funcionar como primeira lâmina forte, com promessa clara e recorte específico.');
  } else if (format === 'photo') {
    guidance.push('Formato foto: gere pautas com legenda/pose/cena estática clara, não dependentes de roteiro longo.');
  }

  return Array.from(new Set(guidance)).slice(0, 8);
}

function buildSelection(
  format: PlannerFormat | undefined,
  categories: PlannerCategories,
  durationId: string | undefined,
  mode: SlotPautasResult['retrievalMode']
): BlockCategorySelection {
  return {
    formatId: format,
    durationId: mode === 'broad' ? undefined : durationId,
    contextId: categories.context?.[0],
    proposalId: categories.proposal?.[0],
    referenceId: categories.reference?.[0],
    toneId: mode === 'strict' ? categories.tone : undefined,
    contentIntentId: mode === 'strict' || mode === 'focused' ? categories.contentIntent?.[0] : undefined,
    narrativeFormId: mode === 'strict' || mode === 'focused' ? categories.narrativeForm?.[0] : undefined,
    proofStyleId: mode === 'strict' ? categories.proofStyle?.[0] : undefined,
    commercialModeId: mode === 'strict' ? categories.commercialMode?.[0] : undefined,
  };
}

async function collectBranchCaptions(params: {
  userId: string | Types.ObjectId;
  periodDays: number;
  dayOfWeek: number;
  blockStartHour: number;
  format?: PlannerFormat;
  durationId?: string;
  categories: PlannerCategories;
}) {
  const modes: Array<SlotPautasResult['retrievalMode']> = ['strict', 'focused', 'relaxed', 'broad'];
  let bestCaptions: string[] = [];
  let bestMode: SlotPautasResult['retrievalMode'] = 'none';

  for (const mode of modes) {
    const captions = await getBlockSampleCaptions(
      params.userId,
      params.periodDays,
      params.dayOfWeek,
      params.blockStartHour,
      buildSelection(params.format, params.categories, params.durationId, mode),
      mode === 'strict' ? 8 : 6
    );

    if (captions.length > bestCaptions.length) {
      bestCaptions = captions;
      bestMode = mode;
    }

    if (captions.length >= (mode === 'strict' ? 3 : 2)) {
      return { captions, mode };
    }
  }

  return { captions: bestCaptions, mode: bestMode };
}

export async function getPautasForSlot(params: {
  userId: string | Types.ObjectId;
  periodDays: number;
  dayOfWeek: number;
  blockStartHour: number;
  format?: PlannerFormat;
  durationId?: string;
  categories: PlannerCategories;
  themeKeyword: string;
  count?: number;
}): Promise<SlotPautasResult> {
  const count = 5;
  const themeKeyword = params.themeKeyword.trim() || 'tema';
  const branchSummary = buildBranchSummary(
    params.categories,
    params.format,
    params.dayOfWeek,
    params.blockStartHour,
    params.durationId
  );
  const editorialGuidance = buildEditorialGuidance(params.categories, params.format);
  const { captions, mode } = await collectBranchCaptions({
    userId: params.userId,
    periodDays: params.periodDays,
    dayOfWeek: params.dayOfWeek,
    blockStartHour: params.blockStartHour,
    format: params.format,
    durationId: params.durationId,
    categories: params.categories,
  });

  console.log('[getPautasForSlot] Calling AI with theme:', themeKeyword);
  const aiPautas = await generatePautaIdeas({
    themeKeyword,
    format: params.format,
    dayOfWeek: params.dayOfWeek,
    blockStartHour: params.blockStartHour,
    categories: params.categories,
    sourceCaptions: captions,
    branchSummary,
    editorialGuidance,
    count: 10,
  });

  console.log('[getPautasForSlot] AI Result count:', aiPautas.length);

  if (aiPautas.length >= count) {
    logger.info('[planner/pautas] generated', {
      userId: String(params.userId),
      source: 'ai',
      requestedCount: count,
      aiPautasCount: aiPautas.length,
      finalPautasCount: count,
      captionCount: captions.length,
      retrievalMode: mode,
      editorialGuidanceCount: editorialGuidance.length,
      themeKeyword,
      dayOfWeek: params.dayOfWeek,
      blockStartHour: params.blockStartHour,
      format: params.format || null,
      durationId: params.durationId || null,
    });
    
    return {
      keyword: themeKeyword,
      pautas: aiPautas.slice(0, count),
      captions,
      source: 'ai',
      retrievalMode: mode,
    };
  }

  logger.warn('[planner/pautas] insufficient ai result', {
    userId: String(params.userId),
    requestedCount: count,
    aiPautasCount: aiPautas.length,
    captionCount: captions.length,
    retrievalMode: mode,
    editorialGuidanceCount: editorialGuidance.length,
    themeKeyword,
    dayOfWeek: params.dayOfWeek,
    blockStartHour: params.blockStartHour,
    format: params.format || null,
    durationId: params.durationId || null,
  });

  throw new Error(`AI returned ${aiPautas.length} pauta ideas; expected ${count}.`);
}
