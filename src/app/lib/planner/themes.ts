import { Types } from 'mongoose';
import OpenAI from 'openai';
import { getBlockSampleCaptions } from '@/utils/getBlockSampleCaptions';
import { PlannerCategories } from '@/types/planner';
import { getCategoryById } from '@/app/lib/classification';
import { generateThemes as generateThemesAI } from '@/app/lib/planner/ai';

// ---------- Tokenização / normalização ----------
function stripDiacritics(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}+/gu, '');
}
function normalizeToken(t: string): string {
  return stripDiacritics(t.toLowerCase()).replace(/[^a-z0-9]+/gi, '');
}
function isAllDigits(s: string) { return /^[0-9]+$/.test(s); }

// Stopwords (normalizadas)
const PT_STOPWORDS_SRC = [
  'a','o','os','as','um','uma','uns','umas','de','do','da','dos','das','em','no','na','nos','nas','por','para','com','sem',
  'sobre','entre','e','ou','mas','que','se','ja','já','nao','não','sim','ao','aos','à','as','às','como','quando','onde',
  'porque','porquê','pra','pro','pela','pelo','pelos','pelas','lhe','eles','elas','ele','ela','eu','tu','voce','você',
  'voces','vocês','me','te','seu','sua','seus','suas','meu','minha','meus','minhas','este','esta','esses','essas','isso',
  'isto','aquele','aquela','aqueles','aquelas','tambem','também','muito','muita','muitos','muitas','pouco','pouca','poucos',
  'poucas','mais','menos','todo','toda','todos','todas','cada','ate','até','mes','mês','ano','dia','hoje','amanha','amanhã',
  'ontem','agora','aqui','ali','la','lá','bem','mal','ser','estar','ter','fazer','vai','vou','ta','tá','ne','né','eh','ah',
  'oh','ok','depois','antes','durante','entao','então','tipo','coisa','coisas',
  // termos de redes / genéricos
  'conteudo','conteúdo','video','vídeo','reel','reels','post','posts','story','stories','live','shorts','instagram','tiktok',
  'canal','feed','viral','algoritmo','tema','temas',
  // estilos/formatos/propostas genéricos (evitar como tema de 1 palavra)
  'humor','humoristico','humorístico','tutorial','guia','dica','dicas','chamada','call','publi','divulgacao','divulgação',
  'publicidade','promo','promocao','promoção','tendencia','tendência','trend','challenge','desafio','reacao','reação',
  'review','analise','análise','vlog','rotina','avaliacao','avaliação','teste','resenha'
];
const PT_STOPWORDS = new Set(PT_STOPWORDS_SRC.map(normalizeToken).filter(Boolean));

// Palavras ainda “fracas” mesmo se passarem pelo filtro
const GENERIC_WEAK = new Set([
  'conteudo','video','reels','post','story','shorts','algoritmo','tema',
  'humor','humoristico','humorístico','tutorial','guia','dica','dicas','chamada','call','publi','divulgacao','divulgação',
  'publicidade','promo','promocao','promoção','tendencia','tendência','trend','challenge','desafio','reacao','reação',
  'review','analise','análise','vlog','rotina','avaliacao','avaliação','teste','resenha'
]);

// ---------- Extração do tema pela palavra mais repetida (doc frequency) ----------
function extractTopKeyword(captions: string[], exclude?: Set<string>): { keyword: string | null; count: number } {
  const docFreq = new Map<string, number>();                   // token(normalizado) -> nº de legendas distintas que contêm
  const displayForms = new Map<string, Map<string, number>>(); // token(normalizado) -> { 'forma com acento': contagem }

  for (const capRaw of captions) {
    const cap = String(capRaw || '');
    const rawTokens = cap.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const seenInThisDoc = new Set<string>();

    for (const raw of rawTokens) {
      const display = raw.toLowerCase();        // preserva acentos para exibição
      const norm = normalizeToken(raw);
      if (!norm || norm.length < 4) continue;
      if (PT_STOPWORDS.has(norm)) continue;
      if (exclude && exclude.has(norm)) continue; // ignora termos de categorias
      if (isAllDigits(norm)) continue;
      if (seenInThisDoc.has(norm)) continue;    // conta no máx. 1x por legenda

      seenInThisDoc.add(norm);
      docFreq.set(norm, (docFreq.get(norm) || 0) + 1);

      if (!displayForms.has(norm)) displayForms.set(norm, new Map());
      const m = displayForms.get(norm)!;
      m.set(display, (m.get(display) || 0) + 1);
    }
  }

  if (!docFreq.size) return { keyword: null, count: 0 };

  // escolhe por maior DF; empate → mais longo; depois ordem alfabética
  const [bestNorm, bestCount] = [...docFreq.entries()]
    .sort((a, b) =>
      b[1] - a[1] || (b[0].length - a[0].length) || a[0].localeCompare(b[0])
    )[0]!;

  // pega a “forma de superfície” mais comum (com acento) para exibição
  const variants = displayForms.get(bestNorm);
  const surface = (variants && variants.size)
    ? [...variants.entries()].sort((a, b) => b[1] - a[1])[0]![0]
    : bestNorm;

  return { keyword: surface, count: bestCount };
}

