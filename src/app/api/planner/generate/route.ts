// src/app/api/planner/generate/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import AIGeneratedPost from '@/app/models/AIGeneratedPost';
import { generatePostDraft, generateThemeKeyword } from '@/app/lib/planner/ai';
import { fetchGoogleNewsSignals } from '@/utils/newsSignals';
import { getCategoryById } from '@/app/lib/classification';
import { getBlockSampleCaptions } from '@/utils/getBlockSampleCaptions';
import { Types } from 'mongoose';
import { ensurePlannerAccess } from '@/app/lib/planGuard';
import { checkRateLimit } from '@/utils/rateLimit';
import { logger } from '@/app/lib/logger';
import { WINDOW_DAYS, PLANNER_TIMEZONE } from '@/app/lib/planner/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Loader dinâmico do modelo PlannerPlan (tolerante a default/nomeados) */
let _PlannerPlanModel: any;
async function loadPlannerPlanModel() {
  if (_PlannerPlanModel) return _PlannerPlanModel;
  const mod: any = await import('@/app/models/PlannerPlan');
  const candidate =
    mod?.default ??
    mod?.PlannerPlan ??
    mod?.PlannerPlanModel ??
    mod;

  const ok =
    candidate &&
    typeof candidate === 'function' &&
    typeof candidate.findOne === 'function' &&
    typeof candidate.findOneAndUpdate === 'function';

  if (!ok) {
    const keys = mod && typeof mod === 'object' ? Object.keys(mod) : [];
    logger.error('[planner/generate] PlannerPlan inválido. typeof=%s keys=%o', typeof candidate, keys);
    throw new Error(
      '[planner/generate] Não foi possível resolver o Model PlannerPlan a partir de "@/app/models/PlannerPlan". ' +
      'Verifique se o arquivo exporta o Mongoose Model, por ex.: ' +
      'export default PlannerPlanModel; export { PlannerPlanModel as PlannerPlan, PlannerPlanModel };'
    );
  }

  _PlannerPlanModel = candidate;
  return _PlannerPlanModel;
}

/** Offset (ms) do fuso desejado em relação ao UTC no instante fornecido. */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour || '0'),
    Number(map.minute || '0'),
    Number(map.second || '0')
  );
  return asUTC - date.getTime();
}

/** Segunda 00:00 local no fuso informado → instante UTC real */
function normalizeToMondayInTZ(d: Date, timeZone: string): Date {
  const zoned = new Date(d.getTime() + getTimeZoneOffsetMs(d, timeZone));
  const dow = zoned.getUTCDay(); // 0..6
  const shift = dow === 0 ? -6 : 1 - dow;
  const mondayLocal = new Date(
    Date.UTC(zoned.getUTCFullYear(), zoned.getUTCMonth(), zoned.getUTCDate() + shift, 0, 0, 0, 0)
  );
  return new Date(mondayLocal.getTime() - getTimeZoneOffsetMs(mondayLocal, timeZone));
}

/* =======================
   Tema a partir de legendas
   ======================= */

