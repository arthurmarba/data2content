import OpenAI from 'openai';
import { logger } from '@/app/lib/logger';
import { getCategoryById } from '@/app/lib/classification';
import { getV2CategoryById } from '@/app/lib/classificationV2';
import { getV25CategoryById } from '@/app/lib/classificationV2_5';
import type { PlannerCategories } from '@/types/planner';

export interface GenerateDraftInput {
  userId: string;
  dayOfWeek: number; // 1..7
  blockStartHour: number; // 0..21 step 3
  format: string; // 'reel' | 'photo' | 'carousel' | 'story' | 'live' | 'long_video'
  categories?: { context?: string[]; tone?: string; proposal?: string[]; reference?: string[] };
  isExperiment?: boolean;
  strategy?: 'auto' | 'default' | 'shorter' | 'more_humor' | 'focus_shares' | 'strong_hook' | 'practical_imperative' | 'scenario_script';
  sourceCaptions?: string[]; // legendas reais que inspiram o rascunho
  externalSignals?: { title: string; url?: string; source?: string; }[]; // notícias/tópicos atuais
  themeKeyword?: string; // tema-chave (palavra mais repetida nas legendas do bloco)
}

export interface GenerateDraftResult {
  title: string;
  script: string;
  hashtags?: string[];
  tone?: string;
  recordingTimeSec?: number;
  beats?: string[];
}

// --- utils locais ---
function estimateRecordingTimeSec(text: string, tone?: string): number {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
  let wpm = 150;
  const t = (tone || '').toLowerCase();
  if (t.includes('analítico') || t.includes('analitico') || t.includes('crítico') || t.includes('critico')) wpm = 140;
  if (t.includes('humor') || t.includes('rápido') || t.includes('rapido')) wpm = 160;
  const minutes = words / Math.max(120, Math.min(180, wpm));
  return Math.round(minutes * 60);
}
function formatLabel(fmt?: string) {
  switch (fmt) {
    case 'reel': return 'Reel';
    case 'photo': return 'Foto';
    case 'carousel': return 'Carrossel';
    case 'story': return 'Story';
    case 'live': return 'Live';
    case 'long_video': return 'Vídeo Longo';
    default: return String(fmt || 'Post');
  }
}
function toLabel(id: string | undefined, dim: 'context' | 'proposal' | 'reference' | 'tone') {
  if (!id) return '';
  return getCategoryById(id, dim)?.label || id;
}
function toHashtag(s: string) {
  const cleaned = s
    .normalize('NFD').replace(/\p{Diacritic}+/gu, '')
    .replace(/[^a-z0-9\s]/gi, '')
    .trim()
    .replace(/\s+/g, '');
  if (!cleaned) return '';
  return '#' + cleaned.toLowerCase();
}

// 🔹 helper: escapar regex
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 🔹 pós-processamento: garante tema no título e no início do roteiro
function enforceThemePresence(opts: {
  title: string;
  script: string;
  themeKeyword?: string;
  strategy: GenerateDraftInput['strategy'];
  titlePrefixHint?: string;
}): { title: string; script: string } {
  const theme = (opts.themeKeyword || '').trim();
  if (!theme) return { title: opts.title, script: opts.script };

  const title = opts.title || '';
  const script = opts.script || '';
  const themeRe = new RegExp(`\\b${escapeRegExp(theme)}\\b`, 'i');

  let finalTitle = title;
  let finalScript = script;

  // se o tema não estiver no título, prefixa de forma elegante
  if (!themeRe.test(finalTitle)) {
    const prefix = (opts.strategy === 'scenario_script') ? (opts.titlePrefixHint || 'Cena:') : (opts.titlePrefixHint || 'Faça isso:');
    const candidate = `${prefix} ${theme} — ${finalTitle || 'roteiro curto'}`;
    finalTitle = candidate.slice(0, 60);
  } else if (finalTitle.length > 60) {
    finalTitle = finalTitle.slice(0, 60);
  }

  // se o tema não estiver nos primeiros 140 chars do script, injeta um gancho inicial
  const head = finalScript.slice(0, 140);
  if (!themeRe.test(head)) {
    const lead = (opts.strategy === 'scenario_script')
      ? `0:00 Abertura — Tema: ${theme}. `
      : `Gancho — ${theme}: `;
    finalScript = `${lead}${finalScript}`.trim();
  }

  return { title: finalTitle, script: finalScript };
}

/* =============================================================================
   NOVO HELPER — generateThemeKeyword
   Centraliza a derivação de um tema 1-palavra a partir de legendas/categorias.
   - Tenta doc-frequency local (robusto a repetição baixa).
   - Sanitiza (começa com letra, [\p{L}\p{N}], 1 palavra, máx 24 chars).
   - Se houver OPENAI_API_KEY, tenta uma sugestão de refinamento da IA.
============================================================================= */

// normalização
function stripDiacritics(s: string) { return s.normalize('NFD').replace(/\p{Diacritic}+/gu, ''); }
function normalizeToken(t: string): string { 
  return (t || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, ''); 
}
function isAllDigits(s: string) { return /^[0-9]+$/.test(s); }

