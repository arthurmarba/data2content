import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import UserModel, { IUser } from "@/app/models/User";
import { callOpenAIForQuestion, generateConversationSummary } from "@/app/lib/aiService";
import { askLLMWithEnrichedContext } from "@/app/lib/aiOrchestrator";
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

// Garante que essa rota use Node.js em vez de Edge (importante para Mongoose).
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const HISTORY_LIMIT_SAFE = HISTORY_LIMIT || 10;
const SUMMARY_INTERVAL_SAFE = SUMMARY_GENERATION_INTERVAL || 6;

const MAX_AI_EXCERPT = 1500;

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
    const requestedTargetId = typeof body?.targetUserId === 'string' ? String(body.targetUserId).trim() : undefined;
    if (!query || !String(query).trim()) {
      return NextResponse.json({ error: 'Falta query (pergunta do usuário)' }, { status: 400 });
    }

    const access = evaluateUserAccess(sessionUser, requestedTargetId);
    if (!access.allowed) {
      const status = access.reason === 'unauthenticated' ? 401 : 403;
      return NextResponse.json({ error: status === 401 ? 'Não autenticado' : 'Acesso negado' }, { status });
    }

    if (access.isAdmin && access.targetUserId !== actorId) {
      logger.info(`[ai/chat] admin ${actorId} consultando métricas de usuário ${access.targetUserId}`);
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

    const targetDisplayName = targetUser.name || 'criador';
    const conversationKey = access.isAdmin ? `${actorId}:${access.targetUserId}` : access.targetUserId;
    const isTargetIgConnected = Boolean(targetUser.isInstagramConnected || targetUser.instagramAccountId);
    const firstName = targetDisplayName.split(' ')[0] || 'criador';
    const greeting = `Olá, ${firstName}`;
    const normalizedQuery = normalizeText(String(query));

    let historyMessages: ChatCompletionMessageParam[] = [];
    try {
      historyMessages = (await stateService.getConversationHistory(conversationKey)).slice(-HISTORY_LIMIT_SAFE);
    } catch { }

    let dialogueState: any = { summaryTurnCounter: 0 };
    try {
      dialogueState = await stateService.getDialogueState(conversationKey);
    } catch { }

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
            { role: 'user', content: String(query) } as ChatCompletionUserMessageParam,
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
      const genericPrompt = `
Você é Mobi, um consultor de IA prático para criadores de conteúdo.
Responda de forma direta, útil e aplicável a qualquer criador (sem dados pessoais).
Evite suposições sobre métricas específicas do usuário. Foque em boas práticas, táticas e estruturas.
Use formatação rica (negrito, listas, tópicos) para tornar a resposta didática e fácil de ler.
Pergunta: "${String(query)}"`;

      const answerRaw = await callOpenAIForQuestion(genericPrompt);
      const inviteText = access.isAdmin
        ? 'Este perfil ainda não possui dados conectados; resposta baseada em práticas gerais.'
        : 'Conecte seu Instagram para ter respostas contextuais com suas métricas e desbloquear seu Mídia Kit gratuito.';
      const answer = `${answerRaw?.trim() || ''}\n\n${inviteText}`.trim();

      const cta = access.isAdmin
        ? undefined
        : { label: 'Contextualizar com minhas métricas do Instagram', action: 'connect_instagram' as const };

      try {
        const updated: ChatCompletionMessageParam[] = [
          ...historyMessages,
          { role: 'user', content: String(query) } as ChatCompletionUserMessageParam,
          { role: 'assistant', content: answer } as ChatCompletionAssistantMessageParam,
        ].slice(-HISTORY_LIMIT_SAFE);
        await stateService.setConversationHistory(conversationKey, updated);
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

      return NextResponse.json({ answer, cta }, { status: 200 });
    }

    let intentResult: any = null;
    let effectiveIntent: any = 'general';
    let pendingActionContextFromIntent: any = null;
    let currentTaskPayload: { name: string; objective?: string } | null = null;

    try {
      intentResult = await determineIntent(normalizedQuery, targetUser, String(query), dialogueState || {}, greeting, access.targetUserId);
      if (intentResult?.type === 'special_handled') {
        const specialAnswer = intentResult.response;
        const updated: ChatCompletionMessageParam[] = [
          ...historyMessages,
          { role: 'user', content: String(query) } as ChatCompletionUserMessageParam,
          { role: 'assistant', content: specialAnswer } as ChatCompletionAssistantMessageParam,
        ].slice(-HISTORY_LIMIT_SAFE);
        await stateService.setConversationHistory(conversationKey, updated);
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
        return NextResponse.json({ answer: specialAnswer }, { status: 200 });
      }
      if (intentResult?.type === 'intent_determined') {
        effectiveIntent = intentResult.intent || 'general';
        pendingActionContextFromIntent = intentResult.pendingActionContext;
        if (COMPLEX_TASK_INTENTS.includes(effectiveIntent as any)) {
          const objective =
            effectiveIntent === 'content_plan'
              ? `Criar plano de conteúdo baseado em "${String(query).slice(0, 80)}"...`
              : `Processar intenção: ${effectiveIntent}`;
          currentTaskPayload = { name: effectiveIntent, objective };
        }
      }
    } catch (error) {
      logger.error('[ai/chat] determineIntent failed:', error);
    }

    const enriched: EnrichedAIContext = {
      user: targetUser,
      historyMessages,
      userName: targetDisplayName,
      dialogueState,
      channel: 'web',
    };

    let finalText = '';
    try {
      const { stream } = await askLLMWithEnrichedContext(enriched, String(query).trim(), effectiveIntent);
      const reader = stream.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (typeof value === 'string') finalText += value;
      }
    } catch (error) {
      logger.error('[ai/chat] Falha na chamada da LLM (web chat):', error);
      finalText = 'Tive um problema técnico para gerar a resposta agora. Pode tentar novamente em instantes?';
    }

    if (!finalText.trim()) {
      finalText = 'Hum... não consegui gerar uma resposta completa agora. Pode tentar reformular ou perguntar novamente?';
    }

    const instigatingQuestion = await generateInstigatingQuestion(finalText, dialogueState, access.targetUserId);
    const fullResponse = instigatingQuestion ? `${finalText.trim()}\n\n${instigatingQuestion}` : finalText.trim();
    const sanitizedResponse = sanitizeTables(fullResponse);
    const pendingActionInfo = aiResponseSuggestsPendingAction(sanitizedResponse);

    try {
      const updated: ChatCompletionMessageParam[] = [
        ...historyMessages,
        { role: 'user', content: String(query) } as ChatCompletionUserMessageParam,
        { role: 'assistant', content: sanitizedResponse } as ChatCompletionAssistantMessageParam,
      ].slice(-HISTORY_LIMIT_SAFE);
      await stateService.setConversationHistory(conversationKey, updated);

      const extractedContext = await extractContextFromAIResponse(sanitizedResponse, access.targetUserId);
      const counter = (dialogueState?.summaryTurnCounter ?? 0) + 1;
      const dialogueUpdate: Partial<IDialogueState> = {
        lastInteraction: Date.now(),
        lastResponseContext: extractedContext,
        summaryTurnCounter: counter,
      };
      if (pendingActionInfo.suggests) {
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
      if (counter >= SUMMARY_INTERVAL_SAFE) {
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

    const pendingActionPayload = pendingActionInfo.suggests
      ? { type: pendingActionInfo.actionType, context: pendingActionInfo.pendingActionContext }
      : null;

    const currentTaskResponse = currentTaskPayload || (COMPLEX_TASK_INTENTS.includes(effectiveIntent as any) ? dialogueState?.currentTask ?? null : null);

    return NextResponse.json({ answer: sanitizedResponse, cta, pendingAction: pendingActionPayload, currentTask: currentTaskResponse }, { status: 200 });
  } catch (error: unknown) {
    console.error("POST /api/ai/chat error:", error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
