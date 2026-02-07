import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { connectToDatabase } from "@/app/lib/mongoose";
import UserModel, { IUser } from "@/app/models/User";
import { callOpenAIForQuestion, generateConversationSummary } from "@/app/lib/aiService";
const { askLLMWithEnrichedContext, buildSurveyProfileSnippet } =
  process.env.NODE_ENV === 'test'
    ? require('../../../../../__mocks__/aiOrchestrator.js')
    : require('@/app/lib/aiOrchestrator');
import type { EnrichedAIContext } from "@/app/api/whatsapp/process-response/types";
import type {
  ChatCompletionMessageParam,
  ChatCompletionUserMessageParam,
  ChatCompletionAssistantMessageParam,
} from 'openai/resources/chat/completions';
import { checkRateLimit } from "@/utils/rateLimit";
const stateService: typeof import('@/app/lib/stateService') =
  process.env.NODE_ENV === 'test'
    ? require('../../../../../__mocks__/stateService.js')
    : require('@/app/lib/stateService');
import type { IDialogueState } from '@/app/lib/stateService';
import { isActiveLike, normalizePlanStatus } from '@/app/lib/planGuard';
import { evaluateUserAccess } from '@/utils/authz';
import { logger } from '@/app/lib/logger';
import { determineIntent, normalizeText } from "@/app/lib/intentService";
import { SUMMARY_GENERATION_INTERVAL, HISTORY_LIMIT, COMPLEX_TASK_INTENTS } from "@/app/lib/constants";
import { aiResponseSuggestsPendingAction } from "@/app/api/whatsapp/process-response/handlerUtils";
import { ensureChatSession, logChatMessage } from "@/app/lib/chatTelemetry";
import { buildChatContext, stringifyChatContext } from "@/app/lib/contextBuilder";
import { chooseVariantFromRollout, experimentConfig, type VariantBucket } from "@/app/lib/experimentConfig";
import { runAnswerEngine } from "@/app/lib/ai/answerEngine/engine";
import { validateAnswerWithContext } from "@/app/lib/ai/answerEngine/validator";
import { coerceToAnswerIntent } from "@/app/lib/ai/answerEngine/policies";
import { stripUnprovenCommunityClaims } from "@/app/lib/text/sanitizeCommunityClaims";
import { fetchTopCategories } from "@/app/lib/dataService";
import {
  buildChatPricingClarification,
  buildChatPricingInsufficientData,
  buildChatPricingResponse,
  parseChatPricingInput,
  shouldHandleChatPricing,
} from "@/app/lib/pricing/chatPricing";
import { runPubliCalculator, type CalculatorParams } from "@/app/lib/pricing/publiCalculator";

// Garante que essa rota use Node.js em vez de Edge (importante para Mongoose).
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const HISTORY_LIMIT_SAFE = HISTORY_LIMIT || 10;
const SUMMARY_INTERVAL_SAFE = SUMMARY_GENERATION_INTERVAL || 6;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const MAX_AI_EXCERPT = 1500;
const MAX_QUERY_CHARS = 4000;
const HARMFUL_PATTERNS = [/su[ií]c[ií]dio/i, /\bme matar\b/i, /\bmatar algu[eé]m\b/i, /aut[oô]mutila/i];
const ANSWER_ENGINE_ENABLED = process.env.ANSWER_ENGINE_ENABLED !== 'false';

async function resolveAuthOptions() {
  if (process.env.NODE_ENV === 'test') return {};
  const mod = await import('@/app/api/auth/[...nextauth]/route');
  return (mod as any)?.authOptions ?? {};
}

function isTableStart(lines: string[], index: number) {
  const first = (lines[index] ?? '').trim();
  const second = (lines[index + 1] ?? '').trim();
  if (!first || !second) return false;
  if (!first.includes('|') || !second.includes('|')) return false;
  return /---/.test(second);
}

export function sanitizeTables(markdown: string): string {
  const lines = markdown.split('\n');
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    if (!isTableStart(lines, i)) {
      output.push(lines[i] ?? '');
      i += 1;
      continue;
    }

    const tableLines: string[] = [];
    let j = i;
    while (j < lines.length) {
      const candidate = (lines[j] ?? '').trim();
      if (!candidate || !candidate.includes('|')) break;
      tableLines.push(lines[j] ?? '');
      j += 1;
    }

    // Preserve tables exactly as returned by the LLM, even if they are wide or sparse.
    output.push(...tableLines);
    i = j;
  }

  return output.join('\n');
}

type ScriptTableRow = {
  time: string;
  visual: string;
  audio: string;
};

type ScriptContractQuality = {
  hasRoteiroBlock: boolean;
  hasLegendaBlock: boolean;
  sceneCount: number;
  hasCta: boolean;
};

type ScriptContractResult = {
  normalized: string;
  repaired: boolean;
  issues: string[];
  quality: ScriptContractQuality;
};

type ScriptInspirationHint = {
  title?: string;
  coverUrl?: string;
  postLink?: string;
  reason?: string;
  supportingInspirations?: Array<{
    role: 'gancho' | 'desenvolvimento' | 'cta';
    title?: string;
    postLink?: string;
    reason?: string;
    narrativeScore?: number;
  }>;
};

type ScriptContractHints = {
  inspiration?: ScriptInspirationHint | null;
};

const stripMarkdownMarkers = (value: string) =>
  (value || '')
    .replace(/\*\*/g, '')
    .replace(/^[-*]\s+/, '')
    .replace(/^"+|"+$/g, '')
    .trim();

const extractTaggedBlock = (text: string, tag: string): string | null => {
  const re = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, 'i');
  const match = text.match(re);
  return match?.[1]?.trim() || null;
};

const findMetadataValue = (content: string, labels: string[]): string | null => {
  const lines = content.split('\n');
  for (const rawLine of lines) {
    const line = stripMarkdownMarkers(rawLine);
    for (const rawLabel of labels) {
      const label = rawLabel.toLowerCase();
      const normalizedLine = line.toLowerCase();
      const marker = `${label}:`;
      if (!normalizedLine.includes(marker)) continue;
      const idx = normalizedLine.indexOf(marker);
      const value = line.slice(idx + marker.length).trim();
      if (value) return value;
    }
  }
  return null;
};

const parseInspirationJson = (value: string | null): ScriptInspirationHint | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
    const coverUrl = typeof parsed.coverUrl === 'string' ? parsed.coverUrl.trim() : '';
    const postLink = typeof parsed.postLink === 'string' ? parsed.postLink.trim() : '';
    const reason = typeof parsed.reason === 'string' ? parsed.reason.trim() : '';
    const supportingInspirations = Array.isArray((parsed as any).supportingInspirations)
      ? (parsed as any).supportingInspirations
        .map((item: any) => {
          const rawRole = typeof item?.role === 'string' ? item.role.toLowerCase().trim() : '';
          const role =
            rawRole === 'gancho' || rawRole === 'desenvolvimento' || rawRole === 'cta'
              ? rawRole
              : null;
          if (!role) return null;
          const itemTitle = typeof item?.title === 'string' ? item.title.trim() : '';
          const itemPostLink = typeof item?.postLink === 'string' ? item.postLink.trim() : '';
          const itemReason = typeof item?.reason === 'string' ? item.reason.trim() : '';
          const itemNarrativeScore = typeof item?.narrativeScore === 'number' ? item.narrativeScore : undefined;
          if (!itemTitle && !itemPostLink && !itemReason) return null;
          return {
            role,
            title: itemTitle || undefined,
            postLink: itemPostLink || undefined,
            reason: itemReason || undefined,
            narrativeScore: itemNarrativeScore,
          };
        })
        .filter(Boolean) as ScriptInspirationHint['supportingInspirations']
      : undefined;

    if (!title && !coverUrl && !postLink && !reason && !supportingInspirations?.length) return null;
    return {
      title: title || undefined,
      coverUrl: coverUrl || undefined,
      postLink: postLink || undefined,
      reason: reason || undefined,
      supportingInspirations,
    };
  } catch {
    return null;
  }
};

const stripDiacritics = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalizeTopicText = (value: string) =>
  stripDiacritics(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const GENERIC_TOPIC_TOKENS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'eu', 'me', 'minha', 'meu',
  'na', 'nas', 'no', 'nos', 'o', 'os', 'ou', 'para', 'pra', 'por', 'que', 'se', 'sua', 'seu', 'um', 'uma',
  'conteudo', 'post', 'postar', 'posts', 'publicar', 'reels', 'reel', 'roteiro', 'script', 'video', 'videos',
  'instagram', 'tiktok', 'segundo', 'segundos', 's', 'ia', 'mobi', 'tema', 'nicho', 'crie', 'criar', 'gere', 'gerar', 'faca',
  'fazer', 'possa', 'quero', 'preciso', 'hoje', 'agora',
]);

const isPlaceholderLike = (value?: string | null) => {
  if (!value) return true;
  const normalized = value.replace(/\s+/g, '');
  if (!normalized) return true;
  return /^[:\-_–—.=|]+$/.test(normalized);
};

const isMarkdownSeparatorRow = (rawRow: string) => {
  const cols = rawRow
    .split('|')
    .map((col) => col.trim())
    .filter(Boolean);
  if (!cols.length) return false;
  return cols.every((col) => /^:?-{2,}:?$/.test(col.replace(/\s+/g, '')));
};

const hasMeaningfulTopic = (value?: string | null) => {
  if (!value) return false;
  const tokens = normalizeTopicText(value)
    .split(' ')
    .filter(Boolean);
  if (!tokens.length) return false;
  const informative = tokens.filter((token) => token.length > 2 && !GENERIC_TOPIC_TOKENS.has(token));
  return informative.length > 0;
};

const buildScriptTitleFromTopic = (topic: string) => {
  if (!hasMeaningfulTopic(topic)) return 'Roteiro curto de Reels (30 segundos)';
  const cleanedTopic = topic.replace(/\s+/g, ' ').trim();
  if (!cleanedTopic) return 'Roteiro curto de Reels (30 segundos)';
  return `${cleanedTopic.charAt(0).toUpperCase()}${cleanedTopic.slice(1)} em 30 segundos`;
};

