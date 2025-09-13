import OpenAI from 'openai';
import { getCategoryById } from '@/app/lib/classification';

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
function normalizeToken(t: string): string { return stripDiacritics(t.toLowerCase()).replace(/[^a-z0-9]+/gi, ''); }
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

  const openai = new OpenAI({ apiKey });
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
  const openai = new OpenAI({ apiKey });
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
  const openai = new OpenAI({ apiKey });
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
