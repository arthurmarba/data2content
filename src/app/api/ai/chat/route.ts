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
import { fetchTopCategories, getTopPostsByMetric } from "@/app/lib/dataService";
import { recommendWeeklySlots } from "@/app/lib/planner/recommender";
import { getThemesForSlot } from "@/app/lib/planner/themes";
import { getBlockSampleCaptions } from "@/utils/getBlockSampleCaptions";
import {
  buildChatPricingClarification,
  buildChatPricingInsufficientData,
  buildChatPricingResponse,
  parseChatPricingInput,
  shouldHandleChatPricing,
} from "@/app/lib/pricing/chatPricing";
import { runPubliCalculator, type CalculatorParams } from "@/app/lib/pricing/publiCalculator";
import { isPricingBrandRiskV1Enabled, isPricingCalibrationV1Enabled } from "@/app/lib/pricing/featureFlag";

// Garante que essa rota use Node.js em vez de Edge (importante para Mongoose).
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const HISTORY_LIMIT_SAFE = HISTORY_LIMIT || 10;
const SUMMARY_INTERVAL_SAFE = SUMMARY_GENERATION_INTERVAL || 6;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const MAX_AI_EXCERPT = 900;
const MAX_QUERY_CHARS = 4000;
const CONTEXT_EXTRACTION_MIN_LEN_FOR_AI = 220;
const AI_INSTIGATING_QUESTION_ENABLED = process.env.CHAT_AI_INSTIGATING_QUESTION === 'true';
const HARMFUL_PATTERNS = [/su[ií]c[ií]dio/i, /\bme matar\b/i, /\bmatar algu[eé]m\b/i, /aut[oô]mutila/i];
const ANSWER_ENGINE_ENABLED = process.env.ANSWER_ENGINE_ENABLED !== 'false';
const SCRIPT_ALWAYS_GENERATE = process.env.SCRIPT_ALWAYS_GENERATE !== 'false';
const SCRIPT_TOP_POST_INSPIRATION_FALLBACK = process.env.SCRIPT_TOP_POST_INSPIRATION_FALLBACK !== 'false';
const SCRIPT_BRIEF_V2_ENABLED = process.env.SCRIPT_BRIEF_V2 !== 'false';
const SCRIPT_REWRITE_PASS_ENABLED = process.env.SCRIPT_REWRITE_PASS !== 'false';

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

type ScriptInspirationSource = 'community' | 'user_top_posts' | 'none';

type ScriptExecutionPlan = {
  primaryIdea?: string;
  objective?: string;
  hookAngle?: string;
  ctaAngle?: string;
  evidenceSummary?: string;
  evidenceConfidence?: 'alto' | 'medio' | 'baixo';
  sourcePriority?: string[];
  contextStrength?: number;
};

type ScriptQualityScoreV2 = {
  semanticEchoRatio: number;
  speechStrength: number;
  speakabilityScore: number;
  instructionalSpeechRatio: number;
  actionabilityScore: number;
  languageNaturalnessPtBr: number;
  specificity: number;
  ctaPresence: boolean;
};

type ScriptFallbackLevel = 'none' | 'rewrite_pass' | 'static_fallback';

type ScriptContractQuality = {
  hasRoteiroBlock: boolean;
  hasLegendaBlock: boolean;
  sceneCount: number;
  hasCta: boolean;
  score?: ScriptQualityScoreV2;
  fallbackSource?: ScriptInspirationSource;
  fallbackLevel?: ScriptFallbackLevel;
};

type ScriptContractResult = {
  normalized: string;
  repaired: boolean;
  issues: string[];
  quality: ScriptContractQuality;
};

type ScriptInspirationHint = {
  source?: ScriptInspirationSource;
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
  topic?: string | null;
  plannerThemes?: string[];
  isHumor?: boolean;
  executionPlan?: ScriptExecutionPlan | null;
  inspirationSource?: ScriptInspirationSource;
};