// stopwords (normalizadas)
const PT_STOPWORDS_SRC = [
  'a','o','os','as','um','uma','uns','umas','de','do','da','dos','das','em','no','na','nos','nas','por','para','com','sem',
  'sobre','entre','e','ou','mas','que','se','ja','já','nao','não','sim','ao','aos','à','as','às','como','quando','onde',
  'porque','porquê','pra','pro','pela','pelo','pelos','pelas','lhe','eles','elas','ele','ela','eu','tu','voce','você',
  'voces','vocês','me','te','seu','sua','seus','suas','meu','minha','meus','minhas','este','esta','esses','essas','isso',
  'isto','aquele','aquela','aqueles','aquelas','tambem','também','muito','muita','muitos','muitas','pouco','pouca','poucos',
  'poucas','mais','menos','todo','toda','todos','todas','cada','ate','até','mes','mês','ano','dia','hoje','amanha','amanhã',
  'ontem','agora','aqui','ali','la','lá','bem','mal','ser','estar','ter','fazer','vai','vou','ta','tá','ne','né','eh','ah',
  'oh','ok','depois','antes','durante','entao','então','tipo','coisa','coisas',
  'conteudo','conteúdo','video','vídeo','reel','reels','post','posts','story','stories','live','shorts','instagram','tiktok',
  'canal','feed','viral','algoritmo'
];
const PT_STOPWORDS = new Set(PT_STOPWORDS_SRC.map(normalizeToken).filter(Boolean));

function sanitizeThemeKeyword(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const m = v.trim().match(/\p{L}[\p{L}\p{N}]*/u);
  const word = m?.[0] || '';
  if (!word || /^\d+$/.test(word)) return undefined;
  return word.slice(0, 24);
}

function extractTopKeywordDocFreq(captions: string[]): string | undefined {
  const docFreq = new Map<string, number>();                  // token norm -> nº docs
  const displayForms = new Map<string, Map<string, number>>(); // token norm -> { forma exibida: contagem }

  for (const capRaw of captions) {
    const cap = String(capRaw || '');
    const tokens = cap.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const seen = new Set<string>();
    for (const raw of tokens) {
      const norm = normalizeToken(raw);
      if (!norm || norm.length < 4) continue;
      if (PT_STOPWORDS.has(norm)) continue;
      if (isAllDigits(norm)) continue;
      if (seen.has(norm)) continue;
      seen.add(norm);

      docFreq.set(norm, (docFreq.get(norm) || 0) + 1);

      if (!displayForms.has(norm)) displayForms.set(norm, new Map());
      const disp = raw.toLowerCase();
      const m = displayForms.get(norm)!;
      m.set(disp, (m.get(disp) || 0) + 1);
    }
  }
  if (!docFreq.size) return undefined;

  const bestNorm = [...docFreq.entries()]
    .sort((a, b) => b[1] - a[1] || (b[0].length - a[0].length) || a[0].localeCompare(b[0]))[0]![0];

  const variants = displayForms.get(bestNorm);
  if (!variants || !variants.size) return bestNorm;
  return [...variants.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

function keywordFromCategories(categories?: { context?: string[]; proposal?: string[] }): string | undefined {
  const pickFrom = (id?: string, dim?: 'context' | 'proposal') => {
    if (!id) return '';
    const lbl = getCategoryById(id, dim!)?.label || id;
    const toks = String(lbl).split(/[^\p{L}\p{N}]+/u)
      .map(t => ({ norm: normalizeToken(t), disp: t.toLowerCase() }))
      .filter(t => t.norm.length >= 3 && !PT_STOPWORDS.has(t.norm) && !isAllDigits(t.norm));
    return toks.sort((a, b) => b.norm.length - a.norm.length || a.disp.localeCompare(b.disp))[0]?.disp || '';
  };
  return pickFrom(categories?.proposal?.[0], 'proposal') || pickFrom(categories?.context?.[0], 'context') || undefined;
}

/** 🔹 Novo helper: tenta derivar 1 palavra-tema a partir de legendas/categorias (com fallback IA opcional). */
export async function generateThemeKeyword(input: {
  captions?: string[];
  categories?: { context?: string[]; proposal?: string[] };
  candidates?: string[];      // sugestões externas (ex.: do UI)
}): Promise<string | undefined> {
  // 1) candidatos explícitos
  for (const c of input.candidates || []) {
    const s = sanitizeThemeKeyword(c);
    if (s) return s;
  }

  // 2) frequência por documento nas legendas
  const fromCaps = extractTopKeywordDocFreq(input.captions || []);
  const capSan = sanitizeThemeKeyword(fromCaps || '');
  if (capSan) return capSan;

  // 3) categorias
  const fromCat = keywordFromCategories(input.categories);
  const catSan = sanitizeThemeKeyword(fromCat || '');
  if (catSan) return catSan;

  // 4) IA (opcional) — tenta sugerir uma palavra-tema; se falhar, retorna undefined
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return undefined;

  const openai = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  });
  const sys = `Você extrai um ÚNICO tema em 1 palavra (comece com letra, sem espaços) a partir de legendas. Evite stopwords. Responda só JSON {"keyword": string}.`;
  const payload = {
    captions: (input.captions || []).slice(0, 10),
    categories: {
      context: (input.categories?.context || []).map(id => getCategoryById(id, 'context')?.label || id),
      proposal: (input.categories?.proposal || []).map(id => getCategoryById(id, 'proposal')?.label || id),
    },
    rules: {
      language: 'pt-BR',
      oneWord: true,
      maxLen: 24,
    }
  };
  const prompt =
`Com base nas legendas e rótulos, escolha **1 palavra** que melhor resume o tema recorrente.
- Uma única palavra (sem espaços), começando com letra.
- Evite palavras vazias ("de", "para", "você", "vídeo", "conteúdo"...).
- Máx. 24 caracteres.

Contexto:
${JSON.stringify(payload, null, 2)}

Responda EXCLUSIVAMENTE como JSON: {"keyword": "palavra"}.`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: Number(process.env.OPENAI_TEMP || 0.2),
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' } as any,
    } as any);

    const content = completion.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    const s = sanitizeThemeKeyword(parsed?.keyword);
    return s || undefined;
  } catch {
    return undefined;
  }
}

/* =============================================================================
   generatePostDraft — já com suporte a themeKeyword
============================================================================= */