const normalizeForSimilarity = (value: string) =>
  normalizeTopicText(value)
    .replace(/\b(crie|gere|faca|roteiro|script|conteudo|video|postar)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const looksLikePromptEcho = (candidate: string, userQuery: string) => {
  const normalizedCandidate = normalizeForSimilarity(candidate);
  const normalizedQuery = normalizeForSimilarity(userQuery);
  if (!normalizedCandidate || !normalizedQuery) return false;
  return (
    normalizedCandidate === normalizedQuery ||
    normalizedCandidate.includes(normalizedQuery) ||
    normalizedQuery.includes(normalizedCandidate)
  );
};

const resolveScriptTitle = (candidateTitle: string | null, topic: string, userQuery: string) => {
  const fallbackTitle = buildScriptTitleFromTopic(topic);
  if (!candidateTitle) return fallbackTitle;
  const cleaned = stripMarkdownMarkers(candidateTitle);
  if (!cleaned) return fallbackTitle;
  if (looksLikePromptEcho(cleaned, userQuery)) return fallbackTitle;
  if (!hasMeaningfulTopic(cleaned)) return fallbackTitle;
  return cleaned;
};

const cleanScriptCell = (value: string) => stripMarkdownMarkers(value || '').replace(/\s+/g, ' ').trim();

const isMeaningfulScene = (row: ScriptTableRow) => {
  const time = cleanScriptCell(row.time || '');
  const visual = cleanScriptCell(row.visual || '');
  const audio = cleanScriptCell(row.audio || '');
  if (isPlaceholderLike(time) && isPlaceholderLike(visual) && isPlaceholderLike(audio)) return false;
  if (isPlaceholderLike(visual) && isPlaceholderLike(audio)) return false;
  return Boolean(visual || audio);
};

const parseTableRowsFromScript = (content: string): ScriptTableRow[] => {
  const rows: ScriptTableRow[] = [];
  const lines = content.split('\n');
  let start = -1;

  for (let i = 0; i < lines.length - 1; i += 1) {
    const line = (lines[i] || '').trim();
    const next = (lines[i + 1] || '').trim();
    if (!line.startsWith('|') || !line.endsWith('|')) continue;
    if (!/tempo|time/i.test(line) || !/visual|cena/i.test(line) || !/a[úu]dio|fala|narra/i.test(line)) continue;
    if (!/---/.test(next)) continue;
    start = i + 2;
    break;
  }

  if (start < 0) return rows;
  for (let j = start; j < lines.length; j += 1) {
    const raw = (lines[j] || '').trim();
    if (!raw || !raw.startsWith('|')) break;
    if (isMarkdownSeparatorRow(raw)) continue;
    const cols = raw.split('|').map((c) => c.trim()).filter(Boolean);
    if (cols.length < 2) continue;
    const row: ScriptTableRow = {
      time: cleanScriptCell(cols[0] || 'Auto'),
      visual: cleanScriptCell(cols.length >= 3 ? (cols[1] || '') : (cols[0] || '')),
      audio: cleanScriptCell(cols.length >= 3 ? cols.slice(2).join(' | ') : (cols[1] || '')),
    };
    if (!isMeaningfulScene(row)) continue;
    rows.push(row);
  }

  return rows;
};

const parseLooseRowsFromScript = (content: string): ScriptTableRow[] => {
  const rows: ScriptTableRow[] = [];
  const lines = content.split('\n').map((line) => stripMarkdownMarkers(line)).filter(Boolean);

  for (const line of lines) {
    const normalized = line.toLowerCase();
    const value = line.includes(':') ? line.split(':').slice(1).join(':').trim() : line;
    if (!value) continue;
    if (/gancho|hook/.test(normalized)) {
      rows.push({ time: '00-03s', visual: value, audio: value });
      continue;
    }
    if (/desenvolvimento|corpo|explica|passo/.test(normalized)) {
      rows.push({ time: '03-20s', visual: value, audio: value });
      continue;
    }
    if (/cta|call to action|chamada/.test(normalized)) {
      rows.push({ time: '20-30s', visual: value, audio: value });
      continue;
    }
  }

  return rows;
};

const buildDefaultRows = (topic: string): ScriptTableRow[] => {
  const safeTopic = hasMeaningfulTopic(topic) ? topic : 'uma dor real do seu nicho';
  return [
  {
    time: '00-02s',
    visual: `Close direto no rosto + texto forte: "Você ainda erra isso em ${safeTopic}?"`,
    audio: `Se você quer resultado em ${safeTopic}, precisa corrigir isso agora.`,
  },
  {
    time: '02-07s',
    visual: 'Mostre rapidamente o erro comum em um exemplo real (antes).',
    audio: 'Esse é o erro que trava sua evolução e derruba retenção.',
  },
  {
    time: '07-20s',
    visual: 'Apresente o ajuste em 2 passos, com detalhe prático na execução (depois).',
    audio: 'Agora faz assim: passo 1 para destravar, passo 2 para manter consistência.',
  },
  {
    time: '20-30s',
    visual: 'Fechamento com benefício final + prova rápida + gesto para legenda.',
    audio: 'Se fez sentido, salve este vídeo e comente "roteiro" para eu te enviar outra variação.',
  },
];
};

const ensureRowsQuality = (rows: ScriptTableRow[], topic: string): { rows: ScriptTableRow[]; hasCta: boolean } => {
  const safeRows = rows
    .map((row) => ({
      time: cleanScriptCell(row.time || 'Auto') || 'Auto',
      visual: cleanScriptCell(row.visual || ''),
      audio: cleanScriptCell(row.audio || ''),
    }))
    .filter((row) => isMeaningfulScene(row));

  if (!safeRows.length) {
    return { rows: buildDefaultRows(topic), hasCta: true };
  }

  let curated = safeRows.slice(0, 6);
  while (curated.length < 3) {
    curated = [...curated, ...buildDefaultRows(topic)].slice(0, 3);
  }

  const hasCta = curated.some((row) =>
    /cta|call to action|salve|compartilhe|comente|dm|link|seguir/i.test(`${row.time} ${row.visual} ${row.audio}`)
  );

  let hasCtaFinal = hasCta;
  if (!hasCta) {
    curated.push({
      time: '20-30s',
      visual: 'Encerramento com reforço do benefício e ação sugerida.',
      audio: 'Se fez sentido, salve este roteiro e compartilhe com alguém do seu nicho.',
    });
    hasCtaFinal = true;
  }

  return { rows: curated.slice(0, 6), hasCta: hasCtaFinal };
};

const ensureCaptionVariants = (captionContent: string, topic: string): string => {
  const normalizedLines = (captionContent || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const variantMap = new Map<number, string>();

  for (const line of normalizedLines) {
    const match = line.match(/^V\s*([123])\s*[:\-]\s*(.+)$/i);
    if (!match) continue;
    const index = Number(match[1]);
    const text = stripMarkdownMarkers(match[2] || '');
    if (index >= 1 && index <= 3 && text) {
      variantMap.set(index, text);
    }
  }

  const safeTopic = hasMeaningfulTopic(topic) ? topic : 'um problema comum do seu nicho';
  const base = variantMap.get(1) || stripMarkdownMarkers(normalizedLines[0] || '') || `Ideia prática para resolver ${safeTopic}.`;
  if (!variantMap.get(1)) {
    variantMap.set(1, `${base} Salve para aplicar ainda hoje.`);
  }
  if (!variantMap.get(2)) {
    variantMap.set(2, `${base} Comente "quero" para receber uma versão adaptada ao seu público.`);
  }
  if (!variantMap.get(3)) {
    variantMap.set(3, `${base} Compartilhe com alguém que também precisa dessa estrutura de roteiro.`);
  }

  return [
    `V1: ${variantMap.get(1)}`,
    `V2: ${variantMap.get(2)}`,
    `V3: ${variantMap.get(3)}`,
  ].join('\n\n');
};

const buildFallbackScriptResponse = (query: string) => {
  const topic = summarizeRequestTopic(query) || 'um tema do seu nicho';
  const rows = buildDefaultRows(topic);
  const tableRows = rows.map((row) => `| ${row.time} | ${row.visual} | ${row.audio} |`).join('\n');
  return [
    '[ROTEIRO]',
    `**Título Sugerido:** ${buildScriptTitleFromTopic(topic)}`,
    '**Formato Ideal:** Reels | **Duração Estimada:** 30s',
    '',
    '| Tempo | Visual (o que aparece) | Fala (o que dizer) |',
    '| :--- | :--- | :--- |',
    tableRows,
    '[/ROTEIRO]',
    '',
    '[LEGENDA]',
    ensureCaptionVariants('', topic),
    '[/LEGENDA]',
  ].join('\n');
};

export function enforceScriptContract(response: string, userQuery: string, hints?: ScriptContractHints): ScriptContractResult {
  const issues: string[] = [];
  const topic = summarizeRequestTopic(userQuery) || 'um tema do seu nicho';
  let roteiroBody = extractTaggedBlock(response, 'ROTEIRO');
  let legendaBody = extractTaggedBlock(response, 'LEGENDA');
  let repaired = false;

  if (!roteiroBody) {
    const withoutLegenda = response.split(/\[LEGENDA\]/i)[0]?.trim() || '';
    roteiroBody = withoutLegenda || null;
    issues.push('missing_roteiro_block');
    repaired = true;
  }

  if (!roteiroBody) {
    const fallback = buildFallbackScriptResponse(userQuery);
    return {
      normalized: fallback,
      repaired: true,
      issues: [...issues, 'fallback_generated'],
      quality: {
        hasRoteiroBlock: true,
        hasLegendaBlock: true,
        sceneCount: 3,
        hasCta: true,
      },
    };
  }

  const title = resolveScriptTitle(
    findMetadataValue(roteiroBody, ['Título Sugerido', 'Titulo Sugerido']),
    topic,
    userQuery
  );
  const formatLineRaw = findMetadataValue(roteiroBody, ['Formato Ideal']) || '';
  const formatRaw = stripMarkdownMarkers((formatLineRaw.split('|')[0] || '').trim()) || 'Reels';
  const durationFromFormat = (() => {
    if (!formatLineRaw) return '';
    const match = formatLineRaw.match(/dura(?:ç|c)[aã]o(?:\s+estimada)?\s*:\s*([^|]+)/i);
    return match?.[1]?.trim() || '';
  })();
  const durationRaw =
    findMetadataValue(roteiroBody, ['Duração Estimada', 'Duração Est', 'Duracao Estimada', 'Duracao Est']) ||
    durationFromFormat ||
    '30s';
  const audioRaw = findMetadataValue(roteiroBody, ['Áudio Sugerido', 'Audio Sugerido']);
  const inspirationRaw = findMetadataValue(roteiroBody, ['Inspiração Viral', 'Inspiracao Viral']);
  const inspirationReasonRaw = findMetadataValue(roteiroBody, [
    'Por que essa inspiração',
    'Por que essa inspiracao',
    'Racional da inspiração',
    'Racional da inspiracao',
  ]);
  const inspirationJsonRaw = extractTaggedBlock(roteiroBody, 'INSPIRATION_JSON');
  const inspirationJson = parseInspirationJson(inspirationJsonRaw);

  const tableRows = parseTableRowsFromScript(roteiroBody);
  const looseRows = tableRows.length ? [] : parseLooseRowsFromScript(roteiroBody);
  if (!tableRows.length) {
    issues.push('missing_script_table');
    repaired = true;
  }

  const ensured = ensureRowsQuality(tableRows.length ? tableRows : looseRows, topic);
  const rows = ensured.rows;

  if (rows.length < 3) {
    issues.push('insufficient_scenes');
    repaired = true;
  }

  if (!ensured.hasCta) {
    issues.push('missing_cta');
    repaired = true;
  }

  if (!legendaBody) {
    issues.push('missing_legenda_block');
    repaired = true;
  }

  legendaBody = ensureCaptionVariants(legendaBody || '', topic);

  const inspirationHint = hints?.inspiration || null;
  const inspirationPayload = inspirationJson || inspirationHint || null;
  const inspirationReason = stripMarkdownMarkers(
    inspirationReasonRaw ||
    inspirationPayload?.reason ||
    (inspirationPayload
      ? `Escolhida por narrativa semelhante ao tema "${topic}" e potencial de retenção.`
      : '')
  );

  const roteiroLines: string[] = [];
  if (inspirationPayload && (inspirationPayload.title || inspirationPayload.coverUrl || inspirationPayload.postLink || inspirationPayload.reason || inspirationPayload.supportingInspirations?.length)) {
    const jsonPayload: Record<string, unknown> = {};
    if (inspirationPayload.title) jsonPayload.title = inspirationPayload.title;
    if (inspirationPayload.coverUrl) jsonPayload.coverUrl = inspirationPayload.coverUrl;
    if (inspirationPayload.postLink) jsonPayload.postLink = inspirationPayload.postLink;
    if (inspirationReason) jsonPayload.reason = inspirationReason;
    if (Array.isArray(inspirationPayload.supportingInspirations) && inspirationPayload.supportingInspirations.length) {
      jsonPayload.supportingInspirations = inspirationPayload.supportingInspirations.slice(0, 3).map((item) => ({
        role: item.role,
        title: item.title || undefined,
        postLink: item.postLink || undefined,
        reason: item.reason || undefined,
        narrativeScore: typeof item.narrativeScore === 'number' ? item.narrativeScore : undefined,
      }));
    }
    roteiroLines.push('[INSPIRATION_JSON]');
    roteiroLines.push(JSON.stringify(jsonPayload, null, 2));
    roteiroLines.push('[/INSPIRATION_JSON]');
    roteiroLines.push('');
  }
  roteiroLines.push(`**Título Sugerido:** ${title}`);
  if (inspirationRaw && !inspirationPayload) {
    roteiroLines.push(`**Inspiração Viral:** ${inspirationRaw}`);
  }
  roteiroLines.push(`**Formato Ideal:** ${formatRaw} | **Duração Estimada:** ${durationRaw}`);
  if (audioRaw) {
    roteiroLines.push(`**Áudio Sugerido:** ${audioRaw}`);
  }
  if (inspirationReason) {
    roteiroLines.push(`**Por que essa inspiração:** ${inspirationReason}`);
  }
  if (inspirationPayload?.supportingInspirations?.length) {
    roteiroLines.push('**Inspirações narrativas de apoio:**');
    inspirationPayload.supportingInspirations.slice(0, 3).forEach((item) => {
      const roleLabel = item.role === 'gancho'
        ? 'Gancho'
        : item.role === 'desenvolvimento'
          ? 'Desenvolvimento'
          : 'CTA';
      const title = item.title || 'Referência sem título';
      const scoreText = typeof item.narrativeScore === 'number' ? ` (${Math.round(item.narrativeScore * 100)}% narrativa)` : '';
      roteiroLines.push(`- ${roleLabel}: ${title}${scoreText}`);
    });
  }
  roteiroLines.push('');
  roteiroLines.push('| Tempo | Visual (o que aparece) | Fala (o que dizer) |');
  roteiroLines.push('| :--- | :--- | :--- |');
  rows.forEach((row) => {
    roteiroLines.push(`| ${row.time} | ${row.visual} | ${row.audio} |`);
  });

  const normalized = [
    '[ROTEIRO]',
    roteiroLines.join('\n').trim(),
    '[/ROTEIRO]',
    '',
    '[LEGENDA]',
    legendaBody,
    '[/LEGENDA]',
  ].join('\n');

  return {
    normalized,
    repaired,
    issues,
    quality: {
      hasRoteiroBlock: true,
      hasLegendaBlock: true,
      sceneCount: rows.length,
      hasCta: ensured.hasCta,
    },
  };
}

const isHttpUrl = (value?: string | null): value is string =>
  typeof value === 'string' && /^https?:\/\//i.test(value.trim());

const isInstagramPostUrl = (url?: string | null) => {
  if (!isHttpUrl(url)) return false;
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (!(host.endsWith('instagram.com') || host === 'instagr.am')) return false;
    return /\/(p|reel|tv)\/[^/]+/i.test(parsed.pathname);
  } catch {
    return false;
  }
};

const normalizeInstagramUrl = (url?: string | null) => {
  if (!isInstagramPostUrl(url)) return null;
  try {
    const parsed = new URL(url!.trim());
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${host}${path}`;
  } catch {
    return null;
  }
};

const SCRIPT_INTENTS = new Set(['script_request', 'humor_script_request', 'proactive_script_accept']);
type NarrativePreference = 'prefer_similar' | 'prefer_different';

const detectNarrativeFeedbackFromQuery = (query: string): {
  preference: NarrativePreference | null;
  note?: string | null;
} => {
  const normalized = (query || '').toLowerCase();
  if (!normalized) return { preference: null };

  const hasNarrativeContext = /(narrativa|estilo|linha|gancho|cta|roteiro)/i.test(normalized);
  const positive = /(curti|gostei|boa|mantenha|continua|segue nessa|alinhad[oa]|representa)/i.test(normalized);
  const negative = /(n[aã]o curti|nao curti|n[aã]o gostei|nao gostei|mudar|trocar|evitar|diferente|n[aã]o combina|nao combina)/i.test(normalized);

  if (hasNarrativeContext && positive && !negative) {
    return { preference: 'prefer_similar', note: 'Usuário aprovou a linha narrativa atual.' };
  }
  if (hasNarrativeContext && negative) {
    return { preference: 'prefer_different', note: 'Usuário pediu mudança da linha narrativa.' };
  }
  return { preference: null };
};

function inferScriptObjective(query: string): string | null {
  const text = (query || '').toLowerCase();
  if (/(converter|vender|venda|compra|or[cç]amento|fechar|promover|lan[çc]amento|promo|cupom|dm|whatsapp|link)/.test(text)) {
    return 'converter';
  }
  if (/(viral|viralizar|compart|alcance|reach|bombar|explodir)/.test(text)) {
    return 'viralizar';
  }
  if (/(comentar|coment[áa]rio|engajar|engajamento|comunidade)/.test(text)) {
    return 'engajar';
  }
  if (/(ensinar|tutorial|passo a passo|como fazer|dica|dicas|educa|explicar)/.test(text)) {
    return 'educar';
  }
  if (/(autoridade|especialista|credibil|posicionamento|prova social)/.test(text)) {
    return 'autoridade';
  }
  return null;
}

async function buildScriptContext(params: {
  user: IUser;
  query: string;
  intent?: string | null;
  answerEngineResult?: any;
  dialogueState?: IDialogueState | null;
  narrativePreferenceOverride?: NarrativePreference | null;
}): Promise<EnrichedAIContext['scriptContext']> {
  const { user, query, intent, answerEngineResult, dialogueState, narrativePreferenceOverride } = params;
  const userId = user?._id?.toString?.();
  const objectiveHint = inferScriptObjective(query);
  const isHumor = intent === 'humor_script_request' || /humor|com[eé]dia|engraç|piada|cena c[oô]mica/.test((query || '').toLowerCase());
  const toneHint = isHumor ? 'humorous' : null;
  const communityOptIn = Boolean((user as any)?.communityInspirationOptIn);
  const persistedPreference = (dialogueState as any)?.scriptPreferences?.narrativePreference;
  const narrativePreference =
    narrativePreferenceOverride ||
    (persistedPreference === 'prefer_similar' || persistedPreference === 'prefer_different'
      ? persistedPreference
      : null);

  const topPosts = Array.isArray(answerEngineResult?.topPosts)
    ? answerEngineResult.topPosts.slice(0, 3).map((p: any) => ({
      id: String(p.id || ''),
      captionSnippet: (p.raw?.description || p.description || '').toString().slice(0, 160) || undefined,
      format: (p.raw?.format || p.format) ?? undefined,
      proposal: Array.isArray(p.raw?.proposal) ? p.raw.proposal : undefined,
      context: Array.isArray(p.raw?.context) ? p.raw.context : undefined,
      tone: Array.isArray(p.raw?.tone) ? p.raw.tone : undefined,
      stats: {
        shares: typeof p.stats?.shares === 'number' ? p.stats.shares : null,
        saved: typeof p.stats?.saves === 'number' ? p.stats.saves : null,
        comments: typeof p.stats?.comments === 'number' ? p.stats.comments : null,
        likes: typeof p.stats?.likes === 'number' ? p.stats.likes : null,
        reach: typeof p.stats?.reach === 'number' ? p.stats.reach : null,
        views: typeof p.raw?.stats?.views === 'number' ? p.raw.stats.views : null,
        total_interactions: typeof p.stats?.total_interactions === 'number' ? p.stats.total_interactions : null,
      },
      postDate: p.postDate ? new Date(p.postDate).toISOString() : null,
    }))
    : [];

  let topCategories: any = undefined;
  if (userId) {
    const now = new Date();
    const startDate = new Date(now.getTime() - (180 * ONE_DAY_MS));
    const dateRange = { startDate, endDate: now };
    const tasks = [
      fetchTopCategories({ userId, dateRange, category: 'proposal', metric: 'shares', limit: 4 }),
      fetchTopCategories({ userId, dateRange, category: 'context', metric: 'shares', limit: 4 }),
      fetchTopCategories({ userId, dateRange, category: 'format', metric: 'shares', limit: 3 }),
      fetchTopCategories({ userId, dateRange, category: 'tone', metric: 'shares', limit: 3 }),
    ] as const;
    const [proposalRes, contextRes, formatRes, toneRes] = await Promise.allSettled(tasks);
    const extractCats = (res: PromiseSettledResult<any>) =>
      res.status === 'fulfilled'
        ? (res.value || []).map((r: any) => String(r?.category || '').trim()).filter(Boolean)
        : [];
    const proposals = extractCats(proposalRes);
    const contexts = extractCats(contextRes);
    const formats = extractCats(formatRes);
    const tones = extractCats(toneRes);
    topCategories = {
      proposal: proposals.length ? Array.from(new Set(proposals)) : undefined,
      context: contexts.length ? Array.from(new Set(contexts)) : undefined,
      format: formats.length ? Array.from(new Set(formats)) : undefined,
      tone: tones.length ? Array.from(new Set(tones)) : undefined,
    };
  }

  return {
    objectiveHint,
    toneHint,
    narrativePreference,
    topCategories,
    topPosts,
    communityOptIn,
  };
}

const sanitizeInstagramLinks = (markdown: string, allowed: Set<string>) => {
  if (!markdown) return markdown;
  const allowSet = allowed || new Set<string>();
  let updated = markdown.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, (full, label, url) => {
    const normalized = normalizeInstagramUrl(url);
    if (!normalized) return full;
    if (!allowSet.has(normalized)) return label;
    return full;
  });
  updated = updated.replace(/https?:\/\/[^\s)]+/gi, (raw) => {
    const trimmed = raw.replace(/[),.;!?]+$/, '');
    const suffix = raw.slice(trimmed.length);
    const normalized = normalizeInstagramUrl(trimmed);
    if (!normalized) return raw;
    if (!allowSet.has(normalized)) {
      return suffix;
    }
    return raw;
  });
  return updated;
};

const extractCommunityInspirations = (history: ChatCompletionMessageParam[]) => {
  const inspirations: any[] = [];
  let meta: {
    matchType?: string;
    usedFilters?: {
      proposal?: string;
      context?: string;
      format?: string;
      tone?: string;
      reference?: string;
      primaryObjective?: string;
      narrativeQuery?: string;
    };
    fallbackMessage?: string;
    rankingSignals?: {
      personalizedByUserPerformance?: boolean;
      userTopCategories?: {
        proposal?: string[];
        context?: string[];
        format?: string[];
        tone?: string[];
      };
    };
  } | null = null;
  for (const msg of history) {
    if (msg.role !== 'function') continue;
    const fnName = (msg as any)?.name;
    if (fnName !== 'fetchCommunityInspirations') continue;
    const content = (msg as any)?.content;
    if (!content) continue;
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed?.inspirations)) {
        inspirations.push(...parsed.inspirations);
      }
      if (parsed?.matchType || parsed?.usedFilters || parsed?.fallbackMessage || parsed?.rankingSignals) {
        const rawFilters = parsed?.usedFilters || {};
        const rawRankingSignals = parsed?.rankingSignals || {};
        const rawTopCategories = rawRankingSignals?.userTopCategories || {};
        meta = {
          matchType: typeof parsed.matchType === 'string' ? parsed.matchType : undefined,
          usedFilters: {
            proposal: typeof rawFilters.proposal === 'string' ? rawFilters.proposal : undefined,
            context: typeof rawFilters.context === 'string' ? rawFilters.context : undefined,
            format: typeof rawFilters.format === 'string' ? rawFilters.format : undefined,
            tone: typeof rawFilters.tone === 'string' ? rawFilters.tone : undefined,
            reference: typeof rawFilters.reference === 'string' ? rawFilters.reference : undefined,
            narrativeQuery: typeof rawFilters.narrativeQuery === 'string' ? rawFilters.narrativeQuery : undefined,
            primaryObjective: typeof rawFilters.primaryObjectiveAchieved_Qualitative === 'string'
              ? rawFilters.primaryObjectiveAchieved_Qualitative
              : undefined,
          },
          fallbackMessage: typeof parsed.fallbackMessage === 'string' ? parsed.fallbackMessage : undefined,
          rankingSignals: {
            personalizedByUserPerformance: Boolean(rawRankingSignals?.personalizedByUserPerformance),
            userTopCategories: {
              proposal: Array.isArray(rawTopCategories.proposal)
                ? rawTopCategories.proposal.map((value: any) => String(value).trim()).filter(Boolean)
                : undefined,
              context: Array.isArray(rawTopCategories.context)
                ? rawTopCategories.context.map((value: any) => String(value).trim()).filter(Boolean)
                : undefined,
              format: Array.isArray(rawTopCategories.format)
                ? rawTopCategories.format.map((value: any) => String(value).trim()).filter(Boolean)
                : undefined,
              tone: Array.isArray(rawTopCategories.tone)
                ? rawTopCategories.tone.map((value: any) => String(value).trim()).filter(Boolean)
                : undefined,
            },
          },
        };
      }
    } catch {
      // ignore parse failures
    }
  }
  return { inspirations, meta };
};

const describeScriptMatchType = (matchType?: string | null) => {
  const normalized = (matchType || '').toLowerCase();
  if (normalized === 'exact') return 'match exato de proposta e contexto';
  if (normalized === 'proposal_only') return 'mesma proposta do pedido';
  if (normalized === 'context_only' || normalized === 'broad_context') return 'contexto semelhante ao pedido';
  return 'referência próxima ao objetivo do roteiro';
};

const inferNarrativeRole = (
  inspiration: { description?: string; matchReasons?: string[] },
  fallbackIndex: number
): 'gancho' | 'desenvolvimento' | 'cta' => {
  const text = [
    inspiration.description || '',
    ...(Array.isArray(inspiration.matchReasons) ? inspiration.matchReasons : []),
  ]
    .join(' ')
    .toLowerCase();

  const ctaScore = /(cta|call to action|salve|comente|compartilhe|link|dm)/i.test(text) ? 2 : 0;
  const hookScore = /(gancho|hook|abertura|primeiros segundos|erro comum|dor)/i.test(text) ? 2 : 0;
  const developmentScore = /(desenvolvimento|explica|passo|tutorial|prova|demonstra)/i.test(text) ? 2 : 0;

  if (hookScore >= ctaScore && hookScore >= developmentScore) return 'gancho';
  if (ctaScore >= hookScore && ctaScore >= developmentScore) return 'cta';
  if (developmentScore >= 1) return 'desenvolvimento';

  if (fallbackIndex === 0) return 'gancho';
  if (fallbackIndex === 2) return 'cta';
  return 'desenvolvimento';
};

const buildScriptInspirationHint = (
  inspirations: Array<{
    title?: string;
    description?: string;
    permalink?: string;
    format?: string;
    proposal?: string;
    context?: string;
    tone?: string;
    matchReasons?: string[];
    narrativeScore?: number;
    performanceScore?: number;
    personalizationScore?: number;
  }>,
  meta: {
    matchType?: string;
    usedFilters?: {
      proposal?: string;
      context?: string;
      format?: string;
      tone?: string;
    };
    rankingSignals?: {
      personalizedByUserPerformance?: boolean;
      userTopCategories?: {
        proposal?: string[];
        context?: string[];
        format?: string[];
        tone?: string[];
      };
    };
  } | null,
  topic: string,
): ScriptInspirationHint | null => {
  if (!Array.isArray(inspirations) || !inspirations.length) return null;
  const selected = inspirations.slice(0, 3);
  const roleOrder: Array<'gancho' | 'desenvolvimento' | 'cta'> = ['gancho', 'desenvolvimento', 'cta'];
  const assigned = new Set<'gancho' | 'desenvolvimento' | 'cta'>();
  const withRoles = selected.map((inspiration, idx) => {
    const inferred = inferNarrativeRole(inspiration, idx);
    const role = assigned.has(inferred)
      ? (roleOrder.find((candidate) => !assigned.has(candidate)) || inferred)
      : inferred;
    assigned.add(role);
    return { inspiration, role };
  });
  if (!withRoles.length) return null;
  const preferredPrimary = withRoles.find((item) => item.role === 'gancho') || withRoles[0];
  if (!preferredPrimary) return null;
  const first = preferredPrimary.inspiration;
  const proposal = meta?.usedFilters?.proposal || first?.proposal;
  const context = meta?.usedFilters?.context || first?.context;
  const format = meta?.usedFilters?.format || first?.format;
  const tone = meta?.usedFilters?.tone || first?.tone;
  const personalized = Boolean(meta?.rankingSignals?.personalizedByUserPerformance);
  const parts = [
    describeScriptMatchType(meta?.matchType),
    proposal ? `proposta ${proposal}` : null,
    context ? `contexto ${context}` : null,
    format ? `formato ${format}` : null,
    tone ? `tom ${tone}` : null,
    personalized ? 'alinhamento com seu histórico de performance' : null,
  ].filter(Boolean);
  const reason = parts.length
    ? `Escolhida por ${parts.join(', ')} para sustentar o roteiro sobre "${topic}".`
    : `Escolhida por narrativa semelhante ao tema "${topic}".`;

  return {
    title: first?.title || undefined,
    postLink: first?.permalink || undefined,
    reason,
    supportingInspirations: withRoles.map((item) => ({
      role: item.role,
      title: item.inspiration.title || undefined,
      postLink: item.inspiration.permalink || undefined,
      reason: Array.isArray(item.inspiration.matchReasons) && item.inspiration.matchReasons.length
        ? item.inspiration.matchReasons[0]
        : undefined,
      narrativeScore: typeof item.inspiration.narrativeScore === 'number'
        ? item.inspiration.narrativeScore
        : undefined,
    })),
  };
};

const SURVEY_STALE_MS = 1000 * 60 * 60 * 24 * 120; // ~4 meses

function evaluateSurveyFreshness(profile: any) {
  const missingCore: string[] = [];
  if (!profile || !Array.isArray(profile.stage) || profile.stage.length === 0) missingCore.push('etapa');
  if (!profile?.mainGoal3m) missingCore.push('meta_3m');
  if (!profile || !Array.isArray(profile.niches) || profile.niches.length === 0) missingCore.push('nicho');

  const updatedAtRaw = profile?.updatedAt ? new Date(profile.updatedAt) : null;
  const isStale = !updatedAtRaw || Number.isNaN(updatedAtRaw.getTime()) || Date.now() - updatedAtRaw.getTime() > SURVEY_STALE_MS;

  return { missingCore, isStale, updatedAt: updatedAtRaw };
}

function inferIntentFromSurvey(profile: any, cachedPrefs?: any) {
  const source = profile && Object.keys(profile).length ? profile : cachedPrefs || {};
  if (!source) return { intent: null as string | null, objective: null as string | null };
  const reasons: string[] = Array.isArray(source.mainPlatformReasons) ? source.mainPlatformReasons : [];
  const hardest: string | null = Array.isArray(source.hardestStage) ? source.hardestStage[0] ?? null : null;
  const stage: string | null = Array.isArray(source.stage) ? source.stage[0] ?? null : null;

  // Motivos e travas guiam intenção
  if (reasons.includes('planejar') || hardest === 'planejar' || hardest === 'postar' || stage === 'iniciante' || stage === 'hobby') {
    return { intent: 'content_plan', objective: 'Plano guiado pelas preferências declaradas (motivo/etapa/trava).' };
  }
  if (reasons.includes('media-kit') || reasons.includes('negociar') || hardest === 'negociar') {
    return { intent: 'pricing_analysis', objective: 'Preparar negociação/mídia kit alinhado às metas declaradas.' };
  }
  if (reasons.includes('metricas') || hardest === 'analisar') {
    return { intent: 'market_analysis', objective: 'Diagnóstico de métricas/mercado com base na intenção declarada.' };
  }
  return { intent: null as string | null, objective: null as string | null };
}

function summarizeRequestTopic(value?: string | null) {
  if (!value) return '';
  const condensed = value
    .replace(/\s+/g, ' ')
    .replace(/[“”"]/g, '')
    .trim();
  if (!condensed) return '';

  const candidates: string[] = [];
  const topicMatchers = [
    /(?:sobre|assunto|tema)\s+(.+)$/i,
    /(?:para|pra)\s+(.+)$/i,
    /(?:de)\s+(.+)$/i,
  ];

  for (const matcher of topicMatchers) {
    const match = condensed.match(matcher);
    if (match?.[1]) {
      candidates.push(match[1].trim());
    }
  }
  candidates.push(condensed);

  for (const rawCandidate of candidates) {
    const cleaned = rawCandidate
      .replace(/\b(em|com)\s+\d+\s*(s|seg(?:undo)?s?|min(?:uto)?s?)\b/gi, '')
      .replace(/^(?:um|uma|o|a)\s+/i, '')
      .replace(/[?.!,:;]+$/g, '')
      .trim();
    if (!cleaned) continue;
    if (!hasMeaningfulTopic(cleaned)) continue;
    return cleaned.length > 90 ? `${cleaned.slice(0, 90)}…` : cleaned;
  }

  return '';
}

const SCRIPT_REFINEMENT_HINT = /\b(curti|gostei|mantenha|mantem|continue|continua|refine|refinar|encurta|encurtar|adapte|adaptar|mude|mudar|troque|trocar|outra linha|vers[aã]o)\b/i;
const SCRIPT_CREATION_HINT = /\b(crie|criar|gere|gerar|monte|montar|fa[cç]a|fazer|escreva|elabore|roteiro|script|o que postar)\b/i;

const shouldAskScriptClarification = (query: string, summarizedTopic: string) => {
  if (!query || !query.trim()) return true;
  if (SCRIPT_REFINEMENT_HINT.test(query)) return false;
  if (!SCRIPT_CREATION_HINT.test(query)) return false;
  return !hasMeaningfulTopic(summarizedTopic);
};

const buildScriptClarificationMessage = () =>
  [
    '### Preciso de contexto para montar um roteiro forte',
    '> [!IMPORTANT]',
    '> Me passe 3 dados rápidos e eu já te devolvo um roteiro pronto, com narrativa e CTA alinhados.',
    '>',
    '> `Tema específico` | `Público` | `Objetivo principal` (educar, engajar, viralizar ou converter).',
    '',
    'Exemplo: "Tema: rotina de skincare para pele oleosa | Público: mulheres 25-35 | Objetivo: gerar salvamentos".',
    '',
    '[BUTTON: Quero preencher tema, público e objetivo]',
    '[BUTTON: Usar meu nicho atual e gerar uma primeira versão]',
    '[BUTTON: Me mostre exemplos de prompts prontos]',
  ].join('\n');

function buildSurveyContextNote(profile: any, userRequest?: string) {
  if (!profile) return null;
  const parts: string[] = [];
  if (Array.isArray(profile.stage) && profile.stage.length) parts.push(`etapa: ${profile.stage[0]}`);
  if (profile.mainGoal3m) parts.push(`meta 3m: ${profile.mainGoal3m}`);
  if (Array.isArray(profile.niches) && profile.niches.length) parts.push(`nicho: ${profile.niches[0]}`);
  if (Array.isArray(profile.mainPlatformReasons) && profile.mainPlatformReasons.length) parts.push(`motivo: ${profile.mainPlatformReasons[0]}`);

  const profileSummary = parts.join(' | ');
  const requestedTheme = summarizeRequestTopic(userRequest);

  if (!profileSummary && !requestedTheme) return null;

  const explanation = profileSummary && requestedTheme
    ? 'Vou combinar o tema pedido com o seu perfil declarado para manter seu estilo.'
    : '';

  return [
    requestedTheme ? `Tema solicitado: ${requestedTheme}` : null,
    profileSummary ? `Perfil (pesquisa): ${profileSummary}` : null,
    explanation || null,
  ].filter(Boolean).join(' | ');
}

function scoreContextStrength(profile: any) {
  let score = 0;
  if (Array.isArray(profile?.stage) && profile.stage.length) score += 1;
  if (profile?.mainGoal3m) score += 1;
  if (Array.isArray(profile?.niches) && profile.niches.length) score += 1;
  if (Array.isArray(profile?.mainPlatformReasons) && profile.mainPlatformReasons.length) score += 1;
  return score; // 0-4
}

function resolveVariantBucket(profile: any): { bucket: VariantBucket; strength: number } {
  const strength = scoreContextStrength(profile);
  const stage = Array.isArray(profile?.stage) ? profile.stage[0] : null;
  const learning = Array.isArray(profile?.learningStyles) ? profile.learningStyles[0] : null;
  if (strength <= 1) return { bucket: "context_weak", strength };
  if (stage === "iniciante" || stage === "hobby" || learning === "checklist") return { bucket: "beginner", strength };
  return { bucket: "direct", strength };
}

function decidePromptVariant(profile: any, options: { isAdminTest: boolean; requestedVariant: string | null; existingVariant?: string | null; existingExperimentId?: string | null }) {
  const { bucket, strength } = resolveVariantBucket(profile);
  const requested = options.requestedVariant && ["A", "B", "C"].includes(options.requestedVariant) ? options.requestedVariant : null;

  if (options.existingVariant && ["A", "B", "C"].includes(options.existingVariant)) {
    return { variant: options.existingVariant as "A" | "B" | "C", experimentId: options.existingExperimentId || experimentConfig.experimentId, bucket, contextStrength: strength };
  }
  if (options.isAdminTest && requested) {
    return { variant: requested as "A" | "B" | "C", experimentId: "admin_manual", bucket, contextStrength: strength };
  }
  const rolloutChoice = chooseVariantFromRollout(bucket);
  return { variant: rolloutChoice.variant, experimentId: rolloutChoice.experimentId, bucket, contextStrength: strength };
}

async function extractContextFromAIResponse(aiResponseText: string, userId: string) {
  const trimmed = (aiResponseText || '').trim();
  const wasQuestion = trimmed.endsWith('?');

  if (!trimmed || trimmed.length < 10) {
    return { timestamp: Date.now(), wasQuestion };
  }

  const prompt = `
Dada a resposta abaixo, identifique em JSON conciso:
- "topic": tópico principal (<= 10 palavras) ou null
- "entities": até 4 termos-chave (array)

Resposta:
---
${trimmed.substring(0, MAX_AI_EXCERPT)}${trimmed.length > MAX_AI_EXCERPT ? "\n[...truncado...]" : ""}
---

JSON:`;

  try {
    const extraction = await callOpenAIForQuestion(prompt, { max_tokens: 120, temperature: 0.2 });
    const jsonMatch = extraction?.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch?.[0] ? JSON.parse(jsonMatch[0]) : null;
    const topic = parsed && typeof parsed.topic === 'string' && parsed.topic.trim() ? parsed.topic.trim() : undefined;
    const entities = parsed && Array.isArray(parsed.entities) ? parsed.entities.map((e: any) => String(e).trim()).filter(Boolean) : [];
    return { topic, entities, timestamp: Date.now(), wasQuestion };
  } catch (error) {
    logger.error(`[ai/chat] extractContextFromAIResponse failed for user ${userId}:`, error);
    return { timestamp: Date.now(), wasQuestion };
  }
}

async function generateInstigatingQuestion(aiResponseText: string, dialogueState: any, userId: string) {
  const trimmed = (aiResponseText || '').trim();
  if (!trimmed || trimmed.length < 15) return null;
  const lastSegment = trimmed.includes('\n\n') ? trimmed.slice(trimmed.lastIndexOf('\n\n') + 2) : trimmed;
  if (lastSegment.trim().endsWith('?')) return null;

  const summary = dialogueState?.conversationSummary || 'Nenhum resumo disponível.';
  const topic = dialogueState?.lastResponseContext?.topic || 'Não especificado';

  const prompt = `
Você é o Mobi, assistente da Data2Content. Com base na resposta dada ao usuário, sugira UMA pergunta curta (1–2 frases) e aberta que incentive o próximo passo.

Resposta de Mobi:
---
${trimmed.substring(0, 1000)}${trimmed.length > 1000 ? "\n[...truncado...]" : ""}
---

Contexto: tópico="${topic}", resumo="${summary.substring(0, 400)}"

Se não houver pergunta útil, responda apenas "NO_QUESTION".`;

  try {
    const question = await callOpenAIForQuestion(prompt, { max_tokens: 80, temperature: 0.6 });
    if (!question) return null;
    const cleaned = question.trim();
    if (!cleaned || cleaned.toUpperCase() === 'NO_QUESTION' || cleaned.length < 10) return null;
    return cleaned;
  } catch (error) {
    logger.error(`[ai/chat] generateInstigatingQuestion failed for user ${userId}:`, error);
    return null;
  }
}

/**
 * POST /api/ai/chat
 * Body esperado: { userId, query }
 * Retorna uma resposta da IA baseada nas métricas do usuário.
  */
export async function POST(request: NextRequest) {
  try {
    const authOptions = await resolveAuthOptions();
    const session = (await getServerSession(authOptions)) as Session | null;
    const sessionUser = session?.user as (NonNullable<Session['user']> & { id?: string; name?: string | null }) | undefined;
    const actorId = sessionUser?.id;
    if (!actorId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const query = body?.query;
    let threadId = body?.threadId;
    const requestedTargetId = typeof body?.targetUserId === 'string' ? String(body.targetUserId).trim() : undefined;
    const requestedPromptVariant = typeof body?.promptVariant === 'string' ? String(body.promptVariant).trim().toUpperCase() : null;
    const isAdminTest = Boolean(body?.isAdminTest && String((sessionUser as any)?.role || '').toLowerCase() === 'admin');
    if (!query || !String(query).trim()) {
      return NextResponse.json({ error: 'Falta query (pergunta do usuário)' }, { status: 400 });
    }
    const normalizedQueryRaw = String(query);
    const truncatedQuery = normalizedQueryRaw.length > MAX_QUERY_CHARS
      ? `${normalizedQueryRaw.slice(0, MAX_QUERY_CHARS)} [...]`
      : normalizedQueryRaw;
    const harmfulMatch = HARMFUL_PATTERNS.find((re) => re.test(normalizedQueryRaw));
    if (harmfulMatch) {
      const safetyMsg = 'Não posso ajudar com esse tipo de pedido. Se estiver precisando de apoio emocional, procure ajuda profissional ou um serviço de emergência.';
      return NextResponse.json({ error: safetyMsg }, { status: 400 });
    }

    const access = evaluateUserAccess(sessionUser, requestedTargetId);
    if (!access.allowed) {
      const status = access.reason === 'unauthenticated' ? 401 : 403;
      return NextResponse.json({ error: status === 401 ? 'Não autenticado' : 'Acesso negado' }, { status });
    }

    if (access.isAdmin && access.targetUserId !== actorId) {
      logger.info(`[ai/chat] admin ${actorId} consultando métricas de usuário ${access.targetUserId}`);
    }

    // Auto-create thread if not provided.
    // Se admin e está falando com ele mesmo, também criamos thread para persistir histórico.
    const isSelfChat = access?.targetUserId === actorId;
    if (!threadId && (!requestedTargetId || (access.isAdmin && isSelfChat))) {
      try {
        // Create a thread com título provisório a partir da query
        const newThread = await stateService.createThread(actorId, truncatedQuery.slice(0, 30) + '...');
        threadId = String(newThread._id);
      } catch (e) {
        logger.error('[ai/chat] Failed to auto-create thread:', e);
        // Fallback to legacy user-based key if DB fails
      }
    }

    try {
      const { allowed } = await checkRateLimit(`chat:${actorId}`, 30, 3600);
      if (!allowed) {
        return NextResponse.json({ error: 'Muitas requisições. Tente novamente em breve.' }, { status: 429 });
      }
    } catch {
      // Ignora erros de rate-limit para não bloquear uso legítimo
    }

    await connectToDatabase();
    const targetUser = await UserModel.findById(access.targetUserId).lean<IUser | null>();
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const surveyProfile = (targetUser as any)?.creatorProfileExtended || {};
    const surveyFreshness = evaluateSurveyFreshness(surveyProfile);
    const contextJson = stringifyChatContext(buildChatContext(targetUser));
    const targetDisplayName = targetUser.name || 'criador';

    // If we have a threadId, use it as the key. Otherwise fallback to legacy logic.
    // Logic: Admin looking at user -> key is "adminId:targetId". 
    //        User looking at self -> key is "threadId" (preferred) or "userId" (legacy).
    // Use threadId as canonical key when available, even em modo admin, para manter histórico consistente e recuperável
    const conversationKey = threadId
      ? threadId
      : access.isAdmin
        ? `${actorId}:${access.targetUserId}`
        : access.targetUserId;

    const isTargetIgConnected = Boolean(targetUser.isInstagramConnected || targetUser.instagramAccountId);
    const firstName = targetDisplayName.split(' ')[0] || 'criador';
    const greeting = `Olá, ${firstName}`;
    const normalizedQuery = normalizeText(String(truncatedQuery));

    let historyMessages: ChatCompletionMessageParam[] = [];
    try {
      historyMessages = (await stateService.getConversationHistory(conversationKey)).slice(-HISTORY_LIMIT_SAFE);
    } catch { }

    let dialogueState: any = { summaryTurnCounter: 0 };
    try {
      dialogueState = await stateService.getDialogueState(conversationKey);
    } catch { }
    const variantDecision = decidePromptVariant(surveyProfile, {
      isAdminTest,
      requestedVariant: requestedPromptVariant,
      existingVariant: null,
      existingExperimentId: null,
    });

    // Gating de plano inativo (bloqueia antes de chamar LLM)
    let ctaForPlan: { label: string; action: 'go_to_billing' } | undefined;
    if (!access.isAdmin) {
      try {
        const planFromSession = normalizePlanStatus((sessionUser as any)?.planStatus);
        const planFromDb = normalizePlanStatus((targetUser as any)?.planStatus);
        const effectivePlan = planFromSession || planFromDb;
        if (!isActiveLike(effectivePlan)) {
          const blockedMsg = `Olá ${firstName}! Seu plano está ${effectivePlan || 'inativo'}. Para continuar usando o Mobi, reative o Plano Pro.`;
          ctaForPlan = { label: 'Reativar Plano Pro', action: 'go_to_billing' };
          const updatedBlocked: ChatCompletionMessageParam[] = [
            ...historyMessages,
            { role: 'user', content: truncatedQuery } as ChatCompletionUserMessageParam,
            { role: 'assistant', content: blockedMsg } as ChatCompletionAssistantMessageParam,
          ].slice(-HISTORY_LIMIT_SAFE);
          await stateService.setConversationHistory(conversationKey, updatedBlocked);
          await stateService.updateDialogueState(conversationKey, {
            lastInteraction: Date.now(),
            summaryTurnCounter: (dialogueState?.summaryTurnCounter ?? 0) + 1,
          });
          return NextResponse.json({ answer: blockedMsg, cta: ctaForPlan }, { status: 200 });
        }
      } catch (error) {
        logger.error('[ai/chat] Plano inativo: falha ao verificar estado do plano', error);
      }
    }

    if (!isTargetIgConnected) {
      const personaSnippets: string[] = [];
      const creatorProfile = (targetUser as any)?.creatorProfileExtended || {};
      if (Array.isArray(creatorProfile.stage) && creatorProfile.stage.length) {
        personaSnippets.push(`Etapa atual: ${creatorProfile.stage.join('/')}`);
      }
      if (Array.isArray(creatorProfile.niches) && creatorProfile.niches.length) {
        personaSnippets.push(`Nichos: ${creatorProfile.niches.slice(0, 3).join(', ')}`);
      }
      if (creatorProfile.mainGoal3m) {
        personaSnippets.push(`Meta principal: ${creatorProfile.mainGoal3m}`);
      }
      if (Array.isArray(creatorProfile.mainPains) && creatorProfile.mainPains.length) {
        personaSnippets.push(`Dores: ${creatorProfile.mainPains.slice(0, 2).join(', ')}`);
      }
      if (Array.isArray(creatorProfile.hasHelp) && creatorProfile.hasHelp.length) {
        personaSnippets.push(`Suporte: ${creatorProfile.hasHelp.slice(0, 2).join(', ')}`);
      }
      const preferences = (targetUser as any)?.userPreferences || {};
      if (Array.isArray(preferences.preferredFormats) && preferences.preferredFormats.length) {
        personaSnippets.push(`Prefere formatos: ${preferences.preferredFormats.slice(0, 3).join(', ')}`);
      }
      if (Array.isArray(preferences.dislikedTopics) && preferences.dislikedTopics.length) {
        personaSnippets.push(`Evitar temas: ${preferences.dislikedTopics.slice(0, 2).join(', ')}`);
      }
      if (preferences.preferredAiTone) {
        personaSnippets.push(`Tom desejado: ${preferences.preferredAiTone}`);
      }
      const surveySnippet = buildSurveyProfileSnippet(targetUser)?.snippet || '';
      const surveyBlock = surveySnippet ? `\nPesquisa declarada:\n\`\`\`yaml\n${surveySnippet}\n\`\`\`` : '';
      const longTermGoals = Array.isArray((targetUser as any)?.userLongTermGoals)
        ? (targetUser as any).userLongTermGoals
        : [];
      if (longTermGoals.length) {
        const goals = longTermGoals
          .map((g: any) => g?.goal)
          .filter(Boolean)
          .slice(0, 2);
        if (goals.length) personaSnippets.push(`Objetivos declarados: ${goals.join(' | ')}`);
      }

      const genericPrompt = `
Você é Mobi, um consultor de IA prático para criadores de conteúdo.
Responda de forma direta, útil e aplicável a qualquer criador (sem dados pessoais).
Evite suposições sobre métricas específicas do usuário. Foque em boas práticas, táticas e estruturas.
Use formatação rica (negrito, listas, tópicos) para tornar a resposta didática e fácil de ler.
Pergunta: "${truncatedQuery}"${personaSnippets.length ? `\nPerfil conhecido do criador: ${personaSnippets.join(' • ')}` : ''}${surveyBlock}`;

      const answerRaw = await callOpenAIForQuestion(genericPrompt);
      const inviteText = access.isAdmin
        ? 'Este perfil ainda não possui dados conectados; resposta baseada em práticas gerais.'
        : 'Conecte seu Instagram para ter respostas contextualizadas às suas métricas e liberar seu Mídia Kit.';
      const answer = `${answerRaw?.trim() || ''}\n\n${inviteText}`.trim();

      const cta = access.isAdmin
        ? undefined
        : { label: 'Contextualizar com minhas métricas do Instagram', action: 'connect_instagram' as const };

      const sessionDoc = await ensureChatSession({
        userId: access.targetUserId,
        threadId: threadId || null,
        sourcePage: 'web_chat',
        userSurveySnapshot: surveyProfile || null,
        promptVariant: variantDecision.variant,
        experimentId: variantDecision.experimentId,
      });
      const promptVariant = (sessionDoc as any)?.promptVariant || variantDecision.variant || 'A';
      const experimentId = (sessionDoc as any)?.experimentId || variantDecision.experimentId || null;
      let userMessageId: string | null = null;
      let assistantMessageId: string | null = null;

      try {
        const updated: ChatCompletionMessageParam[] = [
          ...historyMessages,
          { role: 'user', content: truncatedQuery } as ChatCompletionUserMessageParam,
          { role: 'assistant', content: answer } as ChatCompletionAssistantMessageParam,
        ].slice(-HISTORY_LIMIT_SAFE);
        await stateService.setConversationHistory(conversationKey, updated);

        // PERSISTENCE: Save to MongoDB if we have a threadId (inclusive modo admin com thread)
        if (threadId) {
          userMessageId = await stateService.persistMessage(threadId, { role: 'user', content: truncatedQuery });
          assistantMessageId = await stateService.persistMessage(threadId, { role: 'assistant', content: answer });
        }

    await logChatMessage({
      sessionId: sessionDoc._id.toString(),
      userId: access.targetUserId,
      threadId: threadId || null,
      role: 'user',
      content: truncatedQuery,
      intent: 'general',
      confidence: null,
      tokensEstimatedIn: Math.ceil(normalizedQueryRaw.length / 4),
      promptVariant: (sessionDoc as any)?.promptVariant || promptVariant || null,
      experimentId,
      modelVersion: (sessionDoc as any)?.modelVersion || null,
      ragEnabled: (sessionDoc as any)?.ragEnabled || null,
      contextSourcesUsed: (sessionDoc as any)?.contextSourcesUsed || null,
    });

        await logChatMessage({
          sessionId: sessionDoc._id.toString(),
          userId: access.targetUserId,
          threadId: threadId || null,
          messageId: assistantMessageId,
          role: 'assistant',
          content: answer,
          intent: 'general',
          confidence: null,
          llmLatencyMs: null,
          totalLatencyMs: null,
          tokensEstimatedIn: Math.ceil(normalizedQueryRaw.length / 4),
          tokensEstimatedOut: Math.ceil(answer.length / 4),
          hadFallback: answer.toLowerCase().includes('não consegui') || answer.toLowerCase().includes('não posso'),
          promptVariant: (sessionDoc as any)?.promptVariant || promptVariant || null,
          experimentId,
          modelVersion: (sessionDoc as any)?.modelVersion || null,
          ragEnabled: (sessionDoc as any)?.ragEnabled || null,
          contextSourcesUsed: (sessionDoc as any)?.contextSourcesUsed || null,
        });

        const counter = (dialogueState?.summaryTurnCounter ?? 0) + 1;
        const dialogueUpdate: Partial<IDialogueState> = {
          lastInteraction: Date.now(),
          summaryTurnCounter: counter,
        };
        if (counter >= SUMMARY_INTERVAL_SAFE) {
          const summary = await generateConversationSummary(updated, targetDisplayName);
          dialogueUpdate.conversationSummary = summary || dialogueState?.conversationSummary;
          dialogueUpdate.summaryTurnCounter = 0;
        }
        await stateService.updateDialogueState(conversationKey, dialogueUpdate);
      } catch (error) {
        logger.error('[ai/chat] Failed to persist conversation (IG not connected):', error);
      }

      return NextResponse.json({
        answer,
        cta,
        threadId,
        assistantMessageId,
        userMessageId,
        sessionId: sessionDoc?._id?.toString?.() || null,
      }, { status: 200 });
    }

    let intentResult: any = null;
    let effectiveIntent: any = 'general';
    let pendingActionContextFromIntent: any = null;
    let currentTaskPayload: { name: string; objective?: string } | null = null;
    const perfMarks = { intentMs: 0, llmMs: 0 };
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    let intentConfidence = 0.5;

    try {
      const intentStartedAt = Date.now();
      intentResult = await determineIntent(normalizedQuery, targetUser, truncatedQuery, dialogueState || {}, greeting, access.targetUserId);
      perfMarks.intentMs = Date.now() - intentStartedAt;
      if (intentResult?.type === 'special_handled') {
        const specialAnswer = intentResult.response;
        const updated: ChatCompletionMessageParam[] = [
          ...historyMessages,
          { role: 'user', content: truncatedQuery } as ChatCompletionUserMessageParam,
          { role: 'assistant', content: specialAnswer } as ChatCompletionAssistantMessageParam,
        ].slice(-HISTORY_LIMIT_SAFE);
        await stateService.setConversationHistory(conversationKey, updated);

        if (threadId) {
          await stateService.persistMessage(threadId, { role: 'user', content: truncatedQuery });
          await stateService.persistMessage(threadId, { role: 'assistant', content: specialAnswer });
        }

        const counter = (dialogueState?.summaryTurnCounter ?? 0) + 1;
        const dialogueUpdate: Partial<IDialogueState> = {
          lastInteraction: Date.now(),
          summaryTurnCounter: counter,
        };
        if (counter >= SUMMARY_INTERVAL_SAFE) {
          const summary = await generateConversationSummary(updated, targetDisplayName);
          dialogueUpdate.conversationSummary = summary || dialogueState?.conversationSummary;
          dialogueUpdate.summaryTurnCounter = 0;
        }
        await stateService.updateDialogueState(conversationKey, dialogueUpdate);
        return NextResponse.json({ answer: specialAnswer, threadId }, { status: 200 });
      }
      if (intentResult?.type === 'intent_determined') {
        effectiveIntent = intentResult.intent || 'general';
        pendingActionContextFromIntent = intentResult.pendingActionContext;
        if (COMPLEX_TASK_INTENTS.includes(effectiveIntent as any)) {
          const objective =
            effectiveIntent === 'content_plan'
              ? `Criar plano de conteúdo baseado em "${truncatedQuery.slice(0, 80)}"...`
              : `Processar intenção: ${effectiveIntent}`;
          currentTaskPayload = { name: effectiveIntent, objective };
        }
      }
    } catch (error) {
      logger.error('[ai/chat] determineIntent failed:', error);
    }

    if (typeof intentResult?.confidence === 'number') {
      intentConfidence = clamp01(intentResult.confidence);
    } else {
      intentConfidence = clamp01(effectiveIntent === 'general' ? 0.38 : 0.72);
    }

    // Bias de intenção baseado na pesquisa declarada (UX: respostas mais alinhadas sem perguntar de novo)
    const surveyIntent = inferIntentFromSurvey(surveyProfile, dialogueState?.surveyPrefs);
    if (surveyIntent.intent && (effectiveIntent === 'general' || intentConfidence < 0.55)) {
      effectiveIntent = surveyIntent.intent;
      if (!currentTaskPayload && surveyIntent.intent) {
        currentTaskPayload = { name: surveyIntent.intent, objective: surveyIntent.objective || undefined };
      }
    }

    logger.info(`[ai/chat] intent=${effectiveIntent} actor=${actorId} target=${access.targetUserId} thread=${threadId || 'legacy'} intentMs=${perfMarks.intentMs}ms`);

    // Telemetria: garante sessão e loga mensagem do usuário
    const sessionDoc = await ensureChatSession({
      userId: access.targetUserId,
      threadId: threadId || null,
      sourcePage: 'web_chat',
      userSurveySnapshot: surveyProfile || null,
      surveySchemaVersion: 'v1',
      promptVariant: variantDecision.variant,
      experimentId: variantDecision.experimentId,
    });
    const promptVariant = (sessionDoc as any)?.promptVariant || variantDecision.variant || 'A';
    const experimentId = (sessionDoc as any)?.experimentId || variantDecision.experimentId || null;

    await logChatMessage({
      sessionId: sessionDoc._id.toString(),
      userId: access.targetUserId,
      threadId: threadId || null,
      role: 'user',
      content: truncatedQuery,
      intent: effectiveIntent,
      confidence: intentConfidence,
      tokensEstimatedIn: Math.ceil(truncatedQuery.length / 4),
      hadFallback: null,
      promptVariant,
      experimentId,
    });

    const pricingParse = parseChatPricingInput(truncatedQuery);
    let pricingResponse: string | null = null;
    let skipLLM = false;

    if (shouldHandleChatPricing(pricingParse, dialogueState?.lastResponseContext?.topic)) {
      if (pricingParse.missing.length) {
        pricingResponse = buildChatPricingClarification(pricingParse.missing);
        skipLLM = true;
      } else {
        try {
          const calculation = await runPubliCalculator({
            user: targetUser,
            params: pricingParse.params as CalculatorParams,
          });
          pricingResponse = buildChatPricingResponse({ calculation, parse: pricingParse });
          skipLLM = true;
        } catch (error) {
          if ((error as any)?.status === 422) {
            pricingResponse = buildChatPricingInsufficientData((error as Error).message);
            skipLLM = true;
          }
        }
      }
    }

    let answerEngineResult: any = null;
    let answerEngineDuration = 0;
    if (ANSWER_ENGINE_ENABLED && !skipLLM) {
      try {
        const started = Date.now();
        answerEngineResult = await runAnswerEngine({
          user: targetUser,
          query: truncatedQuery.trim(),
          explicitIntent: coerceToAnswerIntent(effectiveIntent),
          surveyProfile,
          preferences: (targetUser as any)?.userPreferences,
          now: new Date(),
        });
        answerEngineDuration = Date.now() - started;
      } catch (error) {
        logger.error('[ai/chat] answer-engine failed', error);
      }
    }

    const narrativeFeedbackSignal = detectNarrativeFeedbackFromQuery(truncatedQuery);

    const scriptContext = SCRIPT_INTENTS.has(effectiveIntent)
      ? await buildScriptContext({
        user: targetUser,
        query: truncatedQuery.trim(),
        intent: effectiveIntent,
        answerEngineResult,
        dialogueState,
        narrativePreferenceOverride: narrativeFeedbackSignal.preference,
      })
      : null;

    const enriched: EnrichedAIContext = {
      user: targetUser,
      historyMessages,
      userName: targetDisplayName,
      dialogueState,
      channel: 'web',
      intentConfidence,
      intentLabel: effectiveIntent,
      promptVariant,
      chatContextJson: contextJson,
      answerEnginePack: answerEngineResult?.contextPack || null,
      scriptContext,
    };

    let finalText = '';
    let userMessageId: string | null = null;
    let assistantMessageId: string | null = null;
    let historyPromise: Promise<ChatCompletionMessageParam[]> | null = null;
    if (skipLLM && pricingResponse) {
      finalText = pricingResponse;
    } else {
      try {
        const llmStartedAt = Date.now();
        const { stream, historyPromise: hp } = await askLLMWithEnrichedContext(enriched, truncatedQuery.trim(), effectiveIntent);
        historyPromise = hp;
        const reader = stream.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (typeof value === 'string') finalText += value;
        }
        perfMarks.llmMs = Date.now() - llmStartedAt;
      } catch (error) {
        logger.error('[ai/chat] Falha na chamada da LLM (web chat):', error);
        finalText = 'Tive um problema técnico para gerar a resposta agora. Pode tentar novamente em instantes?';
      }
    }

    if (!finalText.trim()) {
      finalText = 'Hum... não consegui gerar uma resposta completa agora. Pode tentar reformular ou perguntar novamente?';
    }

    const instigatingQuestion = skipLLM || SCRIPT_INTENTS.has(effectiveIntent)
      ? null
      : await generateInstigatingQuestion(finalText, dialogueState, access.targetUserId);
    const fullResponse = instigatingQuestion ? `${finalText.trim()}\n\n${instigatingQuestion}` : finalText.trim();
    let sanitizedResponse = sanitizeTables(fullResponse);
    if (answerEngineResult?.contextPack) {
      const validation = validateAnswerWithContext(sanitizedResponse, answerEngineResult.contextPack);
      if (validation.badRecoPrevented > 0) {
        logger.info('[answer-engine] chat_bad_reco_prevented', {
          removed: validation.badRecoPrevented,
          intent: answerEngineResult.intent,
        });
      }
      sanitizedResponse = validation.sanitizedResponse;
      logger.info('[answer-engine] telemetry', {
        event: 'answer_engine_validation',
        intent: answerEngineResult.intent,
        candidates_found: answerEngineResult?.ranked?.length || 0,
        thresholds: answerEngineResult?.policy?.thresholds,
        removed_by_validator: validation.badRecoPrevented || 0,
        pack_empty: !answerEngineResult?.topPosts?.length,
        relaxApplied: answerEngineResult?.telemetry?.relaxApplied,
        duration_ms: answerEngineDuration || null,
      });
    }
    const hasAnswerEvidence = Boolean(answerEngineResult?.topPosts?.length || answerEngineResult?.contextPack?.top_posts?.length);
    sanitizedResponse = stripUnprovenCommunityClaims(sanitizedResponse, hasAnswerEvidence);
    const isScriptMode = SCRIPT_INTENTS.has(effectiveIntent);
    let communityInspirations: Array<{
      id: string;
      title?: string;
      description?: string;
      highlights?: string[];
      permalink?: string;
      proposal?: string;
      context?: string;
      format?: string;
      tone?: string;
      reference?: string;
      primaryObjective?: string;
      source: 'community';
      linkVerified?: boolean;
      narrativeScore?: number;
      performanceScore?: number;
      personalizationScore?: number;
      narrativeRole?: 'gancho' | 'desenvolvimento' | 'cta';
      matchReasons?: string[];
    }> = [];
    let communityMeta: {
      matchType?: string;
      usedFilters?: {
        proposal?: string;
        context?: string;
        format?: string;
        tone?: string;
        reference?: string;
        narrativeQuery?: string;
        primaryObjective?: string;
      };
      fallbackMessage?: string;
      rankingSignals?: {
        personalizedByUserPerformance?: boolean;
        userTopCategories?: {
          proposal?: string[];
          context?: string[];
          format?: string[];
          tone?: string[];
        };
      };
    } | null = null;
    if (historyPromise) {
      try {
        const history = await historyPromise;
        const extracted = extractCommunityInspirations(history);
        const rawInspirations = extracted.inspirations;
        communityMeta = extracted.meta;
        const seen = new Set<string>();
        communityInspirations = rawInspirations.reduce((acc: typeof communityInspirations, insp: any, idx: number) => {
          const rawId = insp?.id || insp?._id || insp?.originalInstagramPostUrl;
          if (!rawId) return acc;
          const id = String(rawId);
          if (seen.has(id)) return acc;
          seen.add(id);
          const permalink = isInstagramPostUrl(insp?.originalInstagramPostUrl) ? String(insp.originalInstagramPostUrl).trim() : undefined;
          const highlights = Array.isArray(insp?.performanceHighlights_Qualitative)
            ? insp.performanceHighlights_Qualitative.map((h: any) => String(h).trim()).filter(Boolean)
            : [];
          const proposal = typeof insp?.proposal === 'string' ? insp.proposal.trim() : '';
          const context = typeof insp?.context === 'string' ? insp.context.trim() : '';
          const format = typeof insp?.format === 'string' ? insp.format.trim() : '';
          const tone = typeof insp?.tone === 'string' ? insp.tone.trim() : '';
          const reference = typeof insp?.reference === 'string' ? insp.reference.trim() : '';
          const primaryObjective = typeof insp?.primaryObjectiveAchieved_Qualitative === 'string'
            ? insp.primaryObjectiveAchieved_Qualitative.trim()
            : '';
          const narrativeScore = typeof insp?.narrativeScore === 'number' ? insp.narrativeScore : undefined;
          const performanceScore = typeof insp?.performanceScore === 'number' ? insp.performanceScore : undefined;
          const personalizationScore = typeof insp?.personalizationScore === 'number' ? insp.personalizationScore : undefined;
          const matchReasons = Array.isArray(insp?.matchReasons)
            ? insp.matchReasons.map((reason: any) => String(reason).trim()).filter(Boolean)
            : [];
          const narrativeRole = inferNarrativeRole(
            {
              description: typeof insp?.contentSummary === 'string' ? insp.contentSummary : undefined,
              matchReasons,
            },
            idx
          );
          const summary = typeof insp?.contentSummary === 'string' ? insp.contentSummary.trim() : '';
          const title = proposal || [format, context].filter(Boolean).join(' • ') || reference || `Inspiração ${idx + 1}`;
          acc.push({
            id,
            title,
            description: summary || undefined,
            highlights,
            permalink,
            proposal: proposal || undefined,
            context: context || undefined,
            format: format || undefined,
            tone: tone || undefined,
            reference: reference || undefined,
            primaryObjective: primaryObjective || undefined,
            source: 'community',
            linkVerified: Boolean(permalink),
            narrativeScore,
            performanceScore,
            personalizationScore,
            narrativeRole,
            matchReasons: matchReasons.length ? matchReasons : undefined,
          });
          return acc;
        }, []);
      } catch (error) {
        logger.warn('[ai/chat] failed to parse community inspirations from tool history', error);
      }
    }

    const mapEvidencePost = (p: any) => {
      const permalink = isInstagramPostUrl(p?.permalink) ? String(p.permalink).trim() : undefined;
      return {
        id: p.id,
        permalink,
        format: p.format,
        tags: p.tags,
        source: 'user' as const,
        linkVerified: Boolean(permalink),
        stats: {
          ...p.stats,
          er_by_reach: p.stats?.engagement_rate_on_reach ?? null,
        },
        score: p.score,
        vsBaseline: {
          interactionsPct: p.baselineDelta ?? null,
          erPct: p.erDelta ?? null,
          reachPct: p.reachDelta ?? null,
        },
        title: p.title,
        captionSnippet: p.captionSnippet,
        thumbUrl: p.thumbUrl,
      };
    };

    let answerEvidence = answerEngineResult
      ? {
          version: 'v1',
          intent: answerEngineResult.intent,
          intent_group: answerEngineResult.intentGroup,
          asked_for_examples: answerEngineResult.askedForExamples,
          router_rule_hit: answerEngineResult.routerRuleHit,
          thresholds: {
            minAbs: answerEngineResult.policy.thresholds.minAbsolute,
            minRel: answerEngineResult.policy.thresholds.minRelativeInteractions,
            formatLocked: answerEngineResult.policy.formatLocked || null,
            metricsRequired: answerEngineResult.policy.metricsRequired || [],
            effectiveEr: answerEngineResult.policy.thresholds.effectiveEr || null,
          },
          baselines: {
            windowDays: answerEngineResult.baselines.windowDays,
            p50Interactions: answerEngineResult.baselines.totalInteractionsP50,
            p50ER: answerEngineResult.baselines.engagementRateP50,
            perFormat: Object.fromEntries(
              Object.entries(answerEngineResult.baselines.perFormat || {}).map(([fmt, vals]) => {
                const safe = vals as { totalInteractionsP50?: number; engagementRateP50?: number | null };
                return [
                  fmt,
                  { p50Interactions: safe.totalInteractionsP50, p50ER: safe.engagementRateP50 },
                ];
              }),
            ),
          },
          topPosts: answerEngineResult.topPosts.slice(0, 8).map(mapEvidencePost),
          communityInspirations: communityInspirations.length ? communityInspirations : undefined,
          communityMeta: communityMeta || undefined,
          relaxApplied: answerEngineResult.telemetry?.relaxApplied,
          diagnosticEvidence: answerEngineResult.diagnosticEvidence
            ? {
                insufficient: answerEngineResult.diagnosticEvidence.insufficient,
                perFormat: (answerEngineResult.diagnosticEvidence.perFormat || []).map((block: any) => ({
                  format: block.format,
                  sampleSize: block.sampleSize,
                  insufficient: block.insufficient,
                  reason: block.reason,
                  deltas: block.deltas,
                  lowPosts: (block.lowPosts || []).map((p: any) => ({
                    id: p.id,
                    permalink: isInstagramPostUrl(p.permalink) ? String(p.permalink).trim() : undefined,
                    format: p.format,
                    tags: p.tags,
                    source: 'user',
                    linkVerified: isInstagramPostUrl(p.permalink),
                    stats: p.stats,
                    vsBaseline: {
                      interactionsPct: p.baselineDelta ?? null,
                      erPct: p.erDelta ?? null,
                      reachPct: p.reachDelta ?? null,
                    },
                    title: p.tags?.[0] || (Array.isArray(p.format) ? p.format[0] : p.format) || undefined,
                    captionSnippet: (p.raw?.description || '').slice(0, 120) || undefined,
                    thumbUrl: p.raw?.coverUrl || undefined,
                  })),
                  highPosts: (block.highPosts || []).map((p: any) => ({
                    id: p.id,
                    permalink: isInstagramPostUrl(p.permalink) ? String(p.permalink).trim() : undefined,
                    format: p.format,
                    tags: p.tags,
                    source: 'user',
                    linkVerified: isInstagramPostUrl(p.permalink),
                    stats: p.stats,
                    vsBaseline: {
                      interactionsPct: p.baselineDelta ?? null,
                      erPct: p.erDelta ?? null,
                      reachPct: p.reachDelta ?? null,
                    },
                    title: p.tags?.[0] || (Array.isArray(p.format) ? p.format[0] : p.format) || undefined,
                    captionSnippet: (p.raw?.description || '').slice(0, 120) || undefined,
                    thumbUrl: p.raw?.coverUrl || undefined,
                  })),
                })),
              }
            : null,
        }
      : (communityInspirations.length
          ? {
              version: 'v1',
              intent: effectiveIntent,
              intent_group: isScriptMode ? 'planning' : 'inspiration',
              asked_for_examples: !isScriptMode,
              thresholds: {},
              baselines: {
                windowDays: 0,
              },
              topPosts: [],
              communityInspirations,
              communityMeta: communityMeta || undefined,
            }
          : null);

    const allowedLinks = new Set<string>();
    if (answerEvidence) {
      const pushAllowed = (url?: string | null, verified?: boolean) => {
        const normalized = normalizeInstagramUrl(url || undefined);
        if (!normalized) return;
        if (verified === false) return;
        allowedLinks.add(normalized);
      };
      answerEvidence.topPosts?.forEach((post: any) => {
        if (post?.source && post.source !== 'user') return;
        pushAllowed(post.permalink, post.linkVerified);
      });
      answerEvidence.communityInspirations?.forEach((insp: any) => {
        pushAllowed(insp.permalink, insp.linkVerified);
      });
      const diagnosticBlocks = (answerEvidence as any)?.diagnosticEvidence?.perFormat || [];
      if (Array.isArray(diagnosticBlocks)) {
        diagnosticBlocks.forEach((block: any) => {
          const posts = [...(block?.lowPosts || []), ...(block?.highPosts || [])];
          posts.forEach((post: any) => pushAllowed(post?.permalink, post?.linkVerified));
        });
      }
    }
    sanitizedResponse = sanitizeInstagramLinks(sanitizedResponse, allowedLinks);
    if (isScriptMode) {
      const scriptTopic = summarizeRequestTopic(truncatedQuery);
      if (shouldAskScriptClarification(truncatedQuery, scriptTopic)) {
        sanitizedResponse = buildScriptClarificationMessage();
        logger.info('[ai/chat] script_clarification_required', {
          actor: actorId,
          target: access.targetUserId,
          query: summarizeRequestTopic(truncatedQuery),
        });
      } else {
        const scriptInspirationHint = buildScriptInspirationHint(
          communityInspirations,
          communityMeta,
          scriptTopic || 'seu tema'
        );
        const scriptContract = enforceScriptContract(sanitizedResponse, truncatedQuery, {
          inspiration: scriptInspirationHint,
        });
        sanitizedResponse = scriptContract.normalized;
        if (scriptContract.repaired) {
          logger.info('[ai/chat] script_contract_repaired', {
            issues: scriptContract.issues,
            quality: scriptContract.quality,
            actor: actorId,
            target: access.targetUserId,
          });
        }
        logger.info('[ai/chat] script_mode_metrics', {
          event: 'script_response_ready',
          actor: actorId,
          target: access.targetUserId,
          repaired: scriptContract.repaired,
          sceneCount: scriptContract.quality.sceneCount,
          hasCta: scriptContract.quality.hasCta,
          communityInspirationsUsed: communityInspirations.length,
          communityMatchType: communityMeta?.matchType || null,
        });
      }
    }

    const surveyNudgeNeeded = !isScriptMode && !access.isAdmin && (surveyFreshness.isStale || surveyFreshness.missingCore.length > 0);
    const surveyNudgeText = surveyNudgeNeeded
      ? `Para personalizar com o que você preencheu na pesquisa, confirme seu ${surveyFreshness.missingCore.join('/') || 'perfil'} rapidinho (leva 2 min).`
      : null;
    const surveyContextNote = (!isScriptMode && !surveyNudgeNeeded && buildSurveyContextNote(surveyProfile, truncatedQuery)) || null;
    if (surveyNudgeText) {
      sanitizedResponse = `${sanitizedResponse}\n\n> [!IMPORTANT]\n> ${surveyNudgeText}`;
    } else if (surveyContextNote && effectiveIntent !== 'ask_community_inspiration') {
      sanitizedResponse = `${sanitizedResponse}\n\n> [!NOTE]\n> Contexto aplicado (pesquisa): ${surveyContextNote}`;
    }
    const pendingActionInfo = isScriptMode
      ? { suggests: false, actionType: null, pendingActionContext: null }
      : aiResponseSuggestsPendingAction(sanitizedResponse);
    let pendingActionPayload: { type: string; context?: any } | null = surveyNudgeNeeded
      ? { type: 'survey_update_request', context: { missingFields: surveyFreshness.missingCore, stale: surveyFreshness.isStale } }
      : null;

    try {
      const updated: ChatCompletionMessageParam[] = [
        ...historyMessages,
        { role: 'user', content: truncatedQuery } as ChatCompletionUserMessageParam,
        { role: 'assistant', content: sanitizedResponse } as ChatCompletionAssistantMessageParam,
      ].slice(-HISTORY_LIMIT_SAFE);
      await stateService.setConversationHistory(conversationKey, updated);

      if (threadId) {
        userMessageId = await stateService.persistMessage(threadId, { role: 'user', content: truncatedQuery });
        assistantMessageId = await stateService.persistMessage(threadId, { role: 'assistant', content: sanitizedResponse });
      }

      await logChatMessage({
        sessionId: sessionDoc._id.toString(),
        userId: access.targetUserId,
        threadId: threadId || null,
        messageId: assistantMessageId,
        role: 'assistant',
        content: sanitizedResponse,
        intent: effectiveIntent,
        confidence: intentConfidence,
        llmLatencyMs: perfMarks.llmMs || null,
        totalLatencyMs: perfMarks.llmMs || null,
        tokensEstimatedIn: Math.ceil(normalizedQueryRaw.length / 4),
        tokensEstimatedOut: Math.ceil(sanitizedResponse.length / 4),
        hadFallback: sanitizedResponse.toLowerCase().includes('não consegui') || sanitizedResponse.toLowerCase().includes('não posso'),
        fallbackReason: sanitizedResponse.toLowerCase().includes('não consegui')
          ? 'tool_error'
          : sanitizedResponse.toLowerCase().includes('não posso')
            ? 'safety_refusal'
            : null,
        promptVariant: (sessionDoc as any)?.promptVariant || promptVariant || null,
        experimentId,
        modelVersion: (sessionDoc as any)?.modelVersion || null,
        ragEnabled: (sessionDoc as any)?.ragEnabled || null,
        contextSourcesUsed: (sessionDoc as any)?.contextSourcesUsed || null,
      });

      const extractedContext = await extractContextFromAIResponse(sanitizedResponse, access.targetUserId);
      const counter = (dialogueState?.summaryTurnCounter ?? 0) + 1;
      const previousTopic = dialogueState?.lastResponseContext?.topic;
      const currentTopic = extractedContext?.topic;
      const topicChanged =
        previousTopic &&
        currentTopic &&
        normalizeText(previousTopic || '') !== normalizeText(currentTopic || '');
      let summaryCounter = counter;
      if (topicChanged) {
        summaryCounter = SUMMARY_INTERVAL_SAFE; // força um resumo na mudança brusca de tópico
      }
      const dialogueUpdate: Partial<IDialogueState> = {
        lastInteraction: Date.now(),
        lastResponseContext: extractedContext,
        summaryTurnCounter: summaryCounter,
        surveyPrefs: {
          stage: Array.isArray(surveyProfile?.stage) ? surveyProfile.stage.slice(0, 2) : undefined,
          niches: Array.isArray(surveyProfile?.niches) ? surveyProfile.niches.slice(0, 3) : undefined,
          mainGoal3m: surveyProfile?.mainGoal3m || null,
          mainPlatformReasons: Array.isArray(surveyProfile?.mainPlatformReasons) ? surveyProfile.mainPlatformReasons.slice(0, 2) : undefined,
          nextPlatform: Array.isArray(surveyProfile?.nextPlatform) ? surveyProfile.nextPlatform.slice(0, 2) : undefined,
          pricingFear: surveyProfile?.pricingFear || null,
          learningStyles: Array.isArray(surveyProfile?.learningStyles) ? surveyProfile.learningStyles.slice(0, 2) : undefined,
          updatedAt: surveyFreshness.updatedAt ? surveyFreshness.updatedAt.getTime() : undefined,
        },
      };

      if (narrativeFeedbackSignal.preference) {
        const previousScriptPrefs = (dialogueState as any)?.scriptPreferences || {};
        dialogueUpdate.scriptPreferences = {
          ...previousScriptPrefs,
          narrativePreference: narrativeFeedbackSignal.preference,
          lastNarrativeFeedbackAt: Date.now(),
          note: narrativeFeedbackSignal.note || previousScriptPrefs?.note || null,
        } as any;
      }

      // Auto-generate title if this is the start of a conversation
      if (threadId && historyMessages.length === 0) {
        // Fire and forget
        stateService.generateThreadTitle(threadId, truncatedQuery);
      }
      if (surveyNudgeNeeded) {
        dialogueUpdate.lastAIQuestionType = 'survey_update_request';
        dialogueUpdate.pendingActionContext = { missingFields: surveyFreshness.missingCore, stale: surveyFreshness.isStale };
      } else if (pendingActionInfo.suggests) {
        dialogueUpdate.lastAIQuestionType = pendingActionInfo.actionType || undefined;
        dialogueUpdate.pendingActionContext = pendingActionInfo.pendingActionContext;
      } else if (pendingActionContextFromIntent) {
        dialogueUpdate.pendingActionContext = pendingActionContextFromIntent;
        dialogueUpdate.lastAIQuestionType = dialogueState?.lastAIQuestionType;
      } else {
        dialogueUpdate.lastAIQuestionType = undefined;
        dialogueUpdate.pendingActionContext = undefined;
      }
      if (currentTaskPayload) {
        dialogueUpdate.currentTask = currentTaskPayload;
      } else if (dialogueState?.currentTask && !COMPLEX_TASK_INTENTS.includes(effectiveIntent as any)) {
        dialogueUpdate.currentTask = null;
      }
      if (summaryCounter >= SUMMARY_INTERVAL_SAFE) {
        const summary = await generateConversationSummary(updated, targetDisplayName);
        dialogueUpdate.conversationSummary = summary || dialogueState?.conversationSummary;
        dialogueUpdate.summaryTurnCounter = 0;
      }
      await stateService.updateDialogueState(conversationKey, dialogueUpdate);
    } catch (error) {
      logger.error('[ai/chat] Failed to persist conversation (IG connected):', error);
    }

    let cta: { label: string; action: 'go_to_billing' } | undefined;
    if (!access.isAdmin) {
      try {
        const planFromSession = normalizePlanStatus((sessionUser as any)?.planStatus);
        const planFromDb = normalizePlanStatus((targetUser as any)?.planStatus);
        const effectivePlan = planFromSession || planFromDb;
        if (!isActiveLike(effectivePlan)) {
          cta = {
            label: 'Entre no Plano Pro e receba alertas diários via WhatsApp',
            action: 'go_to_billing',
          };
        }
      } catch { }
    }

    if (pendingActionInfo.suggests && !pendingActionPayload) {
      const actionType = pendingActionInfo.actionType ?? 'follow_up_question';
      pendingActionPayload = { type: actionType, context: pendingActionInfo.pendingActionContext };
    }

    const currentTaskResponse = currentTaskPayload || (COMPLEX_TASK_INTENTS.includes(effectiveIntent as any) ? dialogueState?.currentTask ?? null : null);

    logger.info(`[ai/chat] actor=${actorId} target=${access.targetUserId} thread=${threadId || 'legacy'} llmMs=${perfMarks.llmMs}ms pendingAction=${pendingActionPayload?.type || 'none'} currentTask=${currentTaskResponse?.name || 'none'} respLen=${sanitizedResponse.length}`);

    return NextResponse.json({
      answer: sanitizedResponse,
      cta,
      pendingAction: pendingActionPayload,
      currentTask: currentTaskResponse,
      threadId,
      assistantMessageId,
      userMessageId,
      sessionId: sessionDoc?._id?.toString?.() || null,
      intent: effectiveIntent,
      answerEvidence,
    }, { status: 200 });
  } catch (error: unknown) {
    console.error("POST /api/ai/chat error:", error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