type ScriptBrief = {
  topic: string;
  audience?: string;
  objective?: string;
  timeConstraint?: string;
  confidence: number;
  ambiguityReasons: string[];
  usedContextFallback?: boolean;
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
    const sourceRaw = typeof (parsed as any).source === 'string'
      ? (parsed as any).source.trim().toLowerCase()
      : '';
    const source: ScriptInspirationSource | undefined =
      sourceRaw === 'community' || sourceRaw === 'user_top_posts' || sourceRaw === 'none'
        ? (sourceRaw as ScriptInspirationSource)
        : undefined;
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
      source,
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
  'fazer', 'possa', 'quero', 'preciso', 'hoje', 'agora', 'amanha', 'amanhã', 'depois', 'semana', 'mes', 'mês',
  'proximo', 'próximo', 'proxima', 'próxima',
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

const GENERIC_SCRIPT_ECHO_PATTERNS = [
  /\bcrie um roteiro\b/i,
  /\bo que postar\b/i,
  /\bque eu possa postar\b/i,
  /\bpara que eu possa postar\b/i,
  /\bpara postar (hoje|amanh[ãa])\b/i,
  /\bme traga um roteiro\b/i,
  /\broteiro de conte[úu]do\b/i,
  /\bmonte um roteiro\b/i,
  /\broteiro para eu postar\b/i,
];

const BROKEN_PTBR_PATTERNS = [
  /\bem quando\b/i,
  /\bisso em quando\b/i,
  /\bque eu possa postar\b/i,
  /\bpara que eu possa postar\b/i,
  /\bfa[zs] assim:\s*passo 1 para\b/i,
];

const ACTIONABLE_SCRIPT_PATTERNS = [
  /\bmostr[ea]\b/i,
  /\babra\b/i,
  /\bgrave\b/i,
  /\bdemonstr[ea]\b/i,
  /\bcompare\b/i,
  /\bapresente\b/i,
  /\bcorte\b/i,
  /\buse\b/i,
  /\binclua\b/i,
  /\baponte\b/i,
  /\bfinalize\b/i,
  /\bcomente\b/i,
  /\bsalve\b/i,
  /\bcompartilhe\b/i,
];

const INSTRUCTIONAL_SPEECH_PATTERNS = [
  /^\s*(mostre|mostra|apresente|demonstre|abra|grave|compare|inclua|aponte|finalize)\b/i,
  /^\s*(abrir com|fechar com|encerrar com|encerramento com)\b/i,
  /^\s*(gancho|hook|cta)\b/i,
  /\bpasso\s*[12]\s+para\b/i,
  /\bcall to action\b/i,
  /\bchamada para a[cç][aã]o\b/i,
  /\bcta\b/i,
];

const SPEAKABLE_SPEECH_REQUIREMENTS = {
  minWords: 8,
  maxWords: 34,
  subjectPatterns: [/\beu\b/i, /\bvoc[eê]\b/i, /\bse voc[eê]\b/i, /\bquando voc[eê]\b/i],
  actionOrResultPatterns: [
    /\bcorrig/i,
    /\bev[it]/i,
    /\bganh/i,
    /\bmelhor/i,
    /\baument/i,
    /\bresolv/i,
    /\bdestrav/i,
    /\breduz/i,
    /\borganiza/i,
    /\beconomiz/i,
    /\bfuncion/i,
    /\bresultado\b/i,
    /\bcomenta\b/i,
    /\bsalve\b/i,
    /\bcompartilhe\b/i,
    /\bmanda\b/i,
  ],
};

const isBrokenPtBr = (value: string) => {
  const cleaned = cleanScriptCell(value || '');
  if (!cleaned) return false;
  return BROKEN_PTBR_PATTERNS.some((pattern) => pattern.test(cleaned));
};

const countWords = (value: string) =>
  (value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const hasInstructionalSpeechPattern = (value: string) => {
  const cleaned = cleanScriptCell(value || '');
  if (!cleaned) return false;
  return INSTRUCTIONAL_SPEECH_PATTERNS.some((pattern) => pattern.test(cleaned));
};

const isPracticalCreatorSpeech = (value: string) => {
  const cleaned = cleanScriptCell(value || '');
  if (!cleaned) return false;
  if (hasInstructionalSpeechPattern(cleaned)) return false;
  const words = countWords(cleaned);
  if (words < SPEAKABLE_SPEECH_REQUIREMENTS.minWords || words > SPEAKABLE_SPEECH_REQUIREMENTS.maxWords) {
    return false;
  }
  const hasConversationalSubject = SPEAKABLE_SPEECH_REQUIREMENTS.subjectPatterns.some((pattern) => pattern.test(cleaned));
  if (!hasConversationalSubject) return false;
  return SPEAKABLE_SPEECH_REQUIREMENTS.actionOrResultPatterns.some((pattern) => pattern.test(cleaned));
};

const tokenizeForScriptSimilarity = (value: string) =>
  normalizeTopicText(value || '')
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !GENERIC_TOPIC_TOKENS.has(token));

const computeTokenOverlapScore = (left: string, right: string) => {
  const leftTokens = Array.from(new Set(tokenizeForScriptSimilarity(left)));
  const rightTokens = Array.from(new Set(tokenizeForScriptSimilarity(right)));
  if (!leftTokens.length || !rightTokens.length) return 0;
  const rightSet = new Set(rightTokens);
  const overlap = leftTokens.filter((token) => rightSet.has(token)).length;
  return roundRatio(overlap / Math.max(1, Math.min(leftTokens.length, rightTokens.length)));
};

const isActionableScriptRow = (row: ScriptTableRow) => {
  const visual = cleanScriptCell(row.visual || '');
  const audio = cleanScriptCell(row.audio || '');
  const combined = `${visual} ${audio}`.trim();
  if (!combined) return false;
  const hasActionVerb = ACTIONABLE_SCRIPT_PATTERNS.some((pattern) => pattern.test(combined));
  const hasSpecificityCue = /\b(passo|antes|depois|exemplo|resultado|prova|cta|texto na tela|corte|benef[ií]cio)\b/i.test(combined);
  return hasActionVerb && (hasSpecificityCue || combined.length > 60);
};

const hasGenericScriptEcho = (value: string, userQuery: string) => {
  const cleaned = cleanScriptCell(value || '');
  if (!cleaned) return false;
  if (looksLikePromptEcho(cleaned, userQuery)) return true;
  return GENERIC_SCRIPT_ECHO_PATTERNS.some((pattern) => pattern.test(cleaned));
};

const isWeakScriptSpeech = (value: string, userQuery: string) => {
  const cleaned = cleanScriptCell(value || '');
  if (!cleaned) return true;
  if (isPlaceholderLike(cleaned)) return true;
  if (hasInstructionalSpeechPattern(cleaned)) return true;
  if (!isPracticalCreatorSpeech(cleaned)) return true;
  if (isBrokenPtBr(cleaned)) return true;
  if (hasGenericScriptEcho(cleaned, userQuery)) return true;
  return false;
};

const resolveScriptTitle = (candidateTitle: string | null, topic: string, userQuery: string) => {
  const fallbackTitle = buildScriptTitleFromTopic(topic);
  if (!candidateTitle) return fallbackTitle;
  const cleaned = stripMarkdownMarkers(candidateTitle);
  if (!cleaned) return fallbackTitle;
  if (looksLikePromptEcho(cleaned, userQuery)) return fallbackTitle;
  if (hasGenericScriptEcho(cleaned, userQuery)) return fallbackTitle;
  if (!hasMeaningfulTopic(cleaned)) return fallbackTitle;
  return cleaned;
};

const humanizeCategoryToken = (value?: string | null) =>
  (value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeTopicCandidate = (value?: string | null) =>
  stripMarkdownMarkers(value || '')
    .replace(/[|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[?.!,:;]+$/g, '')
    .trim();

const pickBestTopicCandidate = (candidates: Array<string | null | undefined>) => {
  for (const raw of candidates) {
    const candidate = normalizeTopicCandidate(raw);
    if (!candidate) continue;
    if (!hasMeaningfulTopic(candidate)) continue;
    return candidate;
  }
  return '';
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

const buildSpeakableSceneBlueprint = (
  topic: string,
  objective?: string | null,
  isHumor = false
): ScriptTableRow[] => {
  const safeTopic = hasMeaningfulTopic(topic) ? topic : 'uma dor real do seu nicho';
  const normalizedObjective = objectiveLabel(objective);

  if (isHumor) {
    return [
      {
        time: '00-03s',
        visual: `Setup rápido com expressão exagerada sobre ${safeTopic}.`,
        audio: `Eu achei que ${safeTopic} seria fácil, mas o perrengue veio em segundos.`,
      },
      {
        time: '03-10s',
        visual: 'Conflito com erro visível e reação cômica.',
        audio: 'Quando eu repeti esse erro, o resultado ficou tão ruim que eu ri de nervoso.',
      },
      {
        time: '10-22s',
        visual: 'Virada com ajuste simples e punchline final.',
        audio: 'Se você corrigir esse ponto agora, você evita retrabalho e ganha fluidez na execução.',
      },
      {
        time: '22-30s',
        visual: 'Fechamento com reação + CTA na tela.',
        audio: 'Se você já passou por isso, comenta "eu", salva e manda para quem vive esse caos.',
      },
    ];
  }

  const ctaLine = normalizedObjective === 'converter'
    ? 'Se você quer aplicar no seu caso, comenta "quero" ou me chama no direct para eu te enviar o próximo passo.'
    : normalizedObjective === 'viralizar'
      ? 'Se isso te ajudou, salva agora e compartilha com alguém que precisa destravar esse resultado.'
      : 'Se isso fez sentido, salva esse vídeo e comenta "roteiro" que eu te mando outra variação prática.';

  const adjustmentLine = normalizedObjective === 'converter'
    ? 'Você corrige assim: primeiro gere valor claro, depois puxe ação sem travar a conversa.'
    : 'Você corrige assim: primeiro ajuste a base, depois mantenha consistência sem complicar.';

  return [
    {
      time: '00-03s',
      visual: `Close no rosto + texto forte sobre ${safeTopic}.`,
      audio: `Se você ainda erra em ${safeTopic}, hoje você vai corrigir isso de forma simples e prática.`,
    },
    {
      time: '03-10s',
      visual: 'Exemplo rápido do erro comum (antes), com destaque visual.',
      audio: 'Quando você repete esse erro, você perde clareza, retenção e resposta do público.',
    },
    {
      time: '10-22s',
      visual: 'Ajuste em 2 passos aplicado na prática (depois).',
      audio: adjustmentLine,
    },
    {
      time: '22-30s',
      visual: 'Fechamento com benefício final e CTA explícito na tela.',
      audio: ctaLine,
    },
  ];
};

const buildDefaultHumorRows = (topic: string): ScriptTableRow[] =>
  buildSpeakableSceneBlueprint(topic, 'engajar', true);

const buildDefaultRows = (topic: string, isHumor = false): ScriptTableRow[] =>
  buildSpeakableSceneBlueprint(topic, undefined, isHumor);

const ensureRowsQuality = (
  rows: ScriptTableRow[],
  topic: string,
  opts?: { userQuery?: string; isHumor?: boolean }
): { rows: ScriptTableRow[]; hasCta: boolean; rewrittenAudioCount: number } => {
  const isHumor = Boolean(opts?.isHumor);
  const userQuery = opts?.userQuery || '';
  const fallbackRows = buildDefaultRows(topic, isHumor);
  const safeRows = rows
    .map((row) => ({
      time: cleanScriptCell(row.time || 'Auto') || 'Auto',
      visual: cleanScriptCell(row.visual || ''),
      audio: cleanScriptCell(row.audio || ''),
    }))
    .filter((row) => isMeaningfulScene(row));

  if (!safeRows.length) {
    return { rows: fallbackRows, hasCta: true, rewrittenAudioCount: fallbackRows.length };
  }

  let curated = safeRows.slice(0, 6);
  while (curated.length < 3) {
    curated = [...curated, ...fallbackRows].slice(0, 3);
  }

  let rewrittenAudioCount = 0;
  curated = curated.map((row, idx) => {
    const fallback =
      fallbackRows[Math.min(idx, fallbackRows.length - 1)] ||
      fallbackRows[0] ||
      { time: '00-03s', visual: 'Cena de apoio', audio: 'Se você simplificar a mensagem agora, você ganha clareza e resposta mais rápida.' };
    const visual = (!row.visual || isPlaceholderLike(row.visual) || hasGenericScriptEcho(row.visual, userQuery))
      ? fallback.visual
      : row.visual;
    const shouldRewriteAudio = isWeakScriptSpeech(row.audio, userQuery);
    const audio = shouldRewriteAudio
      ? fallback.audio
      : row.audio;
    if (shouldRewriteAudio) {
      rewrittenAudioCount += 1;
    }
    return {
      time: row.time || fallback.time,
      visual,
      audio,
    };
  });

  const hasCta = curated.some((row) =>
    /cta|call to action|salve|compartilhe|comente|dm|link|seguir/i.test(`${row.time} ${row.visual} ${row.audio}`)
  );

  let hasCtaFinal = hasCta;
  if (!hasCta) {
    curated.push({
      time: '20-30s',
      visual: 'Encerramento com reforço do benefício e ação sugerida.',
      audio: isHumor
        ? 'Se você riu e aprendeu, comenta "parte 2", salva e envia para aquele amigo que precisa dessa ideia.'
        : 'Se fez sentido, salve este roteiro e compartilhe com alguém do seu nicho.',
    });
    hasCtaFinal = true;
    rewrittenAudioCount += 1;
  }

  return { rows: curated.slice(0, 6), hasCta: hasCtaFinal, rewrittenAudioCount };
};

const ensureCaptionVariants = (captionContent: string, topic: string, userQuery?: string): string => {
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
  const rawBase = variantMap.get(1) || stripMarkdownMarkers(normalizedLines[0] || '');
  const base =
    rawBase && !hasGenericScriptEcho(rawBase, userQuery || '')
      ? rawBase
      : `Ideia prática para resolver ${safeTopic}.`;
  if (!variantMap.get(1) || hasGenericScriptEcho(variantMap.get(1) || '', userQuery || '')) {
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

const buildFallbackScriptResponse = (
  query: string,
  isHumor = false,
  executionPlan?: ScriptExecutionPlan | null,
  inspirationSource: ScriptInspirationSource = 'none'
) => {
  const topic = pickBestTopicCandidate([executionPlan?.primaryIdea, summarizeRequestTopic(query)]) || 'um tema do seu nicho';
  const rows = applyExecutionPlanToRows(topic, isHumor, executionPlan);
  const baseSummary = executionPlan?.evidenceSummary || 'Baseado em sinais históricos de engajamento da conta.';
  const tableRows = rows.map((row) => `| ${row.time} | ${row.visual} | ${row.audio} |`).join('\n');
  return [
    '[ROTEIRO]',
    `**Título Sugerido:** ${buildScriptTitleFromTopic(topic)}`,
    `**Pauta Estratégica:** ${topic}`,
    `**Base de Engajamento:** ${baseSummary}`,
    `**Confiança da Base:** ${executionPlan?.evidenceConfidence === 'alto' ? 'Alta' : executionPlan?.evidenceConfidence === 'medio' ? 'Média' : 'Baixa'}`,
    `**Fonte da Inspiração:** ${resolveInspirationSourceLabel(inspirationSource)}`,
    '**Formato Ideal:** Reels | **Duração Estimada:** 30s',
    '',
    '| Tempo | Visual (o que aparece) | Fala (o que dizer) |',
    '| :--- | :--- | :--- |',
    tableRows,
    '[/ROTEIRO]',
    '',
    '[LEGENDA]',
    ensureCaptionVariants('', topic, query),
    '[/LEGENDA]',
  ].join('\n');
};

export function enforceScriptContract(response: string, userQuery: string, hints?: ScriptContractHints): ScriptContractResult {
  const issues: string[] = [];
  const hintedTopic = pickBestTopicCandidate([hints?.topic, ...(hints?.plannerThemes || [])]);
  const topic = hintedTopic || summarizeRequestTopic(userQuery) || 'um tema do seu nicho';
  const executionPlan = hints?.executionPlan || null;
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
    const fallback = buildFallbackScriptResponse(
      userQuery,
      Boolean(hints?.isHumor),
      executionPlan,
      hints?.inspirationSource || 'none'
    );
    return {
      normalized: fallback,
      repaired: true,
      issues: [...issues, 'fallback_generated'],
      quality: {
        hasRoteiroBlock: true,
        hasLegendaBlock: true,
        sceneCount: 3,
        hasCta: true,
        fallbackLevel: 'static_fallback',
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

  const isHumor = Boolean(hints?.isHumor);
  const ensured = ensureRowsQuality(tableRows.length ? tableRows : looseRows, topic, {
    userQuery,
    isHumor,
  });
  let rows = ensured.rows;
  let fallbackLevel: ScriptFallbackLevel = 'none';
  if (ensured.rewrittenAudioCount > 0) {
    issues.push('speech_row_rewritten_practical');
    repaired = true;
  }
  if (ensured.rewrittenAudioCount >= 3) {
    issues.push('all_speech_rows_rewritten_practical');
  }

  const genericPromptEchoRows = rows.filter((row) =>
    hasGenericScriptEcho(`${row.visual} ${row.audio}`, userQuery)
  );
  const instructionalSpeechRows = rows.filter((row) => hasInstructionalSpeechPattern(row.audio));
  const weakAudioRows = rows.filter((row) => isWeakScriptSpeech(row.audio, userQuery));
  if (instructionalSpeechRows.length > 0) {
    issues.push('instructional_speech_detected');
    repaired = true;
  }
  const shouldReplaceAllRows =
    rows.length >= 3 &&
    hasMeaningfulTopic(topic) &&
    (
      instructionalSpeechRows.length > 0 ||
      genericPromptEchoRows.length >= Math.max(2, Math.ceil(rows.length / 3)) ||
      weakAudioRows.length >= Math.ceil(rows.length / 2)
    );
  if (shouldReplaceAllRows) {
    if (SCRIPT_REWRITE_PASS_ENABLED) {
      rows = rewriteRowsWithExecutionPlan(rows, topic, isHumor, executionPlan);
      fallbackLevel = 'rewrite_pass';
      issues.push('generic_prompt_echo_rows_rewritten');
    } else {
      rows = applyExecutionPlanToRows(topic, isHumor, executionPlan);
      fallbackLevel = 'static_fallback';
      issues.push('generic_prompt_echo_rows');
    }
    repaired = true;
  }

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

  legendaBody = ensureCaptionVariants(legendaBody || '', topic, userQuery);

  let hasCtaFinal = rows.some((row) =>
    /cta|call to action|salve|compartilhe|comente|dm|link|seguir/i.test(`${row.time} ${row.visual} ${row.audio}`)
  );
  const qualityScoreBeforeRewrite = evaluateScriptQualityV2(rows, userQuery, hasCtaFinal);
  if (shouldRewriteByQualityV2(qualityScoreBeforeRewrite)) {
    if (SCRIPT_REWRITE_PASS_ENABLED) {
      const rewrittenRows = rewriteRowsWithExecutionPlan(rows, topic, isHumor, executionPlan);
      const rewrittenHasCta = rewrittenRows.some((row) =>
        /cta|call to action|salve|compartilhe|comente|dm|link|seguir/i.test(`${row.time} ${row.visual} ${row.audio}`)
      );
      const rewrittenScore = evaluateScriptQualityV2(rewrittenRows, userQuery, rewrittenHasCta);
      if (shouldRewriteByQualityV2(rewrittenScore)) {
        rows = applyExecutionPlanToRows(topic, isHumor, executionPlan);
        hasCtaFinal = true;
        fallbackLevel = 'static_fallback';
        issues.push('quality_static_fallback');
      } else {
        rows = rewrittenRows;
        hasCtaFinal = rewrittenHasCta;
        if (fallbackLevel === 'none') fallbackLevel = 'rewrite_pass';
        issues.push('quality_rewrite_pass');
      }
    } else {
      rows = applyExecutionPlanToRows(topic, isHumor, executionPlan);
      hasCtaFinal = true;
      fallbackLevel = 'static_fallback';
      issues.push('quality_rewrite');
    }
    repaired = true;
  }
  const finalQualityScore = evaluateScriptQualityV2(rows, userQuery, hasCtaFinal);

  const inspirationHint = hints?.inspiration || null;
  const inspirationPayload = inspirationJson || inspirationHint || null;
  const inspirationSource = (inspirationPayload?.source || hints?.inspirationSource || 'none') as ScriptInspirationSource;
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
    if (inspirationPayload.source) jsonPayload.source = inspirationPayload.source;
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
  const strategicTheme = pickBestTopicCandidate([executionPlan?.primaryIdea, topic]) || topic;
  const engagementBase =
    executionPlan?.evidenceSummary ||
    'Baseado em sinais recentes de engajamento (categorias e conteúdos com maior tração).';
  const evidenceConfidenceLabel = resolveEvidenceConfidenceLabel({
    executionPlan,
    inspirationSource,
    qualityScore: finalQualityScore,
  });
  roteiroLines.push(`**Título Sugerido:** ${title}`);
  roteiroLines.push(`**Pauta Estratégica:** ${strategicTheme}`);
  roteiroLines.push(`**Base de Engajamento:** ${engagementBase}`);
  roteiroLines.push(`**Confiança da Base:** ${evidenceConfidenceLabel}`);
  roteiroLines.push(`**Fonte da Inspiração:** ${resolveInspirationSourceLabel(inspirationSource)}`);
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
      hasCta: hasCtaFinal,
      score: finalQualityScore,
      fallbackSource: inspirationSource,
      fallbackLevel,
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

const toArrayOfStrings = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  const raw = String(value).trim();
  return raw ? [raw] : [];
};

const clampRatio = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const roundRatio = (value: number) => Math.round(clampRatio(value) * 100) / 100;

const objectiveLabel = (value?: string | null) => {
  const normalized = (value || '').toLowerCase();
  if (normalized === 'converter') return 'converter';
  if (normalized === 'viralizar') return 'viralizar';
  if (normalized === 'educar') return 'educar';
  if (normalized === 'autoridade') return 'construir autoridade';
  return 'engajar';
};

const resolveInspirationSourceLabel = (source: ScriptInspirationSource) => {
  if (source === 'community') return 'Comunidade (narrativas similares)';
  if (source === 'user_top_posts') return 'Top posts do criador';
  return 'Sem referência externa (roteiro orientado por sinais do histórico)';
};

const resolveEvidenceConfidenceLabel = (params: {
  executionPlan?: ScriptExecutionPlan | null;
  inspirationSource?: ScriptInspirationSource;
  qualityScore?: ScriptQualityScoreV2 | null;
}): 'Alta' | 'Média' | 'Baixa' => {
  const confidence = params.executionPlan?.evidenceConfidence || 'baixo';
  let score = confidence === 'alto' ? 2 : confidence === 'medio' ? 1 : 0;
  if (params.inspirationSource && params.inspirationSource !== 'none') score += 1;
  if ((params.executionPlan?.contextStrength || 0) >= 3) score += 1;
  if ((params.qualityScore?.semanticEchoRatio || 0) <= 0.1) score += 1;
  if ((params.qualityScore?.actionabilityScore || 0) >= 0.75) score += 1;
  if (score >= 5) return 'Alta';
  if (score >= 3) return 'Média';
  return 'Baixa';
};

const resolveUserNicheTopic = (user: IUser): string => {
  const profileNiches = [
    ...toArrayOfStrings((user as any)?.creatorProfileExtended?.niches),
    ...toArrayOfStrings((user as any)?.creatorProfile?.niches),
    ...toArrayOfStrings((user as any)?.niches),
  ];
  return pickBestTopicCandidate(profileNiches);
};

const buildScriptEvidenceSummary = (params: {
  plannerTheme?: string;
  topCategories?: { proposal?: string[]; context?: string[] };
  topPosts?: Array<{ captionSnippet?: string; stats?: { shares?: number | null; saved?: number | null; comments?: number | null } }>;
}): { summary: string; confidence: 'alto' | 'medio' | 'baixo' } => {
  const { plannerTheme, topCategories, topPosts } = params;
  const parts: string[] = [];
  if (plannerTheme) {
    parts.push(`Tema de pauta com maior aderência: ${plannerTheme}`);
  }
  const proposal = topCategories?.proposal?.[0];
  const context = topCategories?.context?.[0];
  if (proposal || context) {
    parts.push(`Categorias com melhor engajamento: ${[proposal, context].filter(Boolean).join(' + ')}`);
  }
  const firstPost = (topPosts || [])[0];
  const firstCaptionTopic = summarizeRequestTopic(firstPost?.captionSnippet || '');
  if (firstCaptionTopic) {
    parts.push(`Legenda de alto desempenho reforça o tema: ${firstCaptionTopic}`);
  }
  const shares = typeof firstPost?.stats?.shares === 'number' ? firstPost.stats.shares : null;
  const saves = typeof firstPost?.stats?.saved === 'number' ? firstPost.stats.saved : null;
  const comments = typeof firstPost?.stats?.comments === 'number' ? firstPost.stats.comments : null;
  const metricBits = [
    shares !== null ? `${shares} compartilhamentos` : null,
    saves !== null ? `${saves} salvamentos` : null,
    comments !== null ? `${comments} comentários` : null,
  ].filter(Boolean);
  if (metricBits.length) {
    parts.push(`Métricas de referência: ${metricBits.join(' | ')}`);
  }
  if (!parts.length) {
    return {
      summary: 'Sinal inicial baseado no histórico recente; valide com um teste curto antes de escalar.',
      confidence: 'baixo',
    };
  }
  if (parts.length === 1) {
    return {
      summary: `Sinal parcial: ${parts[0]}. Use como hipótese inicial e ajuste após teste.`,
      confidence: 'medio',
    };
  }
  if (parts.length >= 3) {
    return {
      summary: parts.join(' — '),
      confidence: 'alto',
    };
  }
  return {
    summary: parts.join(' — '),
    confidence: 'medio',
  };
};

const buildScriptExecutionPlan = (params: {
  user: IUser;
  queryTopic: string;
  objectiveHint?: string | null;
  toneHint?: string | null;
  topCategories?: {
    proposal?: string[];
    context?: string[];
  };
  plannerSignals?: {
    themes?: string[];
    keyword?: string;
  } | null;
  topPosts?: Array<{
    captionSnippet?: string;
    stats?: { shares?: number | null; saved?: number | null; comments?: number | null };
  }>;
}): ScriptExecutionPlan => {
  const { user, queryTopic, objectiveHint, toneHint, topCategories, plannerSignals, topPosts } = params;
  const sourcePriority: string[] = [];

  const plannerTheme = pickBestTopicCandidate([plannerSignals?.themes?.[0], plannerSignals?.keyword]);
  if (plannerTheme) sourcePriority.push('planner_theme');

  const topPostTopic = pickBestTopicCandidate(
    (topPosts || []).map((post) => summarizeRequestTopic(post.captionSnippet || ''))
  );
  if (topPostTopic) sourcePriority.push('top_post_caption');

  const categoryTopic = pickBestTopicCandidate([
    topCategories?.proposal?.[0] && topCategories?.context?.[0]
      ? `${topCategories.proposal[0]} para ${topCategories.context[0]}`
      : '',
    topCategories?.context?.[0] || '',
    topCategories?.proposal?.[0] || '',
  ]);
  if (categoryTopic) sourcePriority.push('top_categories');

  const nicheTopic = resolveUserNicheTopic(user);
  if (nicheTopic) sourcePriority.push('user_niche');

  const primaryIdea = pickBestTopicCandidate([
    plannerTheme,
    topPostTopic,
    categoryTopic,
    nicheTopic,
    queryTopic,
    'uma dor recorrente do seu nicho',
  ]) || 'uma dor recorrente do seu nicho';

  const objective = objectiveLabel(objectiveHint);
  const isHumor = toneHint === 'humorous';
  const hookAngle = isHumor
    ? `Abrir com situação real de ${primaryIdea}, escalar para conflito e virar com punchline sem ecoar pedido.`
    : objective === 'converter'
      ? `Gancho direto em ${primaryIdea} com promessa de resultado e prova prática em até 20s.`
      : objective === 'viralizar'
        ? `Gancho de quebra de padrão em ${primaryIdea} para maximizar retenção e compartilhamentos.`
        : `Abrir com erro comum em ${primaryIdea} e mostrar ajuste executável em 2 passos.`;

  const ctaAngle = objective === 'converter'
    ? 'Fechar com CTA de ação comercial clara (DM/link/comentário de intenção) sem soar forçado.'
    : objective === 'viralizar'
      ? 'Fechar com CTA de compartilhamento/salvamento para ampliar alcance.'
      : 'Fechar com CTA de comentário e salvamento para reforçar engajamento e recorrência.';

  const evidence = buildScriptEvidenceSummary({
    plannerTheme,
    topCategories,
    topPosts,
  });

  return {
    primaryIdea,
    objective,
    hookAngle,
    ctaAngle,
    evidenceSummary: evidence.summary,
    evidenceConfidence: evidence.confidence,
    sourcePriority: sourcePriority.length ? sourcePriority : ['fallback'],
    contextStrength: sourcePriority.length,
  };
};

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
  const queryTopic = summarizeRequestTopic(query);
  const queryLooksLikeTimingOnlyRequest = /\b(amanh[ãa]|hoje|essa semana|este m[eê]s|pr[oó]ximo post|o que postar)\b/i
    .test((query || '').toLowerCase());
  const isHumor = intent === 'humor_script_request' || /humor|com[eé]dia|engraç|piada|cena c[oô]mica/.test((query || '').toLowerCase());
  const toneHint = isHumor ? 'humorous' : null;
  const communityOptIn = Boolean((user as any)?.communityInspirationOptIn);
  const persistedPreference = (dialogueState as any)?.scriptPreferences?.narrativePreference;
  const narrativePreference =
    narrativePreferenceOverride ||
    (persistedPreference === 'prefer_similar' || persistedPreference === 'prefer_different'
      ? persistedPreference
      : null);

  let topPosts = Array.isArray(answerEngineResult?.topPosts)
    ? answerEngineResult.topPosts.slice(0, 3).map((p: any) => ({
      id: String(p.id || ''),
      captionSnippet: (p.raw?.description || p.description || '').toString().slice(0, 160) || undefined,
      format: (p.raw?.format || p.format) ?? undefined,
      proposal: Array.isArray(p.raw?.proposal) ? p.raw.proposal : undefined,
      context: Array.isArray(p.raw?.context) ? p.raw.context : undefined,
      tone: Array.isArray(p.raw?.tone) ? p.raw.tone : undefined,
      permalink: isInstagramPostUrl(p?.permalink || p?.raw?.postLink) ? String(p.permalink || p.raw?.postLink).trim() : undefined,
      coverUrl: typeof p?.raw?.coverUrl === 'string' ? String(p.raw.coverUrl).trim() : undefined,
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

  if (userId && !topPosts.length) {
    try {
      const topFromHistory = await getTopPostsByMetric(userId, 'shares', 3);
      topPosts = topFromHistory.map((post: any) => ({
        id: String(post?._id || ''),
        captionSnippet: (post?.description || '').toString().slice(0, 160) || undefined,
        format: post?.format || undefined,
        proposal: toArrayOfStrings(post?.proposal),
        context: toArrayOfStrings(post?.context),
        tone: toArrayOfStrings(post?.tone),
        permalink: isInstagramPostUrl(post?.postLink) ? String(post.postLink).trim() : undefined,
        coverUrl: typeof post?.coverUrl === 'string' ? String(post.coverUrl).trim() : undefined,
        stats: {
          shares: typeof post?.stats?.shares === 'number' ? post.stats.shares : null,
          saved: typeof post?.stats?.saved === 'number' ? post.stats.saved : null,
          comments: typeof post?.stats?.comments === 'number' ? post.stats.comments : null,
          likes: typeof post?.stats?.likes === 'number' ? post.stats.likes : null,
          reach: typeof post?.stats?.reach === 'number' ? post.stats.reach : null,
          views: typeof post?.stats?.video_views === 'number' ? post.stats.video_views : null,
          total_interactions: typeof post?.stats?.total_interactions === 'number' ? post.stats.total_interactions : null,
        },
        postDate: post?.postDate ? new Date(post.postDate).toISOString() : null,
      })).filter((post: any) => post.id);
    } catch (error) {
      logger.warn('[ai/chat] failed to hydrate top posts fallback for script context', {
        actor: userId,
        error: (error as Error)?.message || 'unknown',
      });
    }
  }

  let topCategories: any = undefined;
  let plannerSignals: any = undefined;
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

    const shouldHydratePlannerSignals = !hasMeaningfulTopic(queryTopic) || queryLooksLikeTimingOnlyRequest;
    if (shouldHydratePlannerSignals) {
      try {
        const slots = await recommendWeeklySlots({
          userId,
          targetSlotsPerWeek: 3,
          periodDays: 90,
        });
        const bestSlot = Array.isArray(slots) ? slots[0] : null;
        if (bestSlot?.categories && bestSlot.dayOfWeek && bestSlot.blockStartHour) {
          const [themesResult, winningCaptions] = await Promise.all([
            getThemesForSlot(userId, 90, bestSlot.dayOfWeek, bestSlot.blockStartHour, bestSlot.categories),
            getBlockSampleCaptions(
              userId,
              90,
              bestSlot.dayOfWeek,
              bestSlot.blockStartHour,
              {
                contextId: bestSlot.categories.context?.[0],
                proposalId: bestSlot.categories.proposal?.[0],
                referenceId: bestSlot.categories.reference?.[0],
              },
              3
            ),
          ]);
          plannerSignals = {
            dayOfWeek: bestSlot.dayOfWeek,
            blockStartHour: bestSlot.blockStartHour,
            format: bestSlot.format,
            categories: bestSlot.categories,
            keyword: themesResult?.keyword || undefined,
            themes: Array.isArray(themesResult?.themes) ? themesResult.themes.slice(0, 5) : [],
            winningCaptions: Array.isArray(winningCaptions) ? winningCaptions.slice(0, 3) : [],
          };
        }
      } catch (error) {
        logger.warn('[ai/chat] failed to hydrate planner signals for script context', {
          actor: userId,
          error: (error as Error)?.message || 'unknown',
        });
      }
    }
  }

  const executionPlan = buildScriptExecutionPlan({
    user,
    queryTopic,
    objectiveHint,
    toneHint,
    topCategories,
    plannerSignals,
    topPosts,
  });
  const inspirationFallback: ScriptInspirationSource = communityOptIn
    ? 'community'
    : topPosts.length
      ? 'user_top_posts'
      : 'none';

  return {
    objectiveHint,
    toneHint,
    narrativePreference,
    executionPlan,
    inspirationFallback,
    topCategories,
    topPosts,
    communityOptIn,
    plannerSignals,
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

const parsePostDateToDaysAgo = (rawDate?: string | null) => {
  if (!rawDate) return null;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / ONE_DAY_MS));
};

const recencyScore = (rawDate?: string | null) => {
  const daysAgo = parsePostDateToDaysAgo(rawDate);
  if (daysAgo === null) return 0.3;
  if (daysAgo <= 14) return 1;
  if (daysAgo <= 45) return 0.78;
  if (daysAgo <= 90) return 0.6;
  return 0.35;
};

const normalizeScriptScore = (value?: number | null, divisor = 100) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(1, value / divisor);
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
    postDate?: string;
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
  const ranked = inspirations
    .map((inspiration, idx) => {
      const narrative = normalizeScriptScore(inspiration.narrativeScore, 1);
      const performance = normalizeScriptScore(inspiration.performanceScore, 1);
      const personalization = normalizeScriptScore(inspiration.personalizationScore, 1);
      const topicSimilarity = Math.max(
        computeTokenOverlapScore(inspiration.title || '', topic),
        computeTokenOverlapScore(inspiration.description || '', topic)
      );
      const rankScore =
        (topicSimilarity * 0.4) +
        (performance * 0.25) +
        (personalization * 0.18) +
        (narrative * 0.12) +
        (recencyScore(inspiration.postDate) * 0.05) +
        Math.max(0, (0.03 - (idx * 0.01)));
      return { inspiration, rankScore };
    })
    .sort((a, b) => b.rankScore - a.rankScore);
  const selected = ranked.slice(0, 3).map((item) => item.inspiration);
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
  const reason = parts.length >= 3
    ? `Escolhida por ${parts.join(', ')} para sustentar o roteiro sobre "${topic}".`
    : parts.length
      ? `Sinal parcial: ${parts.join(', ')}. Use como hipótese inicial para "${topic}".`
      : `Sinal parcial de narrativa semelhante ao tema "${topic}".`;

  return {
    source: 'community',
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

const buildScriptInspirationFallbackFromTopPosts = (
  topPosts: Array<{
    id: string;
    captionSnippet?: string;
    permalink?: string;
    coverUrl?: string;
    postDate?: string | null;
    stats?: {
      shares?: number | null;
      saved?: number | null;
      comments?: number | null;
      total_interactions?: number | null;
    };
  }>,
  topic: string
): ScriptInspirationHint | null => {
  if (!Array.isArray(topPosts) || !topPosts.length) return null;
  const ranked = topPosts
    .map((post, idx) => {
      const topicSimilarity = computeTokenOverlapScore(post.captionSnippet || '', topic);
      const qualityScore = (
        normalizeScriptScore(post.stats?.shares, 250) * 0.4 +
        normalizeScriptScore(post.stats?.saved, 200) * 0.3 +
        normalizeScriptScore(post.stats?.total_interactions, 1200) * 0.3
      );
      const rankScore =
        (topicSimilarity * 0.45) +
        (qualityScore * 0.4) +
        (recencyScore(post.postDate) * 0.1) +
        Math.max(0, (0.05 - (idx * 0.02)));
      return { post, rankScore };
    })
    .sort((a, b) => b.rankScore - a.rankScore);
  const selected = ranked.slice(0, 3).map((item) => item.post);
  const withRoles = selected.map((post, idx) => ({
    role: inferNarrativeRole(
      {
        description: post.captionSnippet || '',
        matchReasons: [],
      },
      idx
    ),
    post,
  }));

  const first = withRoles[0]?.post;
  if (!first) return null;
  const firstTitle = summarizeRequestTopic(first.captionSnippet || '') || `Post de alto engajamento #1`;
  const firstStats = first.stats || {};
  const scoreBits = [
    typeof firstStats.shares === 'number' ? `${firstStats.shares} compartilhamentos` : null,
    typeof firstStats.saved === 'number' ? `${firstStats.saved} salvamentos` : null,
    typeof firstStats.total_interactions === 'number' ? `${firstStats.total_interactions} interações` : null,
  ].filter(Boolean);
  const reason = scoreBits.length
    ? `Baseado nos seus posts de maior engajamento (${scoreBits.join(' | ')}) para sustentar a narrativa sobre "${topic}".`
    : `Sinal parcial baseado nos seus posts com melhor tração para o tema "${topic}".`;

  return {
    source: 'user_top_posts',
    title: firstTitle,
    postLink: first.permalink || undefined,
    coverUrl: first.coverUrl || undefined,
    reason,
    supportingInspirations: withRoles.map(({ role, post }, idx) => {
      const title = summarizeRequestTopic(post.captionSnippet || '') || `Post de referência #${idx + 1}`;
      return {
        role,
        title,
        postLink: post.permalink || undefined,
        reason: 'Estrutura narrativa validada por desempenho histórico.',
      };
    }),
  };
};

const applyExecutionPlanToRows = (
  topic: string,
  isHumor: boolean,
  plan?: ScriptExecutionPlan | null
): ScriptTableRow[] => {
  const safeTopic = pickBestTopicCandidate([plan?.primaryIdea, topic]) || topic || 'uma dor real do seu nicho';
  return buildSpeakableSceneBlueprint(safeTopic, plan?.objective, isHumor);
};

const rewriteRowsWithExecutionPlan = (
  rows: ScriptTableRow[],
  topic: string,
  isHumor: boolean,
  plan?: ScriptExecutionPlan | null
): ScriptTableRow[] => {
  const safeTopic = pickBestTopicCandidate([plan?.primaryIdea, topic]) || topic || 'uma dor real do seu nicho';
  const stageBlueprint = buildSpeakableSceneBlueprint(safeTopic, plan?.objective, isHumor);

  return rows.map((row, idx) => {
    const fallback =
      stageBlueprint[Math.min(idx, stageBlueprint.length - 1)] ||
      stageBlueprint[0] ||
      {
        time: '00-03s',
        visual: 'Abertura com contexto objetivo do tema.',
        audio: 'Traga um gancho claro e específico para iniciar o roteiro.',
      };
    const visual = isActionableScriptRow(row) && !hasGenericScriptEcho(row.visual, topic)
      ? row.visual
      : fallback.visual;
    const audio = isPracticalCreatorSpeech(row.audio) && !isBrokenPtBr(row.audio) && !hasGenericScriptEcho(row.audio, topic)
      ? row.audio
      : fallback.audio;
    return {
      time: row.time || fallback.time,
      visual: cleanScriptCell(visual),
      audio: cleanScriptCell(audio),
    };
  });
};

const evaluateScriptQualityV2 = (
  rows: ScriptTableRow[],
  userQuery: string,
  hasCta: boolean
): ScriptQualityScoreV2 => {
  if (!rows.length) {
    return {
      semanticEchoRatio: 1,
      speechStrength: 0,
      speakabilityScore: 0,
      instructionalSpeechRatio: 1,
      actionabilityScore: 0,
      languageNaturalnessPtBr: 0,
      specificity: 0,
      ctaPresence: false,
    };
  }
  const echoHits = rows.filter((row) => {
    const combined = `${row.visual} ${row.audio}`.trim();
    if (hasGenericScriptEcho(combined, userQuery)) return true;
    const overlap = computeTokenOverlapScore(combined, userQuery);
    return overlap >= 0.7;
  }).length;
  const strongSpeechHits = rows.filter((row) => !isWeakScriptSpeech(row.audio, userQuery)).length;
  const speakableSpeechHits = rows.filter((row) => isPracticalCreatorSpeech(row.audio)).length;
  const instructionalSpeechHits = rows.filter((row) => hasInstructionalSpeechPattern(row.audio)).length;
  const actionableRows = rows.filter((row) => isActionableScriptRow(row)).length;
  const brokenLanguageRows = rows.filter((row) => isBrokenPtBr(`${row.visual} ${row.audio}`)).length;
  const specificRows = rows.filter((row) => {
    const visual = cleanScriptCell(row.visual || '');
    const audio = cleanScriptCell(row.audio || '');
    if (hasMeaningfulTopic(visual) || hasMeaningfulTopic(audio)) return true;
    return visual.length > 28 && audio.length > 28;
  }).length;

  return {
    semanticEchoRatio: roundRatio(echoHits / rows.length),
    speechStrength: roundRatio(strongSpeechHits / rows.length),
    speakabilityScore: roundRatio(speakableSpeechHits / rows.length),
    instructionalSpeechRatio: roundRatio(instructionalSpeechHits / rows.length),
    actionabilityScore: roundRatio(actionableRows / rows.length),
    languageNaturalnessPtBr: roundRatio(1 - (brokenLanguageRows / rows.length)),
    specificity: roundRatio(specificRows / rows.length),
    ctaPresence: hasCta,
  };
};

const shouldRewriteByQualityV2 = (score: ScriptQualityScoreV2) =>
  score.semanticEchoRatio >= 0.18 ||
  score.speechStrength < 0.75 ||
  score.speakabilityScore < 1 ||
  score.instructionalSpeechRatio > 0 ||
  score.actionabilityScore < 0.65 ||
  score.languageNaturalnessPtBr < 0.72 ||
  score.specificity < 0.55 ||
  !score.ctaPresence;

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
      .replace(/\b(?:para|pra)\s+(?:que\s+)?(?:eu\s+)?(?:possa\s+)?(?:postar|publicar)\b(?:\s+(?:hoje|amanh[ãa]|agora|essa semana|este m[eê]s|semana que vem))?/gi, '')
      .replace(/\b(?:que\s+)?(?:eu\s+)?(?:possa\s+)?(?:postar|publicar)\b(?:\s+(?:hoje|amanh[ãa]|agora|essa semana|este m[eê]s|semana que vem))?/gi, '')
      .replace(/^(?:um|uma|o|a)\s+/i, '')
      .replace(/[?.!,:;]+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!cleaned) continue;
    if (!hasMeaningfulTopic(cleaned)) continue;
    return cleaned.length > 90 ? `${cleaned.slice(0, 90)}…` : cleaned;
  }

  return '';
}

const extractHeadingTopic = (text: string): string => {
  const lines = text
    .split('\n')
    .map((line) => stripMarkdownMarkers(line).trim())
    .filter(Boolean)
    .slice(0, 20);

  for (const line of lines) {
    if (/^\[\/?[A-Z_]+\]$/i.test(line)) continue;
    if (/^\|/.test(line)) continue;
    if (/^v\d+\s*:/i.test(line)) continue;
    const compact = line.replace(/^#{1,6}\s*/, '').trim();
    if (!compact) continue;
    if (/^(formato|dura[çc][aã]o|tempo|visual|fala|legenda|roteiro)\b/i.test(compact)) continue;
    if (hasMeaningfulTopic(compact)) return compact;
  }
  return '';
};

const extractContextTopicHeuristically = (aiResponseText: string, fallbackTopic?: string | null) => {
  const titleMatch = aiResponseText.match(/\*\*T[íi]tulo\s+Sugerido:\*\*\s*([^\n]+)/i);
  const title = normalizeTopicCandidate(titleMatch?.[1] || '');
  if (hasMeaningfulTopic(title)) return title;

  const topicFromText = summarizeRequestTopic(aiResponseText);
  if (hasMeaningfulTopic(topicFromText)) return topicFromText;

  const headingTopic = extractHeadingTopic(aiResponseText);
  if (hasMeaningfulTopic(headingTopic)) return headingTopic;

  const fallback = normalizeTopicCandidate(fallbackTopic || '');
  if (hasMeaningfulTopic(fallback)) return fallback;
  return '';
};

const deriveEntitiesFromTopic = (topic?: string | null) => {
  if (!topic) return [];
  const entities = normalizeTopicText(topic)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 3 && !GENERIC_TOPIC_TOKENS.has(token));
  return Array.from(new Set(entities)).slice(0, 4);
};

const SCRIPT_REFINEMENT_HINT = /\b(curti|gostei|mantenha|mantem|continue|continua|refine|refinar|encurta|encurtar|adapte|adaptar|mude|mudar|troque|trocar|outra linha|vers[aã]o)\b/i;
const SCRIPT_CREATION_HINT = /\b(crie|criar|gere|gerar|monte|montar|fa[cç]a|fazer|escreva|elabore|roteiro|script|o que postar)\b/i;

const extractAudienceFromQuery = (query: string) => {
  const match = (query || '').match(/\b(?:para|pra)\s+([^,.|]{4,80})/i);
  if (!match?.[1]) return '';
  const candidate = normalizeTopicCandidate(match[1]);
  if (!candidate) return '';
  if (/^(o|a|um|uma)\s+/i.test(candidate) && candidate.split(' ').length <= 2) return '';
  return candidate;
};

const extractTimeConstraintFromQuery = (query: string) => {
  const text = (query || '').toLowerCase();
  const relativeMatch = text.match(/\b(hoje|amanh[ãa]|essa semana|este m[eê]s|semana que vem)\b/i);
  if (relativeMatch?.[1]) return relativeMatch[1];
  const durationMatch = text.match(/\b(\d{1,3}\s*(?:s|seg(?:undo)?s?|min(?:uto)?s?))\b/i);
  return durationMatch?.[1] || '';
};

const normalizeScriptBriefTopic = (topic: string) => normalizeTopicCandidate(topic).slice(0, 120).trim();

const isAbstractScriptTopic = (topic: string) => {
  const tokens = tokenizeForScriptSimilarity(topic);
  if (!tokens.length) return true;
  const onlyToken = tokens[0] || '';
  if (tokens.length === 1 && /(tema|conteudo|nicho|video|reels|instagram|roteiro|postar)/i.test(onlyToken)) {
    return true;
  }
  return false;
};

const extractScriptBrief = (
  query: string,
  scriptContext?: EnrichedAIContext['scriptContext'] | null
): ScriptBrief => {
  const trimmedQuery = (query || '').trim();
  const summarizedTopic = summarizeRequestTopic(trimmedQuery);
  const contextTopic = extractTopicFromScriptContext(scriptContext);
  const explicitTopic = normalizeScriptBriefTopic(summarizedTopic);
  const fallbackTopic = normalizeScriptBriefTopic(contextTopic);
  const topic = explicitTopic || fallbackTopic;
  const objective = inferScriptObjective(trimmedQuery) || scriptContext?.executionPlan?.objective || undefined;
  const audience = extractAudienceFromQuery(trimmedQuery) || undefined;
  const timeConstraint = extractTimeConstraintFromQuery(trimmedQuery) || undefined;

  const ambiguityReasons: string[] = [];
  let confidence = 0.15;

  if (!trimmedQuery) {
    ambiguityReasons.push('missing_query');
    return { topic: '', confidence: 0, ambiguityReasons };
  }

  if (explicitTopic && hasMeaningfulTopic(explicitTopic) && !isAbstractScriptTopic(explicitTopic)) {
    confidence += 0.5;
  } else if (fallbackTopic && hasMeaningfulTopic(fallbackTopic)) {
    confidence += 0.28;
    ambiguityReasons.push('topic_inferred_from_history');
  } else {
    ambiguityReasons.push('missing_topic');
  }

  if (objective) confidence += 0.12;
  else ambiguityReasons.push('missing_objective');

  if (audience) confidence += 0.08;
  if (timeConstraint) confidence += 0.05;

  if (SCRIPT_CREATION_HINT.test(trimmedQuery) && !explicitTopic) {
    ambiguityReasons.push('generic_creation_prompt');
  }
  if (/^(?:crie|gere|fa[cç]a|monte)\s+(?:um|uma)?\s*(?:roteiro|script)/i.test(trimmedQuery)) {
    ambiguityReasons.push('broad_script_request');
  }
  if (timeConstraint && !explicitTopic) {
    ambiguityReasons.push('timing_without_theme');
  }
  if (topic && isAbstractScriptTopic(topic)) {
    ambiguityReasons.push('abstract_topic');
  }

  return {
    topic,
    audience,
    objective,
    timeConstraint,
    confidence: roundRatio(Math.max(0, Math.min(confidence, 1))),
    ambiguityReasons: Array.from(new Set(ambiguityReasons)),
    usedContextFallback: Boolean(!explicitTopic && fallbackTopic),
  };
};

const shouldAskScriptClarification = (query: string, brief: ScriptBrief) => {
  if (!query || !query.trim()) return true;
  if (SCRIPT_REFINEMENT_HINT.test(query)) return false;
  if (!SCRIPT_CREATION_HINT.test(query)) return false;
  if (!SCRIPT_BRIEF_V2_ENABLED) return !hasMeaningfulTopic(brief.topic);

  if (!brief.topic) return true;
  if (brief.confidence < 0.62) return true;
  if (brief.ambiguityReasons.includes('generic_creation_prompt')) return true;
  if (brief.ambiguityReasons.includes('broad_script_request') && brief.confidence < 0.7) return true;
  if (brief.ambiguityReasons.includes('timing_without_theme')) return true;
  if (brief.ambiguityReasons.includes('abstract_topic')) return true;
  return false;
};

const buildScriptClarificationMessage = () =>
  [
    '### Falta um detalhe para fechar seu roteiro',
    '> [!IMPORTANT]',
    '> Qual tema específico você quer abordar neste roteiro?',
    '> Se preferir, eu posso usar seu nicho atual e te entregar uma primeira versão agora.',
    '',
    '[BUTTON: Informar tema específico]',
    '[BUTTON: Pode usar meu nicho atual]',
  ].join('\n');

export const __scriptInternals = {
  extractScriptBrief,
  evaluateScriptQualityV2,
  shouldRewriteByQualityV2,
};

const extractTopicFromScriptContext = (scriptContext?: EnrichedAIContext['scriptContext'] | null) => {
  if (!scriptContext) return '';

  const executionIdea = pickBestTopicCandidate([scriptContext.executionPlan?.primaryIdea]);
  if (executionIdea) return executionIdea;

  const plannerTheme = pickBestTopicCandidate(scriptContext.plannerSignals?.themes || []);
  if (plannerTheme) return plannerTheme;

  const plannerKeyword = pickBestTopicCandidate([scriptContext.plannerSignals?.keyword]);
  if (plannerKeyword) return plannerKeyword;

  const proposal = humanizeCategoryToken(scriptContext.topCategories?.proposal?.[0]);
  const context = humanizeCategoryToken(scriptContext.topCategories?.context?.[0]);
  const categoryTopic = pickBestTopicCandidate([
    proposal && context ? `${proposal} para ${context}` : '',
    context,
    proposal,
  ]);
  if (categoryTopic) return categoryTopic;

  const topCaptionTopic = pickBestTopicCandidate(
    (scriptContext.topPosts || []).map((post) => summarizeRequestTopic(post.captionSnippet || ''))
  );
  return topCaptionTopic || '';
};

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
  const heuristicTopic = extractContextTopicHeuristically(trimmed);
  const heuristicEntities = deriveEntitiesFromTopic(heuristicTopic);

  if (!trimmed || trimmed.length < 10) {
    return { topic: heuristicTopic || undefined, entities: heuristicEntities, timestamp: Date.now(), wasQuestion };
  }

  if (trimmed.length < CONTEXT_EXTRACTION_MIN_LEN_FOR_AI) {
    return { topic: heuristicTopic || undefined, entities: heuristicEntities, timestamp: Date.now(), wasQuestion };
  }

  if (heuristicTopic && heuristicEntities.length >= 2) {
    return { topic: heuristicTopic, entities: heuristicEntities, timestamp: Date.now(), wasQuestion };
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
    const extraction = await callOpenAIForQuestion(prompt, { max_tokens: 64, temperature: 0.1 });
    const jsonMatch = extraction?.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch?.[0] ? JSON.parse(jsonMatch[0]) : null;
    const extractedTopic = parsed && typeof parsed.topic === 'string' && parsed.topic.trim() ? parsed.topic.trim() : '';
    const topic = hasMeaningfulTopic(extractedTopic) ? extractedTopic : heuristicTopic || undefined;
    const entities = parsed && Array.isArray(parsed.entities)
      ? parsed.entities.map((e: any) => String(e).trim()).filter(Boolean).slice(0, 4)
      : heuristicEntities;
    return { topic, entities, timestamp: Date.now(), wasQuestion };
  } catch (error) {
    logger.error(`[ai/chat] extractContextFromAIResponse failed for user ${userId}:`, error);
    return { topic: heuristicTopic || undefined, entities: heuristicEntities, timestamp: Date.now(), wasQuestion };
  }
}

async function generateInstigatingQuestion(aiResponseText: string, dialogueState: any, userId: string) {
  if (!AI_INSTIGATING_QUESTION_ENABLED) return null;
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

    let brandRiskV1Enabled = true;
    let calibrationV1Enabled = true;
    try {
      [brandRiskV1Enabled, calibrationV1Enabled] = await Promise.all([
        isPricingBrandRiskV1Enabled(),
        isPricingCalibrationV1Enabled(),
      ]);
    } catch (error) {
      logger.warn("[ai/chat] feature flag fallback for pricing calculator", error);
    }
    const pricingParse = parseChatPricingInput(truncatedQuery, { brandRiskEnabled: brandRiskV1Enabled });
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
            brandRiskEnabled: brandRiskV1Enabled,
            calibrationEnabled: calibrationV1Enabled,
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
    const scriptContextTopicHint = isScriptMode
      ? pickBestTopicCandidate([summarizeRequestTopic(truncatedQuery), extractTopicFromScriptContext(scriptContext)])
      : '';
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
      postDate?: string;
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
          const postDate = (() => {
            if (!insp?.postDate) return undefined;
            const parsedDate = new Date(insp.postDate);
            if (Number.isNaN(parsedDate.getTime())) return undefined;
            return parsedDate.toISOString();
          })();
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
            postDate,
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
    const pushAllowed = (url?: string | null, verified?: boolean) => {
      const normalized = normalizeInstagramUrl(url || undefined);
      if (!normalized) return;
      if (verified === false) return;
      allowedLinks.add(normalized);
    };
    if (answerEvidence) {
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
    if (isScriptMode && Array.isArray(scriptContext?.topPosts)) {
      scriptContext.topPosts.forEach((post) => {
        pushAllowed((post as any)?.permalink, true);
      });
    }
    sanitizedResponse = sanitizeInstagramLinks(sanitizedResponse, allowedLinks);
    let scriptContractTelemetry: {
      repaired: boolean;
      issues: string[];
      quality: ScriptContractQuality;
    } | null = null;
    if (isScriptMode) {
      const scriptBrief = extractScriptBrief(truncatedQuery, scriptContext);
      const scriptTopicFromQuery = summarizeRequestTopic(truncatedQuery);
      const scriptTopicFromContext = extractTopicFromScriptContext(scriptContext);
      const resolvedScriptTopic = pickBestTopicCandidate([scriptBrief.topic, scriptTopicFromQuery, scriptTopicFromContext]);
      const shouldClarify = SCRIPT_ALWAYS_GENERATE
        ? (!truncatedQuery.trim() || shouldAskScriptClarification(truncatedQuery, scriptBrief))
        : shouldAskScriptClarification(truncatedQuery, scriptBrief);

      if (shouldClarify) {
        sanitizedResponse = buildScriptClarificationMessage();
        logger.info('[ai/chat] script_clarification_required', {
          actor: actorId,
          target: access.targetUserId,
          query: summarizeRequestTopic(truncatedQuery),
          brief: scriptBrief,
        });
      } else {
        if (!hasMeaningfulTopic(scriptTopicFromQuery) && hasMeaningfulTopic(scriptTopicFromContext)) {
          logger.info('[ai/chat] script_topic_autofilled_from_history', {
            actor: actorId,
            target: access.targetUserId,
            topic: scriptTopicFromContext,
          });
        }
        const scriptInspirationHint = buildScriptInspirationHint(
          communityInspirations,
          communityMeta,
          resolvedScriptTopic || 'seu tema'
        );
        const scriptInspirationFallback = (!scriptInspirationHint && SCRIPT_TOP_POST_INSPIRATION_FALLBACK)
          ? buildScriptInspirationFallbackFromTopPosts(
            scriptContext?.topPosts || [],
            resolvedScriptTopic || scriptContext?.executionPlan?.primaryIdea || 'seu tema'
          )
          : null;
        const finalInspirationHint = scriptInspirationHint || scriptInspirationFallback || null;
        const fallbackSource = (finalInspirationHint?.source ||
          scriptContext?.inspirationFallback ||
          'none') as ScriptInspirationSource;
        const scriptContract = enforceScriptContract(sanitizedResponse, truncatedQuery, {
          inspiration: finalInspirationHint,
          topic: resolvedScriptTopic,
          plannerThemes: scriptContext?.plannerSignals?.themes || [],
          isHumor: effectiveIntent === 'humor_script_request' || scriptContext?.toneHint === 'humorous',
          executionPlan: scriptContext?.executionPlan || null,
          inspirationSource: fallbackSource,
        });
        sanitizedResponse = scriptContract.normalized;
        scriptContractTelemetry = {
          repaired: scriptContract.repaired,
          issues: scriptContract.issues,
          quality: scriptContract.quality,
        };
        if (scriptContract.repaired) {
          logger.info('[ai/chat] script_contract_repaired', {
            issues: scriptContract.issues,
            quality: scriptContract.quality,
            actor: actorId,
            target: access.targetUserId,
          });
        }
        logger.info('[ai/chat] script_quality_score', {
          actor: actorId,
          target: access.targetUserId,
          score: scriptContract.quality.score || null,
          fallback_source: scriptContract.quality.fallbackSource || fallbackSource,
          fallback_level: scriptContract.quality.fallbackLevel || 'none',
          context_strength: scriptContext?.executionPlan?.contextStrength ?? null,
        });
        if ((scriptContract.quality.score?.semanticEchoRatio || 0) > 0) {
          logger.info('[ai/chat] echo_detected', {
            actor: actorId,
            target: access.targetUserId,
            echo_ratio: scriptContract.quality.score?.semanticEchoRatio || 0,
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
          fallback_source: scriptContract.quality.fallbackSource || fallbackSource,
          fallback_level: scriptContract.quality.fallbackLevel || 'none',
          context_strength: scriptContext?.executionPlan?.contextStrength ?? null,
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
        scriptRepaired: scriptContractTelemetry?.repaired ?? null,
        scriptRepairIssues: scriptContractTelemetry?.issues || null,
        scriptQualityScoreV2: scriptContractTelemetry?.quality?.score || null,
        scriptFallbackLevel: scriptContractTelemetry?.quality?.fallbackLevel || 'none',
        scriptInstructionalSpeechRatio: scriptContractTelemetry?.quality?.score?.instructionalSpeechRatio ?? null,
        scriptSpeakabilityScore: scriptContractTelemetry?.quality?.score?.speakabilityScore ?? null,
      });

      const extractedContext = isScriptMode
        ? {
            topic:
              scriptContextTopicHint ||
              extractContextTopicHeuristically(sanitizedResponse) ||
              undefined,
            entities: deriveEntitiesFromTopic(
              scriptContextTopicHint || extractContextTopicHeuristically(sanitizedResponse)
            ),
            timestamp: Date.now(),
            wasQuestion: sanitizedResponse.trim().endsWith('?'),
          }
        : await extractContextFromAIResponse(sanitizedResponse, access.targetUserId);
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