export async function generatePostDraft(input: GenerateDraftInput): Promise<GenerateDraftResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  // Escolha automática de estilo baseada nas categorias
  const pickAutoStrategy = (
    cats?: { proposal?: string[]; context?: string[]; tone?: string; reference?: string[]; }
  ): { strategy: 'scenario_script' | 'practical_imperative'; titlePrefix?: string; ctaHint?: string; } => {
    const p = (cats?.proposal || []).map(x => x.toLowerCase());
    const has = (id: string) => p.includes(id);
    if (has('humor_scene') || has('lifestyle') || has('behind_the_scenes') || has('clip') || has('message_motivational')) return { strategy: 'scenario_script', titlePrefix: 'Cena:', ctaHint: 'Comente se já passou por isso e salve.' };
    if (has('announcement')) return { strategy: 'scenario_script', titlePrefix: 'Anúncio:', ctaHint: 'Compartilhe e marque alguém que precisa saber.' };
    if (has('news')) return { strategy: 'scenario_script', titlePrefix: 'Notícia:', ctaHint: 'Comente sua opinião e compartilhe.' };
    if (has('call_to_action')) return { strategy: 'practical_imperative', titlePrefix: 'Faça isso:', ctaHint: 'Clique no link da bio ou envie DM “EU QUERO”.' };
    if (has('comparison')) return { strategy: 'practical_imperative', titlePrefix: 'Compare:', ctaHint: 'Comente qual você escolhe e salve.' };
    if (has('tutorial') || has('how_to') || has('tips') || has('guide') || has('didactic') || has('educational')) return { strategy: 'practical_imperative', titlePrefix: 'Aprenda a:', ctaHint: 'Comente sua dúvida e salve para aplicar.' };
    return { strategy: 'practical_imperative', titlePrefix: 'Faça isso:', ctaHint: 'Comente sua dúvida e salve.' };
  };

  const auto = pickAutoStrategy(input.categories);
  const effStrategy = (input.strategy && input.strategy !== 'auto') ? input.strategy : auto.strategy;
  const titlePrefixHint = auto.titlePrefix;
  const ctaHint = auto.ctaHint;

  // --- Fallback local (sem API) ---
  if (!apiKey) {
    const fmtLabel = formatLabel(input.format);
    const firstCtx = toLabel(input.categories?.context?.[0], 'context');
    const firstProp = toLabel(input.categories?.proposal?.[0], 'proposal');
    const firstRef = toLabel(input.categories?.reference?.[0], 'reference');
    const tone = toLabel(input.categories?.tone, 'tone');
    const theme = (input.themeKeyword || '').trim();

    const captions = (input.sourceCaptions || []).filter(Boolean);
    const snippet = (text: string, max = 12) => (text || '').split(/\s+/).slice(0, max).join(' ');
    const bullets = captions.slice(0, 3).map(c => `- ${snippet(c, 14)}…`).join('\n');

    const parts: string[] = [];
    if (theme) parts.push(theme);
    if (firstProp) parts.push(firstProp);
    if (firstCtx) parts.push(firstCtx);
    if (firstRef) parts.push(firstRef);
    const baseTopic = parts.filter(Boolean).join(' • ') || theme || firstCtx || firstProp || firstRef || 'roteiro rápido';

    const scenarioSource = captions.find(c => /rio|são paulo|sp\b|rj\b|chefe|cliente|trabalho|estágio|faculdade/i.test(c));
    const scenarioTerm = theme || (scenarioSource ? snippet(scenarioSource, 8) : (captions[0] ? snippet(captions[0], 8) : baseTopic));

    const rawTags = [theme, firstCtx, firstProp, firstRef, fmtLabel].map(x => toHashtag(String(x || ''))).filter(Boolean);
    const uniqTags = Array.from(new Set(['#conteudo', '#reels', ...rawTags])).slice(0, 6);

    if (effStrategy === 'scenario_script') {
      let fallbackTitle = baseTopic
        ? `${titlePrefixHint || 'Cena:'} ${baseTopic}`.slice(0, 60)
        : `Cena curta no ${fmtLabel}`;
      let scriptLines: string[] = [];
      scriptLines.push(`0:00 Abertura — Tema: ${theme || scenarioTerm || 'situação do dia a dia'}. ${tone ? `• ${tone}` : ''}`);
      scriptLines.push(`0:03 Chefe: "Pode ficar até mais tarde hoje?"`);
      scriptLines.push(`0:05 Você ( *olha o relógio* ): "Meu expediente termina às 18h. Posso entregar amanhã às 9h bem feito."`);
      scriptLines.push(`0:08 Corte — close na reação do colega ( *risadinha nervosa* ).`);
      scriptLines.push(`0:10 Você levanta, organiza a mesa e sai com um aceno cordial.`);
      if (bullets) scriptLines.push('0:12 Referências dos seus posts:');
      if (bullets) scriptLines.push(bullets);
      scriptLines.push(`0:14 CTA: ${ctaHint || 'Comente se já passou por isso e salve.'}`);
      const fallbackScript = scriptLines.join('\n');

      // reforça tema
      const enforced = enforceThemePresence({
        title: fallbackTitle,
        script: fallbackScript,
        themeKeyword: theme,
        strategy: effStrategy,
        titlePrefixHint,
      });

      const beats: string[] = [
        `Abertura — gancho com ${theme || scenarioTerm || 'o tema'}`,
        'Cena principal — conflito/situação do dia a dia',
        'Corte — reação para timing cômico',
        `Encerramento — CTA (${ctaHint || 'comente e salve'})`,
      ];

      return {
        title: enforced.title,
        script: enforced.script,
        hashtags: uniqTags,
        recordingTimeSec: estimateRecordingTimeSec(enforced.script, tone),
        tone,
        beats,
      };
    } else {
      let fallbackTitle = baseTopic
        ? `${titlePrefixHint || 'Faça isso:'} ${baseTopic}`.slice(0, 60)
        : `Faça isso no ${fmtLabel}`;
      let scriptLines: string[] = [];
      const oneLiner = theme || (captions[0] ? snippet(captions[0], 10) : baseTopic || 'aplique hoje e compare o resultado');
      scriptLines.push(`${titlePrefixHint || 'Faça isso'} (${fmtLabel}${tone ? ` • ${tone}` : ''}): ${oneLiner}…`);
      scriptLines.push('1. Mostre rapidamente o antes vs depois.');
      scriptLines.push('2. Explique o passo principal em 1 frase.');
      scriptLines.push('3. Dê 1 dica prática ou exemplo claro.');
      if (bullets) scriptLines.push('Referências dos seus posts:');
      if (bullets) scriptLines.push(bullets);
      scriptLines.push(`CTA: ${ctaHint || 'Comente sua dúvida e salve para aplicar.'}`);
      const fallbackScript = scriptLines.join('\n');

      const enforced = enforceThemePresence({
        title: fallbackTitle,
        script: fallbackScript,
        themeKeyword: theme,
        strategy: effStrategy,
        titlePrefixHint,
      });

      const beats: string[] = [
        `Gancho — ${theme || baseTopic || 'problema'} em 3s`,
        'Passo 1 — setup simples',
        'Passo 2 — execução',
        'Passo 3 — reforço/checagem',
        'CTA — comentar e salvar',
      ];

      return {
        title: enforced.title,
        script: enforced.script,
        hashtags: uniqTags,
        recordingTimeSec: estimateRecordingTimeSec(enforced.script, tone),
        tone,
        beats,
      };
    }
  }

  // --- Com API (OpenAI) ---
  const openai = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  });
  const { dayOfWeek, blockStartHour, format, categories, isExperiment, strategy, sourceCaptions, externalSignals, themeKeyword } = input;

  // Enrich categories with labels and descriptions
  const categoryDetails = {
    context: (categories?.context || []).map(id => {
      const c = getCategoryById(id, 'context');
      return { id, label: c?.label || id, description: c?.description || '' };
    }),
    proposal: (categories?.proposal || []).map(id => {
      const c = getCategoryById(id, 'proposal');
      return { id, label: c?.label || id, description: c?.description || '' };
    }),
    reference: (categories?.reference || []).map(id => {
      const c = getCategoryById(id, 'reference');
      return { id, label: c?.label || id, description: c?.description || '' };
    }),
    tone: categories?.tone ? (() => {
      const c = getCategoryById(categories.tone!, 'tone');
      return { id: categories.tone!, label: c?.label || categories.tone!, description: c?.description || '' };
    })() : undefined,
  } as const;

  const sys =