// ---------- Helpers de composição de temas ----------
function ensureStartsWithKeyword(themes: string[], keyword: string): string[] {
  const kw = (keyword || '').trim();
  if (!kw) return themes;
  return themes.map(t => {
    const tt = (t || '').trim();
    if (!tt) return tt;
    const starts = normalizeToken(tt).startsWith(normalizeToken(kw));
    return starts ? tt : `${kw} — ${tt}`;
  });
}

// Gera dicas de estilo a partir das categorias (usadas para orientar a IA a ser específica, sem engessar)
function buildThemeStyleHints(cats: PlannerCategories): string[] {
  const hints: string[] = [];
  const proposals = (cats.proposal || []).map(p => p.toLowerCase());
  const contexts = (cats.context || []).map(c => c.toLowerCase());
  const tone = (cats.tone || '').toLowerCase();

  const hasP = (id: string) => proposals.includes(id);
  const hasC = (id: string) => contexts.includes(id);

  if (hasP('comparison')) hints.push('comparison', 'use VS quando fizer sentido');
  if (hasC('regional_stereotypes')) hints.push('regional_vs', 'use carioca vs paulista se adequado');
  if (hasC('relationships_family')) hints.push('couple', 'situações de casal (namorado/namorada)');
  if (hasP('tutorial') || hasP('how_to') || hasP('tips') || hasP('guide') || hasP('educational')) hints.push('how_to', '3 passos práticos no dia a dia');
  if (hasP('humor_scene')) hints.push('humor_scene', 'cotidiano com humor');
  if (/humor|sarcas|ironia|comedia/.test(tone)) hints.push('humor');

  return Array.from(new Set(hints)).slice(0, 8);
}

function composeThemes(keyword: string, cats: PlannerCategories): string[] {
  const themes = new Set<string>();
  const push = (s: string) => { const t = s.replace(/\s+/g,' ').trim(); if (t) themes.add(t); };

  const baseKw = (keyword || 'conteúdo').trim();

  // Bases curtas e aplicáveis
  push(`${baseKw} em 3 passos práticos`);
  push(`como ${baseKw} me ajuda no trabalho`);
  push(`${baseKw} na vida real, sem enrolação`);
  push(`usando ${baseKw} pra resolver problemas em casa`);
  push(`${baseKw} vs minha rotina antiga`);
  push(`aprenda ${baseKw} do zero (simples)`);

  const props = (cats.proposal || []).map(p => p.toLowerCase());
  const has = (id: string) => props.includes(id);

  if (has('announcement') || has('news')) {
    push(`${baseKw} hoje: o que mudou agora`);
    push(`novidades de ${baseKw} que você precisa saber`);
  }
  if (has('comparison')) {
    push(`${baseKw} prós e contras (rápido)`);
  }
  if (has('tutorial') || has('how_to') || has('tips') || has('guide') || has('educational')) {
    push(`${baseKw} no dia a dia (aplique hoje)`);
  }

  const toneId = (cats.tone || '').toLowerCase();
  if (toneId && /humor|sarcas|ironia|comedia/.test(toneId)) {
    push(`${baseKw} com humor ácido`);
  }

  // Não impõe prefixo obrigatório pelo keyword; apenas garante que muitas ideias contenham o termo
  const out = Array.from(themes);
  return Array.from(new Set(out)).slice(0, 5);
}

// ---------- Fallback de keyword a partir das categorias ----------
function fallbackKeywordFromCategories(categories: PlannerCategories): string {
  const pickFromLabel = (id: string|undefined, dim: 'context'|'proposal') => {
    if (!id) return '';
    const lbl = getCategoryById(id, dim)?.label || id;
    const toks = String(lbl).split(/[^\p{L}\p{N}]+/u)
      .map(t => ({ norm: normalizeToken(t), disp: t.toLowerCase() }))
      .filter(t => t.norm.length >= 4 && !PT_STOPWORDS.has(t.norm) && !isAllDigits(t.norm));
    // prioriza a mais longa; empate por ordem
    return toks.sort((a,b)=> b.norm.length - a.norm.length || a.disp.localeCompare(b.disp))[0]?.disp || '';
  };

  return pickFromLabel(categories.proposal?.[0], 'proposal')
      || pickFromLabel(categories.context?.[0], 'context')
      || 'tema';
}

