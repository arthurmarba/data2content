import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import UserModel, { IUser } from "@/app/models/User";
import { callOpenAIForQuestion, generateConversationSummary } from "@/app/lib/aiService";
import { askLLMWithEnrichedContext, buildSurveyProfileSnippet } from "@/app/lib/aiOrchestrator";
import type { EnrichedAIContext } from "@/app/api/whatsapp/process-response/types";
import type {
  ChatCompletionMessageParam,
  ChatCompletionUserMessageParam,
  ChatCompletionAssistantMessageParam,
} from 'openai/resources/chat/completions';
import { checkRateLimit } from "@/utils/rateLimit";
import * as stateService from '@/app/lib/stateService';
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

// Garante que essa rota use Node.js em vez de Edge (importante para Mongoose).
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const HISTORY_LIMIT_SAFE = HISTORY_LIMIT || 10;
const SUMMARY_INTERVAL_SAFE = SUMMARY_GENERATION_INTERVAL || 6;

const MAX_AI_EXCERPT = 1500;
const MAX_QUERY_CHARS = 4000;
const HARMFUL_PATTERNS = [/su[ií]c[ií]dio/i, /\bme matar\b/i, /\bmatar algu[eé]m\b/i, /aut[oô]mutila/i];
const ANSWER_ENGINE_ENABLED = process.env.ANSWER_ENGINE_ENABLED !== 'false';

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

function buildSurveyContextNote(profile: any) {
  if (!profile) return null;
  const parts: string[] = [];
  if (Array.isArray(profile.stage) && profile.stage.length) parts.push(`etapa: ${profile.stage[0]}`);
  if (profile.mainGoal3m) parts.push(`meta 3m: ${profile.mainGoal3m}`);
  if (Array.isArray(profile.niches) && profile.niches.length) parts.push(`nicho: ${profile.niches[0]}`);
  if (Array.isArray(profile.mainPlatformReasons) && profile.mainPlatformReasons.length) parts.push(`motivo: ${profile.mainPlatformReasons[0]}`);
  if (!parts.length) return null;
  return parts.join(' | ');
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
    const session = await getServerSession(authOptions);
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
          const blockedMsg = `Olá ${firstName}! Seu plano está ${effectivePlan || 'inativo'}. Para continuar usando o Mobi, reative o Plano Agência.`;
          ctaForPlan = { label: 'Reativar Plano Agência', action: 'go_to_billing' };
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

    let answerEngineResult: any = null;
    let answerEngineDuration = 0;
    if (ANSWER_ENGINE_ENABLED) {
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
    };

    let finalText = '';
    let userMessageId: string | null = null;
    let assistantMessageId: string | null = null;
    try {
      const llmStartedAt = Date.now();
      const { stream } = await askLLMWithEnrichedContext(enriched, truncatedQuery.trim(), effectiveIntent);
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

    if (!finalText.trim()) {
      finalText = 'Hum... não consegui gerar uma resposta completa agora. Pode tentar reformular ou perguntar novamente?';
    }

    const instigatingQuestion = await generateInstigatingQuestion(finalText, dialogueState, access.targetUserId);
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
    const answerEvidence = answerEngineResult
      ? {
          version: 'v1',
          intent: answerEngineResult.intent,
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
          topPosts: answerEngineResult.topPosts.slice(0, 8).map((p: any) => ({
            id: p.id,
            permalink: p.permalink,
            format: p.format,
            tags: p.tags,
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
          })),
          relaxApplied: answerEngineResult.telemetry?.relaxApplied,
        }
      : null;
    const surveyNudgeNeeded = !access.isAdmin && (surveyFreshness.isStale || surveyFreshness.missingCore.length > 0);
    const surveyNudgeText = surveyNudgeNeeded
      ? `Para personalizar com o que você preencheu na pesquisa, confirme seu ${surveyFreshness.missingCore.join('/') || 'perfil'} rapidinho (leva 2 min).`
      : null;
    const surveyContextNote = (!surveyNudgeNeeded && buildSurveyContextNote(surveyProfile)) || null;
    if (surveyNudgeText) {
      sanitizedResponse = `${sanitizedResponse}\n\n> [!IMPORTANT]\n> ${surveyNudgeText}`;
    } else if (surveyContextNote && effectiveIntent !== 'ask_community_inspiration') {
      sanitizedResponse = `${sanitizedResponse}\n\n> [!NOTE]\n> Contexto aplicado (pesquisa): ${surveyContextNote}`;
    }
    const pendingActionInfo = aiResponseSuggestsPendingAction(sanitizedResponse);
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

      // Auto-generate title if this is the start of a conversation
      if (threadId && historyMessages.length === 0) {
        // Fire and forget
        stateService.generateThreadTitle(threadId, truncatedQuery);
      }
      if (surveyNudgeNeeded) {
        dialogueUpdate.lastAIQuestionType = 'survey_update_request';
        dialogueUpdate.pendingActionContext = { missingFields: surveyFreshness.missingCore, stale: surveyFreshness.isStale };
      } else if (pendingActionInfo.suggests) {
        dialogueUpdate.lastAIQuestionType = pendingActionInfo.actionType;
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
            label: 'Entre no Plano Agência e receba alertas diários via WhatsApp',
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
      answerEvidence,
    }, { status: 200 });
  } catch (error: unknown) {
    console.error("POST /api/ai/chat error:", error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