`Você é um assistente especializado em roteiros curtos para Instagram (Reels/Posts).
Gere um título conciso (máx. 60 chars), um roteiro direto (com gancho forte) e um plano de cena (beats) com 3–6 itens curtos.
Responda obrigatoriamente em JSON com as chaves: title, script, hashtags[], beats?.`;

  const user = {
    dayOfWeek,
    blockStartHour,
    format,
    categories,
    categoryDetails,
    themeKeyword: themeKeyword || null, // tema explícito
    sourceCaptions: (sourceCaptions || []).slice(0, 8),
    externalSignals: (externalSignals || []).slice(0, 3),
    objective: isExperiment ? 'descobrir_compartilhamentos' : 'maximizar_views',
    strategy: effStrategy,
    constraints: {
      language: 'pt-BR',
      reelDurationSecTarget: 30,
    }
  };

  const imperativeHint = (effStrategy === 'practical_imperative')
    ? `\n- ESTILO DE TÍTULO: Use verbo no imperativo e seja prático (ex.: "Faça isso:", "Mostre", "Aprenda a"). Máx. 60 caracteres.\n- ROTEIRO: Comece com um comando curto. Liste 2–4 passos numerados e 1 exemplo.\n`
    : `\n- Título objetivo com até 60 caracteres.\n- Roteiro direto com 2–4 pontos objetivos.\n`;

  const scenarioHint = (effStrategy === 'scenario_script')
    ? `\n- ROTEIRO EM CENA: Escreva como cena curta com marcações de tempo (0:00, 0:03...). Inclua falas curtas (Chefe:, Você:), rubricas (\\*olha o relógio\\*), 3 momentos (conflito, ação, desfecho) e CTA contextual.\n- TÍTULO: objetivo, opcionalmente prefixado por "Cena:" ou "Quando...". Máx. 60 caracteres.\n`
    : '';

  const experimentHint = (isExperiment || strategy === 'focus_shares')
    ? `\n- MODO TESTE: Otimize para COMPARTILHAMENTOS (insight contraintuitivo, lista rápida, "envie para alguém").\n`
    : '';

  const lengthHint = (strategy === 'shorter') ? `\n- Enxugue ao máximo: 2–3 frases no total, CTA curto.\n` : '';
  const humorHint  = (strategy === 'more_humor') ? `\n- Toque leve de humor situacional, mantendo clareza.\n` : '';
  const strongHookHint = (strategy === 'strong_hook') ? `\n- Primeira frase deve causar curiosidade imediata.\n` : '';

  // 🔹 reforço claro do uso do tema
  const themeHint =
