// src/utils/findCommunityInspirationPosts.ts
import { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import MetricModel from '@/app/models/Metric';
import { getCategoryById } from '@/app/lib/classification';
import { getStartDateFromTimePeriod } from './dateHelpers';
import { logger } from '@/app/lib/logger';

// --- tokenização básica PT ---
function stripDiacritics(s: string) { return s.normalize('NFD').replace(/\p{Diacritic}+/gu, ''); }
function normalizeToken(t: string): string { return stripDiacritics(t.toLowerCase()).replace(/[^a-z0-9]+/gi, ''); }
const PT_STOPWORDS = new Set<string>([
  'a','o','os','as','um','uma','uns','umas','de','do','da','dos','das','em','no','na','nos','nas','por','para','com','sem',
  'sobre','entre','e','ou','mas','que','se','ja','já','nao','não','sim','ao','aos','à','as','às','como','quando','onde',
  'porque','porquê','pra','pro','pela','pelo','pelos','pelas','lhe','eles','elas','ele','ela','eu','tu','voce','você',
  'voces','vocês','me','te','seu','sua','seus','suas','meu','minha','meus','minhas','este','esta','esses','essas','isso',
  'isto','aquele','aquela','aqueles','aquelas','tambem','também','muito','muita','muitos','muitas','pouco','pouca','poucos',
  'poucas','mais','menos','todo','toda','todos','todas','cada','ate','até','mes','mês','ano','dia','hoje','amanha','amanhã',
  'ontem','agora','aqui','ali','la','lá','bem','mal','ser','estar','ter','fazer','vai','vou','ta','tá','ne','né','eh','ah',
  'oh','ok','depois','antes','durante','entao','então','tipo','coisa','coisas','conteudo','conteúdo','video','vídeo','reel',
  'reels','post','posts','story','stories','live','shorts','instagram','tiktok','canal','feed','viral','algoritmo'
].map(normalizeToken));

function extractQueryKeywords(text: string, theme?: string, max = 12): string[] {
  const seeds: string[] = [];
  if (theme) seeds.push(theme);
  seeds.push(text.slice(0, 220));
  const tokens = seeds.join(' ').split(/[^\p{L}\p{N}]+/u).map(normalizeToken).filter(Boolean);
  const uniq: string[] = [];
  for (const tk of tokens) {
    if (!tk || tk.length < 3) continue;
    if (PT_STOPWORDS.has(tk)) continue;
    if (!uniq.includes(tk)) uniq.push(tk);
    if (uniq.length >= max) break;
  }
  return uniq;
}

function labelsFor(id: string | undefined, type: 'context'|'proposal'|'reference'|'format'): string[] {
  if (!id) return [];
  const cat = getCategoryById(id, type as any);
  const out: string[] = [];
  if (cat?.label) out.push(cat.label);
  out.push(id);
  return out;
}

export interface CommunityInspirationPost {
  id: string;
  caption: string;
  views: number;
  date: string;
  coverUrl?: string | null;
  postLink?: string | null;
  reason?: string[];
}

export async function findCommunityInspirationPosts(params: {
  excludeUserId: string | Types.ObjectId;
  categories?: { context?: string[]; proposal?: string[]; reference?: string[] };
  script?: string;
  themeKeyword?: string;
  periodInDays?: number;
  limit?: number;
  styleHints?: string[]; // ex.: ['how_to','humor','comparison','regional_vs']
}): Promise<CommunityInspirationPost[]> {
  await connectToDatabase();
  const excludeUser = typeof params.excludeUserId === 'string' ? new Types.ObjectId(params.excludeUserId) : params.excludeUserId;
  const period = Math.max(30, Math.min(365, params.periodInDays || 180));
  const limit = Math.max(3, Math.min(24, params.limit || 12));

  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, `last_${period}_days`);

  const ctxId = params.categories?.context?.[0];
  const prpId = params.categories?.proposal?.[0];
  const refId = params.categories?.reference?.[0];
  const ctxValues = labelsFor(ctxId, 'context');
  const prpValues = labelsFor(prpId, 'proposal');
  const refValues = labelsFor(refId, 'reference');

  const baseMatch: any = {
    user: { $ne: excludeUser },
    postDate: { $gte: startDate, $lte: endDate },
    'stats.views': { $exists: true, $type: 'number', $gt: 0 },
  };
  const catOr: any[] = [];
  if (ctxValues.length) catOr.push({ context: { $in: ctxValues } });
  if (prpValues.length) catOr.push({ proposal: { $in: prpValues } });
  if (refValues.length) catOr.push({ references: { $in: refValues } });
  if (catOr.length) baseMatch.$or = catOr;

  // Pré-seleção por views desc (corta universo)
  const pre = await MetricModel.find(baseMatch)
    .select({ description: 1, 'stats.views': 1, postDate: 1, coverUrl: 1, postLink: 1, context: 1, proposal: 1, references: 1 })
    .sort({ 'stats.views': -1 })
    .limit(300)
    .lean();

  const qTokens = extractQueryKeywords((params.script || '').toString(), params.themeKeyword, 12);
  const styleHints = (params.styleHints || []).map(s => String(s).toLowerCase());
  const score = (row: any) => {
    const caption = (row?.description || '').toString().toLowerCase();
    const tokens = caption.split(/[^\p{L}\p{N}]+/u).map(normalizeToken).filter(Boolean);
    const tSet = new Set(tokens);
    let kwOverlap = 0;
    for (const tk of qTokens) if (tSet.has(tk)) kwOverlap++;

    const cats = new Set<string>([...(row?.context || []), ...(row?.proposal || []), ...(row?.references || [])].map((s: any) => (s || '').toString().toLowerCase()));
    let catOverlap = 0;
    if (ctxValues.length && ctxValues.some(v => cats.has(v.toLowerCase()))) catOverlap++;
    if (prpValues.length && prpValues.some(v => cats.has(v.toLowerCase()))) catOverlap++;
    if (refValues.length && refValues.some(v => cats.has(v.toLowerCase()))) catOverlap++;

    const views = Number(row?.stats?.views || 0);
    const perf = Math.log10(Math.max(1, views));

    // Bônus por estilo
    let styleBonus = 0;
    const has = (id: string) => cats.has(id);
    if (styleHints.includes('how_to') || styleHints.includes('practical_imperative')) {
      if (has('tutorial') || has('how_to') || has('tips') || has('guide') || has('educational')) styleBonus += 0.1;
    }
    if (styleHints.includes('humor') || styleHints.includes('humor_scene')) {
      if (has('humor_scene')) styleBonus += 0.1;
    }
    if (styleHints.includes('comparison')) {
      if (has('comparison')) styleBonus += 0.1;
    }
    if (styleHints.includes('regional_vs')) {
      if (has('regional_stereotypes')) styleBonus += 0.1;
    }

    const score = 0.5 * (catOverlap / Math.max(1, (ctxValues.length>0?1:0)+(prpValues.length>0?1:0)+(refValues.length>0?1:0))) +
                  0.3 * (kwOverlap / Math.max(1, qTokens.length)) +
                  0.2 * (perf / 6) +
                  styleBonus; // leve ajuste
    return { score, kwOverlap, catOverlap, views };
  };

  const ranked = pre.map(r => ({ r, s: score(r) }))
    .filter(x => x.s.catOverlap > 0 || x.s.kwOverlap > 0)
    .sort((a, b) => b.s.score - a.s.score || b.s.views - a.s.views)
    .slice(0, limit);

  const reasonFor = (row: any, sc: ReturnType<typeof score>): string[] => {
    const rs: string[] = [];
    if (sc.catOverlap > 0) rs.push('match: categorias');
    if (sc.kwOverlap > 0) rs.push('match: narrativa');
    if ((row?.stats?.views || 0) > 0) rs.push('desempenho alto');
    return rs;
  };

  const out: CommunityInspirationPost[] = ranked.map(({ r, s }) => ({
    id: String(r?._id || ''),
    caption: String(r?.description || '').trim(),
    views: Number(r?.stats?.views || 0),
    date: (r?.postDate instanceof Date ? r.postDate.toISOString() : new Date(r?.postDate || Date.now()).toISOString()),
    coverUrl: r?.coverUrl || null,
    postLink: r?.postLink || null,
    reason: reasonFor(r, s),
  }));

  logger.info('[findCommunityInspirationPosts] results', { excludeUser: String(excludeUser), qTokens, returned: out.length });
  return out;
}

export default findCommunityInspirationPosts;