// ---------- IA: sintetizar UMA palavra-tema quando não há repetição suficiente ----------
async function aiSummarizeKeyword(params: {
  captions: string[];
  categories: PlannerCategories;
  forbidden?: string[]; // termos a evitar (labels/tokens de categorias)
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const openai = new OpenAI({ apiKey });
  const sys = `Você extrai um TEMA ÚNICO em 1 palavra (substantivo simples, sem espaços) a partir de legendas vencedoras.`;
  const userPayload = {
    captions: (params.captions || []).slice(0, 20),
    categories: params.categories,
    rules: {
      language: 'pt-BR',
      output: 'JSON',
      single_word: true,
      no_hashtag: true,
      no_emojis: true,
      max_len: 20
    }
  };
  const prompt =
`Resuma o TEMA em **1 palavra** (português), preferindo substantivos concretos (cenário/lugar/objeto/atividade) que apareçam ou sejam fortemente implicados nas legendas:
- Sem espaços, sem hashtags, sem emojis, no máximo 20 caracteres.
- Evite palavras idênticas aos rótulos de categorias (forbidden) e termos genéricos (ex.: conteúdo, vídeo, humor, tutorial).
- Se não houver pista clara, gere uma palavra plausível que simbolize as descrições.
Responda **apenas** com JSON válido: {"keyword":"<palavra>"}.

Contexto:
${JSON.stringify(userPayload, null, 2)}
Forbidden: ${(params.forbidden || []).join(', ')}`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: Number(process.env.OPENAI_TEMP || 0.4),
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' } as any,
    } as any);

    const content = completion.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    let kw = typeof parsed?.keyword === 'string' ? parsed.keyword : '';
    kw = kw.trim();

    // sanitiza: pega só a primeira “palavra”
    kw = kw.split(/[^\p{L}\p{N}]+/u)[0] || '';
    kw = kw.slice(0, 20);

    const norm = normalizeToken(kw);
    if (!norm || norm.length < 3 || PT_STOPWORDS.has(norm) || GENERIC_WEAK.has(norm)) return null;
    if ((params.forbidden || []).some(f => normalizeToken(f) === norm)) return null;

    return kw;
  } catch {
    return null;
  }
}

// ---------- API principal ----------
export async function getThemesForSlot(
  userId: string | Types.ObjectId,
  periodDays: number,
  dayOfWeek: number,
  blockStartHour: number,
  categories: PlannerCategories,
): Promise<{ keyword: string; themes: string[] }> {
  const selected = {
    formatId: undefined,
    contextId: categories.context?.[0],
    proposalId: categories.proposal?.[0],
    referenceId: categories.reference?.[0],
  };

  // 1) Legendas do bloco (posts vencedores para o filtro escolhido)
  let caps: string[] = [];
  try {
    caps = await getBlockSampleCaptions(userId, periodDays, dayOfWeek, blockStartHour, selected, 20);
  } catch { caps = []; }

  // Tokens a evitar a partir dos rótulos de categorias
  const excludeTokens = new Set<string>();
  const collectFromLabel = (id?: string, dim?: 'context'|'proposal'|'reference'|'tone') => {
    if (!id) return;
    const lbl = getCategoryById(id, dim as any)?.label || id;
    const parts = String(lbl).split(/[^\p{L}\p{N}]+/u).map(normalizeToken).filter(Boolean);
    parts.forEach(p => excludeTokens.add(p));
    excludeTokens.add(normalizeToken(String(lbl)));
  };
  (categories.context || []).forEach(id => collectFromLabel(id, 'context'));
  (categories.proposal || []).forEach(id => collectFromLabel(id, 'proposal'));
  (categories.reference || []).forEach(id => collectFromLabel(id, 'reference'));
  if (categories.tone) collectFromLabel(categories.tone, 'tone');

  // 2) Palavra tema (doc frequency + superfície com acento), ignorando termos das categorias
  const { keyword: kwByFreq, count: topCount } = extractTopKeyword(caps, excludeTokens);
  const weak = kwByFreq ? (GENERIC_WEAK.has(normalizeToken(kwByFreq)) || normalizeToken(kwByFreq).length < 3) : true;

  // 2b) Se não repetiu pelo menos 2 legendas OU ficou fraco/genérico → tenta IA (1 palavra)
  let keyword = kwByFreq || '';
  if (!kwByFreq || topCount < 2 || weak) {
    const aiKw = await aiSummarizeKeyword({ captions: caps, categories, forbidden: Array.from(excludeTokens) });
    if (aiKw) keyword = aiKw;
  }

  // 2c) Fallback final: categorias
  if (!keyword) keyword = fallbackKeywordFromCategories(categories);
  if (!keyword || normalizeToken(keyword).length < 3) keyword = 'conteúdo';

  // 3) Variações de temas (linhas) com IA; fallback local se falhar
  try {
    const styleHints = buildThemeStyleHints(categories);
    const mode = (process.env.PLANNER_THEMES_MODE || 'flex').toLowerCase();
    const startWithKeyword = mode === 'strict'; // flex = false (padrão), strict = true
    const aiThemes = await generateThemesAI({ keyword, categories, sourceCaptions: caps, count: 5, startWithKeyword, styleHints });
    if (Array.isArray(aiThemes) && aiThemes.length) {
      const uniq = Array.from(new Set(aiThemes.map(t => t.trim()).filter(Boolean))).slice(0, 5);
      if (uniq.length >= 3) return { keyword, themes: uniq };
    }
  } catch { /* fallback abaixo */ }

  return { keyword, themes: composeThemes(keyword, categories) };
}

export default getThemesForSlot;