`\n- Se "themeKeyword" existir: 
  1) **inclua a palavra exata do tema no TÍTULO**;
  2) **inclua a palavra do tema nos primeiros 120 caracteres do roteiro** (gancho);
  3) alinhe o conteúdo do roteiro ao tema, sem enrolação.`;

  // Hints adicionais baseados nas categorias para orientar, sem engessar
  const cats = input.categories || {};
  const pIds = (cats.proposal || []).map(x => String(x).toLowerCase());
  const cIds = (cats.context || []).map(x => String(x).toLowerCase());
  const hasP = (id: string) => pIds.includes(id);
  const hasC = (id: string) => cIds.includes(id);
  const themeWord = (input.themeKeyword || '').trim();

  const comparisonRegionalHint = (hasP('comparison') && hasC('regional_stereotypes'))
    ? `- Traga contraste regional quando fizer sentido (ex.: carioca vs paulista) aplicado ao tema ${themeWord ? '"'+themeWord+'"' : ''}.\n`
    : '';
  const relationshipsHint = hasC('relationships_family')
    ? `- Sugira 1 cena em casal quando natural (ex.: "quando vou com meu namorado pra ${themeWord || 'o tema'}").\n`
    : '';

  const prompt =
    `Contexto do Slot:\n${JSON.stringify(user, null, 2)}\n\n` +
    `Instruções:\n- Use categoryDetails (labels+descrições) e sourceCaptions (legendas reais do criador neste horário) como referências conceituais; **não copie literalmente**.\n` +
    scenarioHint +
    imperativeHint +
    experimentHint +
    lengthHint +
    humorHint +
    strongHookHint +
    comparisonRegionalHint +
    relationshipsHint +
    themeHint +
    `\n- Se externalSignals vier preenchido, use pelo menos 1 sinal atual como gancho (não invente fatos).\n- CTA claro no final (ex.: "${ctaHint || 'Comente X e salve'}").\n- Ajuste tom conforme categories.tone.\n- Hashtags 3–6, relevantes ao contexto.\n- Gere também um plano de cena (beats) com 3 a 6 itens curtos e acionáveis.\n- Saída: **JSON puro** válido com: {"title": string, "script": string, "hashtags"?: string[], "beats"?: string[]}.`;

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: Number(process.env.OPENAI_TEMP || 0.7),
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' } as any,
  } as any);

  const content = completion.choices?.[0]?.message?.content || '{}';
  let parsed: any = {};
  try { parsed = JSON.parse(content); } catch {}
  let title: string = typeof parsed.title === 'string' ? parsed.title : '[Rascunho] Título';
  let script: string = typeof parsed.script === 'string' ? parsed.script : 'Roteiro gerado.';
  const hashtagsFromAI: string[] = Array.isArray(parsed.hashtags) ? parsed.hashtags.filter((h: any) => typeof h === 'string') : [];
  const beatsFromAI: string[] = Array.isArray(parsed.beats) ? parsed.beats.filter((b: any) => typeof b === 'string') : [];

  // complete hashtags (se vierem poucas)
  const fmtLabel = formatLabel(format);
  const baseTags = [
    input.themeKeyword || '',
    toLabel(categories?.context?.[0], 'context'),
    toLabel(categories?.proposal?.[0], 'proposal'),
    toLabel(categories?.reference?.[0], 'reference'),
    fmtLabel
  ].map(toHashtag).filter(Boolean);
  const hashtags = Array.from(new Set([...(hashtagsFromAI || []), ...baseTags])).slice(0, 6);

  const tone = toLabel(categories?.tone, 'tone') || categories?.tone;

  // 🔹 GARANTE presença do tema no título e início do script
  const enforced = enforceThemePresence({
    title,
    script,
    themeKeyword: input.themeKeyword,
    strategy: effStrategy,
    titlePrefixHint,
  });
  title = enforced.title;
  script = enforced.script;

  const recordingTimeSec = estimateRecordingTimeSec(script, tone);

  return { title, script, hashtags, tone, recordingTimeSec, beats: beatsFromAI };
}

/* =============================================================================
   THEMES GENERATION — ideias que começam com a keyword
============================================================================= */
export async function generateThemes(input: {
  keyword: string;
  categories?: { context?: string[]; tone?: string; proposal?: string[]; reference?: string[] };
  sourceCaptions?: string[];
  externalSignals?: { title: string; url?: string; source?: string; }[];
  count?: number;
  startWithKeyword?: boolean; // modo flex: keyword presente, mas não necessariamente no início
  styleHints?: string[];      // dicas de estilo/estrutura vindas das categorias
}): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  const count = Math.min(8, Math.max(3, input.count || 5));
  if (!apiKey) {
    return [];
  }
  const openai = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  });
  const sys = `Você é um gerador de TEMAS para vídeos curtos (Reels). Gere ideias curtas, diretas e específicas, guiadas por contexto.`;
  const userPayload = {
    keyword: input.keyword,
    categories: input.categories,
    sourceCaptions: (input.sourceCaptions || []).slice(0, 8),
    externalSignals: (input.externalSignals || []).slice(0, 3),
    styleHints: (input.styleHints || []).slice(0, 8),
    rules: {
      language: 'pt-BR',
      mustStartWithKeyword: !!input.startWithKeyword,
      count,
    }
  };
  // exemplos curtos opcionais
  const examples: string[] = [];
  const kw = String(input.keyword || '').trim();
  const hints = new Set((input.styleHints || []).map(h => String(h).toLowerCase()));
  if (kw) {
    if (hints.has('regional_vs') || hints.has('comparison')) {
      examples.push(`carioca vs paulista na ${kw}`);
    }
    if (hints.has('couple') || hints.has('relationships')) {
      examples.push(`quando vou com meu namorado pra ${kw}`);
    }
    if (hints.has('how_to') || hints.has('guide') || hints.has('tutorial') || hints.has('tips')) {
      examples.push(`como usar ${kw} em 3 passos`);
    }
    if (hints.has('humor') || hints.has('humor_scene')) {
      examples.push(`${kw} quando tudo dá ruim`);
    }
  }

  const startRule = userPayload.rules.mustStartWithKeyword
    ? `- Cada tema DEVE começar com a palavra-chave (case-insensitive): "${kw}".`
    : `- Inclua a palavra-chave (case-insensitive): "${kw}" de forma natural; não precisa iniciar a frase.`;

  const prompt =
    `Gere uma lista de ${count} TEMAS. Regras:\n`+
    `${startRule}\n`+
    `- Use as legendas (sourceCaptions) como contexto para sugerir situações reais; não copie trechos.\n`+
    `- Considere categories (proposal/context/tone/reference) para ajustar estilo.\n`+
    `- Evite termos genéricos, não use hashtags, não use emojis.\n`+
    `- Seja específico (ex.: "no metrô lotado", "quando tudo dá ruim", "pra resolver X em casa").\n`+
    (examples.length ? `- Exemplos de estilo (não copie literalmente): ${examples.map(e => `"${e}"`).join(', ')}\n` : '') +
    (userPayload.styleHints?.length ? `- Siga estes hints de estilo quando fizer sentido: ${userPayload.styleHints.join('; ')}\n` : '') +
    `- Responda EXCLUSIVAMENTE em JSON com {"themes": string[]}.\n`+
    `\nContexto:\n${JSON.stringify(userPayload, null, 2)}`;

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: Number(process.env.OPENAI_TEMP || 0.7),
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' } as any,
  } as any);

  const content = completion.choices?.[0]?.message?.content || '{}';
  try {
    const parsed = JSON.parse(content);
    const arrRaw: string[] = Array.isArray(parsed?.themes)
      ? (parsed.themes as unknown[]).filter((t: unknown): t is string => typeof t === 'string')
      : [];
    // Pós-processamento: dedupe simples, remove vazios e corta em até count
    const norm = (s: string) => s.trim().replace(/\s+/g, ' ');
    const uniq = Array.from(new Set(arrRaw.map(norm))).filter((s): s is string => !!s);
    return uniq.slice(0, count);
  } catch {
    return [];
  }
}