// normaliza token: minúsculas, sem acento, só [a-z0-9]
function normToken(t: string): string {
  return (t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .replace(/[^a-z0-9]+/gi, '');
}
const STOPWORDS_PT = new Set<string>([
  'a','o','os','as','um','uma','uns','umas','de','do','da','dos','das','em','no','na','nos','nas','por','para','com','sem',
  'sobre','entre','e','ou','mas','que','se','ja','já','nao','não','sim','ao','aos','à','as','às','como','quando','onde',
  'porque','porquê','pra','pro','pela','pelo','pelos','pelas','lhe','eles','elas','ele','ela','eu','tu','voce','você',
  'voces','vocês','me','te','seu','sua','seus','suas','meu','minha','meus','minhas','este','esta','esses','essas','isso',
  'isto','aquele','aquela','aqueles','aquelas','tambem','também','muito','muita','muitos','muitas','pouco','pouca','poucos',
  'poucas','mais','menos','todo','toda','todos','todas','cada','ate','até','mes','mês','ano','dia','hoje','amanha','amanhã',
  'ontem','agora','aqui','ali','la','lá','bem','mal','ser','estar','ter','fazer','vai','vou','ta','tá','ne','né','eh','ah',
  'oh','ok','depois','antes','durante','entao','então','tipo','coisa','coisas',
  // redes
  'conteudo','conteúdo','video','vídeo','reel','reels','post','posts','story','stories','live','shorts','instagram','tiktok',
  'canal','feed','viral','algoritmo'
].map(normToken));

function isAllDigits(s: string) { return /^[0-9]+$/.test(s); }

/** Extrai a palavra (token) mais frequente das legendas, ignorando stopwords; min len=4. */
function extractTopKeywordFromCaptions(captions: string[]): string | undefined {
  const freq = new Map<string, number>();
  for (const cap of captions) {
    const tokens = (cap || '').split(/[^\p{L}\p{N}]+/u).map(normToken).filter(Boolean);
    for (const tk of tokens) {
      if (tk.length < 4) continue;
      if (STOPWORDS_PT.has(tk)) continue;
      if (isAllDigits(tk)) continue;
      freq.set(tk, (freq.get(tk) || 0) + 1);
    }
  }
  const best = [...freq.entries()].sort((a,b) => b[1]-a[1])[0];
  return best?.[0];
}

/** Fallback: tenta derivar 1 palavra de um rótulo de categoria (proposal/context) */
function keywordFromCategoryLabel(label?: string): string | undefined {
  if (!label) return undefined;
  const tokens = label.split(/[^\p{L}\p{N}]+/u).map(normToken).filter(Boolean);
  const good = tokens.filter(t => t.length >= 3 && !STOPWORDS_PT.has(t) && !isAllDigits(t));
  return good.sort((a,b) => b.length - a.length)[0];
}

/** Garante que o tema seja 1 palavra (letras/dígitos), comece por letra e não seja só número; máx 24 chars. */
function sanitizeThemeKeyword(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const m = v.trim().match(/\p{L}[\p{L}\p{N}]*/u);
  const word = m?.[0] || '';
  if (!word) return undefined;
  if (/^\d+$/.test(word)) return undefined;
  return word.slice(0, 24);
}

// Implementação com suporte a themeKeyword
export async function POST(request: Request) {
  const session = (await getServerSession(authOptions as any)) as Session | null;
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const weekStartRaw: string | undefined = body?.weekStart;
    const slotFromBody: any = body?.slot || null;
    const slotId: string | undefined = body?.slotId;
    const strategy: any = body?.strategy || 'default';
    const noSignals: boolean = Boolean(body?.noSignals);

    if (!weekStartRaw && !slotFromBody) {
      return NextResponse.json({ ok: false, error: 'weekStart ou slot é obrigatório' }, { status: 400 });
    }

    // ⚠️ Padroniza Monday 00:00 no fuso do planner
    const weekStart = weekStartRaw
      ? normalizeToMondayInTZ(new Date(weekStartRaw), PLANNER_TIMEZONE)
      : normalizeToMondayInTZ(new Date(), PLANNER_TIMEZONE);

    const routePath = new URL(request.url).pathname;
    const access = await ensurePlannerAccess({ session, routePath, forceReload: true });
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.message, reason: access.reason },
        { status: access.status }
      );
    }

    await connectToDatabase();

    // Rate limit: 10 gerações / 5 minutos
    const rl = await checkRateLimit(`planner:gen:${session.user.id}`, 10, 300);
    if (!rl.allowed) {
      return NextResponse.json({ ok: false, error: 'Limite de geração atingido. Tente novamente em alguns minutos.' }, { status: 429 });
    }

    // Carrega/resolve slot
    let slot: any | null = null;
    const PlannerPlan = await loadPlannerPlanModel();
    let planDoc = await PlannerPlan.findOne({ userId: session.user.id, platform: 'instagram', weekStart });
    if (slotId && planDoc) {
      slot = planDoc.slots.find((s: any) => s.slotId === slotId) || null;
    }
    if (!slot && slotFromBody) slot = slotFromBody;
    if (!slot) return NextResponse.json({ ok: false, error: 'Slot não encontrado' }, { status: 404 });

    // Normalização defensiva
    slot.categories = slot.categories || {};

    // Amostras reais de legendas no bloco
    const caps = await getBlockSampleCaptions(
      session.user.id,
      WINDOW_DAYS,
      slot.dayOfWeek,
      slot.blockStartHour,
      {
        formatId: slot.format,
        contextId: slot.categories?.context?.[0],
        proposalId: slot.categories?.proposal?.[0],
        referenceId: slot.categories?.reference?.[0],
      },
      5
    );

    // 1) Tema dominante centralizado (preferir helper com IA/fallback)
    const kwFromCaptions = extractTopKeywordFromCaptions(caps);
    const prop0 = slot.categories?.proposal?.[0];
    const ctx0  = slot.categories?.context?.[0];
    const propLabel = prop0 ? (getCategoryById(prop0, 'proposal')?.label || prop0) : undefined;
    const ctxLabel  = ctx0 ? (getCategoryById(ctx0, 'context')?.label || ctx0) : undefined;
    const kwFromCat = keywordFromCategoryLabel(propLabel) || keywordFromCategoryLabel(ctxLabel);
    const kwFromThemes = (Array.isArray(slot.themes) && slot.themes.length
      ? String(slot.themes[0]).split(/[:\-–—|]/)[0]?.trim()
      : ''
    ) || undefined;

    let themeKeyword = await generateThemeKeyword({
      captions: caps,
      categories: {
        context: Array.isArray(slot.categories?.context) ? (slot.categories!.context as string[]) : undefined,
        proposal: Array.isArray(slot.categories?.proposal) ? (slot.categories!.proposal as string[]) : undefined,
      },
      candidates: (slot.themeKeyword ? [String(slot.themeKeyword)] : []),
    }).catch(() => undefined);

    // ► sanitiza e aplica fallbacks locais caso o helper não retorne
    themeKeyword = sanitizeThemeKeyword(
      themeKeyword ||
      (slot.themeKeyword && String(slot.themeKeyword)) ||
      kwFromCaptions ||
      kwFromCat ||
      kwFromThemes ||
      ''
    );

    logger.info(
      '[planner/generate] user=%s weekStart=%s slotId=%s strategy=%s theme=%s (from=%s)',
      session.user.id,
      weekStart.toISOString(),
      slot?.slotId ?? 'new',
      strategy,
      themeKeyword ?? '(none)',
      themeKeyword && (themeKeyword === (slot.themeKeyword && sanitizeThemeKeyword(String(slot.themeKeyword))) ? 'slot'
        : (themeKeyword === (kwFromCaptions && sanitizeThemeKeyword(kwFromCaptions)) ? 'captions'
          : (themeKeyword === (kwFromCat && sanitizeThemeKeyword(kwFromCat)) ? 'category'
            : (themeKeyword === (kwFromThemes && sanitizeThemeKeyword(kwFromThemes)) ? 'themes' : 'ai'))))
    );

    // Caption sintético
    const catLabel = (id?: string, dim?: 'context' | 'proposal' | 'reference') =>
      (id ? (getCategoryById(id, dim as any)?.label || id) : '').trim();

    const ctxIds: string[] = Array.isArray(slot.categories?.context) ? (slot.categories.context as string[]) : [];
    const propIds: string[] = Array.isArray(slot.categories?.proposal) ? (slot.categories.proposal as string[]) : [];
    const refIds: string[] = Array.isArray(slot.categories?.reference) ? (slot.categories.reference as string[]) : [];

    const ctxLabels = ctxIds.map((id: string) => catLabel(id, 'context')).filter(Boolean) as string[];
    const propLabels = propIds.map((id: string) => catLabel(id, 'proposal')).filter(Boolean) as string[];
    const refLabels = refIds.map((id: string) => catLabel(id, 'reference')).filter(Boolean) as string[];

    const syntheticCaption = themeKeyword
      ? `Tema-chave: ${themeKeyword}. Contexto: ${ctxLabels.slice(0, 3).join(', ') || '—'}. Proposta: ${propLabels
          .slice(0, 3)
          .join(', ') || '—'}. Referência: ${refLabels.slice(0, 2).join(', ') || '—'}.`
      : '';

    const sourceCaptions = syntheticCaption ? [syntheticCaption, ...caps] : caps;

    // Sinais externos
    const keys: string[] = [];
    if (themeKeyword) keys.push(themeKeyword);
    if (propLabel) keys.push(propLabel);
    if (ctxLabel) keys.push(ctxLabel);
    if (caps[0]) keys.push(...caps[0].split(/\s+/).slice(0, 4));

    let signals: { title: string; url?: string; source?: string }[] = [];
    if (!noSignals) {
      const signalsNews = await fetchGoogleNewsSignals(keys, { lang: 'pt-BR', country: 'BR', limit: 2 }).catch(
        () => []
      );
      signals = [
        ...(themeKeyword ? [{ title: themeKeyword, source: 'theme' as const }] : []),
        ...signalsNews,
      ];
    } else {
      if (themeKeyword) signals = [{ title: themeKeyword, source: 'theme' as const }];
    }

    // Geração do rascunho
    const gen = await generatePostDraft({
      userId: session.user.id,
      dayOfWeek: slot.dayOfWeek,
      blockStartHour: slot.blockStartHour,
      format: slot.format,
      categories: slot.categories,
      isExperiment: !!slot.isExperiment,
      strategy: strategy || 'auto',
      sourceCaptions,
      externalSignals: signals,
      themeKeyword,
    });

    // Persiste versão de IA
    const aiDoc = await AIGeneratedPost.create({
      userId: new Types.ObjectId(session.user.id),
      platform: 'instagram',
      planId: (planDoc?._id as any) || null,
      slotId: slot.slotId || null,
      title: gen.title,
      script: gen.script,
      hashtags: gen.hashtags || [],
      tone: gen.tone,
      format: slot.format,
      promptContext: {
        dayOfWeek: slot.dayOfWeek,
        blockStartHour: slot.blockStartHour,
        categories: slot.categories,
        isExperiment: !!slot.isExperiment,
        strategy,
        themeKeyword: themeKeyword || null,
        sourceCaptionsUsed: sourceCaptions.slice(0, 6),
      },
    });

    // Atualiza/Cria plano/slot
    if (!planDoc) {
      planDoc = await PlannerPlan.create({
        userId: new Types.ObjectId(session.user.id),
        platform: 'instagram',
        weekStart,
        slots: [],
      });
    }

    const ensureSlotId = (s: any) => {
      if (typeof s.slotId === 'string' && s.slotId) return s.slotId;
      s.slotId = new Types.ObjectId().toString();
      return s.slotId;
    };

    // Procura slot equivalente
    let idx = -1;
    if (slot.slotId) idx = planDoc.slots.findIndex((s: any) => s.slotId === slot.slotId);
    if (idx === -1)
      idx = planDoc.slots.findIndex(
        (s: any) => s.dayOfWeek === slot.dayOfWeek && s.blockStartHour === slot.blockStartHour && s.format === slot.format
      );

    const updatedSlot = {
      ...slot,
      slotId: ensureSlotId(slot),
      aiVersionId: aiDoc._id,
      title: gen.title,
      scriptShort: gen.script,
      recordingTimeSec: gen.recordingTimeSec,
      themeKeyword: themeKeyword || undefined,
    };

    if (idx >= 0) planDoc.slots[idx] = updatedSlot as any;
    else planDoc.slots.push(updatedSlot as any);

    await planDoc.save();

    return NextResponse.json({
      ok: true,
      aiVersionId: aiDoc._id,
      generated: gen,
      slot: updatedSlot,
      planId: planDoc._id,
      externalSignalsUsed: signals,
    });
  } catch (err) {
    console.error('[planner/generate] Error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to generate' }, { status: 500 });
  }
}