export type GeneratedPautaIdea = {
  title: string;
  reason: string;
};

function formatPlannerWindowLabel(dayOfWeek?: number, blockStartHour?: number) {
  const weekdays = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const safeDay = typeof dayOfWeek === 'number' && Number.isFinite(dayOfWeek) ? dayOfWeek : null;
  const resolvedDay =
    safeDay === null
      ? null
      : weekdays[safeDay === 7 ? 0 : safeDay] || weekdays[((safeDay % 7) + 7) % 7];
  const resolvedHour =
    typeof blockStartHour === 'number' && Number.isFinite(blockStartHour)
      ? `${String(blockStartHour).padStart(2, '0')}h`
      : null;
  return resolvedDay && resolvedHour ? `${resolvedDay}, ${resolvedHour}` : resolvedDay || resolvedHour || null;
}

function buildPlannerCategoryDetails(categories?: PlannerCategories) {
  return {
    context: (categories?.context || []).map((id) => {
      const category = getCategoryById(id, 'context');
      return { id, label: category?.label || id, description: category?.description || '' };
    }),
    proposal: (categories?.proposal || []).map((id) => {
      const category = getCategoryById(id, 'proposal');
      return { id, label: category?.label || id, description: category?.description || '' };
    }),
    reference: (categories?.reference || []).map((id) => {
      const category = getCategoryById(id, 'reference');
      return { id, label: category?.label || id, description: category?.description || '' };
    }),
    tone: categories?.tone
      ? (() => {
          const category = getCategoryById(categories.tone, 'tone');
          return { id: categories.tone, label: category?.label || categories.tone, description: category?.description || '' };
        })()
      : undefined,
    contentIntent: (categories?.contentIntent || []).map((id) => {
      const category = getV2CategoryById(id, 'contentIntent');
      return { id, label: category?.label || id, description: category?.description || '' };
    }),
    narrativeForm: (categories?.narrativeForm || []).map((id) => {
      const category = getV2CategoryById(id, 'narrativeForm');
      return { id, label: category?.label || id, description: category?.description || '' };
    }),
    proofStyle: (categories?.proofStyle || []).map((id) => {
      const category = getV25CategoryById(id, 'proofStyle');
      return { id, label: category?.label || id, description: category?.description || '' };
    }),
    commercialMode: (categories?.commercialMode || []).map((id) => {
      const category = getV25CategoryById(id, 'commercialMode');
      return { id, label: category?.label || id, description: category?.description || '' };
    }),
  };
}

function stripEmoji(value: string) {
  return value.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').replace(/\s+/g, ' ').trim();
}

function normalizeGeneratedPautaTitle(value: string) {
  return stripEmoji(value).replace(/^[-–•\d.:\s]+/, '').trim();
}

function normalizeGeneratedPautaReason(value: string) {
  return stripEmoji(value)
    .replace(/^(um\s+)?momento\s+engra[cç]ado\s+de\s+/i, '')
    .replace(/^uma\s+situa[cç][aã]o\s+c[oô]mica\s+de\s+/i, '')
    .replace(/^mostra(ndo)?\s+/i, '')
    .replace(/^aborda(ndo)?\s+/i, '')
    .trim();
}

function scorePautaSpecificity(title: string, themeKeyword: string) {
  const normalized = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const theme = themeKeyword
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  let score = 0;
  if (/\b(quando|pov|eu tentando|voce tenta|voce deita|alguem|amigo|familia|vizinho|mensagem|grupo|trabalho|chefe|casa)\b/.test(normalized)) {
    score += 3;
  }
  if (/\b(celular|notificacao|alarme|obra|barulho|liquidificador|porta|interfone|vizinho|mensagem|grupo|audio|louca|roupa|cama|sofa)\b/.test(normalized)) {
    score += 2;
  }
  if (/\b(e|mas|so que|ate que|porque|enquanto)\b/.test(normalized)) score += 1;
  if (theme && normalized.includes(theme)) score += 1;
  if (/^(expectativa\s+vs\s+realidade|5\s+erros|como\s+fazer|guia\s+definitivo|passo\s+a\s+passo)/.test(normalized)) {
    score -= 2;
  }
  if (/\b(decidi|tentei relaxar|fui relaxar)\b/.test(normalized)) score -= 1;
  if (/\b(gato|cachorro|pet)\b/.test(normalized)) score -= 1;
  if (/\b(o mundo|a vida|a rotina|a cultura viral|tudo conspira|nao deixa)\b/.test(normalized)) score -= 1;
  if (!theme.includes('medit') && /\b(meditacao|meditar)\b/.test(normalized)) score -= 2;
  if (normalized.length < 18 || normalized.length > 68) score -= 1;
  return score;
}

function hasMotivationalBrief(branchSummary?: string[]) {
  return (branchSummary || []).some((item) =>
    /motivacional|inspirador|mensagem/i.test(item)
  );
}

function scorePautaBriefFit(
  pauta: GeneratedPautaIdea,
  input: { themeKeyword: string; branchSummary?: string[]; editorialGuidance?: string[]; format?: string }
) {
  const title = pauta.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const reason = pauta.reason.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const text = `${title} ${reason}`;
  const brief = [...(input.branchSummary || []), ...(input.editorialGuidance || [])]
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  let score = scorePautaSpecificity(pauta.title, input.themeKeyword);

  if (hasMotivationalBrief(input.branchSummary)) {
    if (/\b(une|abraco|salva|aprendi|licao|afeto|carinho|cuidado|familia|amizade|apoio|valor|pertenc|reconcilia|termina bem|no fim)\b/.test(text)) {
      score += 2;
    }
    if (/\b(sem licao|moral da historia|autoajuda|frase motivacional|gratiluz)\b/.test(text)) {
      score -= 2;
    }
  }

  if (/\breuniao em familia\b/.test(title)) score -= 1;
  if (/\b(almoco|jantar|mesa|grupo da familia|grupo das amigas|casa|churrasco)\b/.test(title)) score += 1;
  if (/\b(humor|cena|entreter|sketch)\b/.test(brief)) {
    if (/\b(quando|pov|eu tentando|voce tentando|voce tenta|na hora que|so que|mas)\b/.test(text)) score += 2;
    if (/\b(aprenda|guia|passo a passo|dicas para|como fazer)\b/.test(title)) score -= 2;
  }
  if (/\b(educacional|ensinar|tutorial|dicas|checklist|passo aplicavel)\b/.test(brief)) {
    if (/\b(erro|passo|checklist|antes de|como|dica|resolve|aprenda|evite|na pratica)\b/.test(text)) score += 2;
    if (/\b(quando|pov)\b/.test(title) && !/\b(erro|dica|passo|como)\b/.test(text)) score -= 1;
  }
  if (/\b(autoridade|opiniao|critico|mito|verdade|mercado|comparacao)\b/.test(brief)) {
    if (/\b(mito|verdade|ninguem|por que|pare de|o erro|opinio|comparar|versus|vs|melhor|pior)\b/.test(text)) score += 2;
    if (/\b(coisa|situa[cç]ao|momento|dilema)\b/.test(title)) score -= 1;
  }
  if (/\b(conversao|comercial|promocional|divulgacao|converter|comprar|oferta)\b/.test(brief)) {
    if (/\b(vale|testei|antes de comprar|economiza|resultado|obje[cç]ao|duvida|na pratica|por dentro)\b/.test(text)) score += 2;
    if (/\b(compre|link na bio|promo[cç]ao|garanta ja)\b/.test(title)) score -= 2;
  }
  if (/\b(review|prova|demonstracao|antes\/depois|unboxing)\b/.test(brief)) {
    if (/\b(teste|testei|antes e depois|resultado|na pratica|por dentro|primeira vez|vale)\b/.test(text)) score += 2;
  }
  if (/\b(informativo|noticia|informar|news)\b/.test(brief)) {
    if (/\b(o que mudou|entenda|impacta|por que importa|explica|agora)\b/.test(text)) score += 2;
  }
  if (/\b(conexao|pergunta|q&a|resposta|aproximar)\b/.test(brief)) {
    if (/\b(pergunta|respondi|quem nunca|voce tambem|comentario|duvida)\b/.test(text)) score += 2;
  }
  if (/\b(bastidores|processo|preparacao)\b/.test(brief)) {
    if (/\b(bastidor|por tras|preparo|antes de|erro|processo|tentativa)\b/.test(text)) score += 2;
  }
  if (/\b(carrossel|primeira lamina)\b/.test(brief)) {
    if (/\b(checklist|antes de|erros|sinais|passos|guia|compare)\b/.test(title)) score += 1;
    if (/\b(quando|pov|eu tentando)\b/.test(title)) score -= 1;
  }
  if (/\b(formato foto|foto)\b/.test(brief)) {
    if (/\b(foto|legenda|pose|registro|antes de|detalhe)\b/.test(text)) score += 1;
  }
  return score;
}

function rankGeneratedPautas(pautas: GeneratedPautaIdea[], themeKeyword: string) {
  const seen = new Set<string>();
  return pautas
    .map((pauta, index) => ({
      ...pauta,
      title: normalizeGeneratedPautaTitle(pauta.title),
      reason: normalizeGeneratedPautaReason(pauta.reason),
      index,
    }))
    .filter((pauta) => {
      if (!pauta.title) return false;
      const key = pauta.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const scoreDelta = scorePautaSpecificity(b.title, themeKeyword) - scorePautaSpecificity(a.title, themeKeyword);
      if (scoreDelta !== 0) return scoreDelta;
      return a.index - b.index;
    })
    .map(({ index: _index, ...pauta }) => pauta);
}

export async function generatePautaIdeas(input: {
  themeKeyword: string;
  format?: string;
  dayOfWeek?: number;
  blockStartHour?: number;
  categories?: PlannerCategories;
  sourceCaptions?: string[];
  branchSummary?: string[];
  editorialGuidance?: string[];
  count?: number;
}): Promise<GeneratedPautaIdea[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('[planner/ai] OPENAI_API_KEY missing; skipping pauta generation', {
      themeKeyword: input.themeKeyword,
      format: input.format || null,
      dayOfWeek: input.dayOfWeek ?? null,
      blockStartHour: input.blockStartHour ?? null,
    });
    return [];
  }

  const openai = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  });

  const count = Math.min(10, Math.max(3, input.count || 5));
  const sys = `Você é um estrategista editorial de Instagram. Sua missão é gerar PAUTAS de posts que respeitam estritamente o recorte escolhido pelo usuário no funil.`;
  
  const prompt = `Gere ${count} pautas para Instagram com base no tema editorial "${input.themeKeyword}" e nas seleções obrigatórias abaixo.

Seleções obrigatórias do funil:
${input.branchSummary?.length ? input.branchSummary.map((item) => `- ${item}`).join('\n') : '- N/A'}

Diretrizes editoriais derivadas da combinação:
${input.editorialGuidance?.length ? input.editorialGuidance.map((item) => `- ${item}`).join('\n') : '- Use o recorte do funil para escolher a melhor estrutura editorial.'}

Interpretação do tema:
- Trate "${input.themeKeyword}" como um recorte de assunto para conteúdo, não como uma oferta de serviço, sessão, aula ou produto.
- Se o tema for genérico (ex.: relaxar), transforme em situação, tensão ou comportamento cotidiano ligado às seleções do funil.
- Não troque o tema por outro subtópico específico. Ex.: se o tema é "relaxar", não transforme tudo em "meditação" a menos que isso tenha sido selecionado.

Regras:
- Cada pauta deve combinar explicitamente tema + contexto + proposta + intenção + tom + formato.
- Priorize ideias filmáveis para ${input.format || 'Reel/Post'}, com gancho visual ou situação concreta.
- Escolha a estrutura de título conforme a diretriz editorial: cena para humor/lifestyle; promessa prática para educacional; opinião/tensão para autoridade; teste/prova para review/conversão.
- Quando a proposta for cena/humor/lifestyle, o título precisa deixar clara uma cena: pessoa/ator + tentativa/desejo + obstáculo ou contraste observável.
- Prefira estruturas como "Quando...", "POV:", "Eu tentando..." apenas quando elas forem coerentes com a proposta e trouxerem uma cena específica.
- Para dicas/educacional/carrossel, prefira títulos úteis e específicos como erro, checklist, antes de, passo ou comparação aplicável.
- Para autoridade/opinião, prefira tensão clara: mito, verdade, erro comum, comparação ou ponto de vista.
- Para comercial/conversão, use prova de uso, objeção, desejo ou resultado concreto sem soar como anúncio.
- Para review/unboxing/prova, prometa teste, observação, antes/depois ou demonstração concreta.
- Para informativo/notícia, deixe claro o que mudou ou por que importa sem inventar fatos.
- Evite primeira pessoa no passado ("decidi", "fui", "tentei") e prefira uma situação universal que qualquer seguidor reconheça.
- Não invente personagens/props muito específicos (ex.: gato, pet, namorado, chefe) se isso não vier das legendas recentes; prefira obstáculos universais como barulho, mensagem, família, casa, celular, vizinho, rotina.
- Prefira obstáculos visuais específicos em vez de abstrações. Melhor: "o celular toca", "começa obra", "chega áudio no grupo". Pior: "o mundo não deixa", "a rotina atrapalha".
- Cada título deve sugerir uma primeira cena gravável em até 5 segundos.
- Se as seleções incluírem "Mensagem/Motivacional" ou "Inspirador/Motivacional", a cena precisa ter uma virada leve de significado: afeto, apoio, pertencimento, reconciliação, cuidado ou valorização dos laços.
- Essa virada motivacional deve nascer da cena, sem parecer autoajuda, frase pronta ou conselho genérico.
- Para família/relacionamentos, prefira situações naturais: almoço, jantar, grupo da família, mesa, casa, churrasco, áudio, conversa atravessada. Evite termos formais como "reunião em família".
- Cada título deve ter no máximo 64 caracteres.
- Não use emojis.
- Evite títulos genéricos como "5 erros", "como fazer", "guia definitivo" e "Expectativa vs Realidade" sem uma cena específica do recorte.
- Não gere pautas que soem como anúncio de sessão, terapia, curso, desafio genérico ou produto.
- A "reason" deve ser uma nota de cena filmável em até 110 caracteres.
- A "reason" não deve usar termos meta como "engajamento", "identificação", "público", "mostra", "situação cômica", "momento engraçado".
${input.sourceCaptions?.length ? `- Use estas legendas recentes como inspiração de tom: ${input.sourceCaptions.slice(0, 5).join(' | ')}` : ''}

Responda EXCLUSIVAMENTE como JSON: {"pautas": [{"title": string, "reason": string}]}.`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.55,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' } as any,
    } as any);

    const content = completion.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    const pautas = Array.isArray(parsed?.pautas)
      ? parsed.pautas
          .map((p: any) => ({
            title: normalizeGeneratedPautaTitle(String(p?.title || '')),
            reason: normalizeGeneratedPautaReason(String(p?.reason || '').trim()),
          }))
          .filter((p: any) => p.title)
      : [];
    
    return rankGeneratedPautas(pautas, input.themeKeyword)
      .sort((a, b) => scorePautaBriefFit(b, input) - scorePautaBriefFit(a, input))
      .slice(0, count);
  } catch (err) {
    logger.error('[planner/ai] Error generating pauta ideas:', err);
    return [];
  }
}
