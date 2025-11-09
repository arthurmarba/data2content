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
import { isActiveLike, normalizePlanStatus } from '@/app/lib/planGuard';
import { evaluateUserAccess } from '@/utils/authz';
import { logger } from '@/app/lib/logger';

// Garante que essa rota use Node.js em vez de Edge (importante para Mongoose).
export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

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

    if (!isTargetIgConnected) {
      const genericPrompt = `
Você é Mobi, um consultor de IA prático para criadores de conteúdo.
Responda de forma direta, útil e aplicável a qualquer criador (sem dados pessoais).
Evite suposições sobre métricas específicas do usuário. Foque em boas práticas, táticas e estruturas.
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
        const prev = await stateService.getConversationHistory(conversationKey).catch(() => []);
        const updated: ChatCompletionMessageParam[] = [
          ...prev,
          { role: 'user', content: String(query) } as ChatCompletionUserMessageParam,
          { role: 'assistant', content: answer } as ChatCompletionAssistantMessageParam,
        ].slice(-20);
        await stateService.setConversationHistory(conversationKey, updated);
        await stateService.updateDialogueState(conversationKey, { lastInteraction: Date.now() });
        try {
          const dstate = await stateService.getDialogueState(conversationKey).catch(() => ({ summaryTurnCounter: 0 } as any));
          const counter = (dstate?.summaryTurnCounter ?? 0) + 1;
          if (counter >= 6) {
            const summary = await generateConversationSummary(updated, targetDisplayName);
            await stateService.updateDialogueState(conversationKey, { conversationSummary: summary || dstate?.conversationSummary, summaryTurnCounter: 0 });
          } else {
            await stateService.updateDialogueState(conversationKey, { summaryTurnCounter: counter });
          }
        } catch {}
      } catch {}

      return NextResponse.json({ answer, cta }, { status: 200 });
    }

    let historyMessages: ChatCompletionMessageParam[] = [];
    try {
      historyMessages = (await stateService.getConversationHistory(conversationKey)).slice(-6);
    } catch {}

    let dialogueState: any = undefined;
    try {
      dialogueState = await stateService.getDialogueState(conversationKey);
    } catch {}

    const enriched: EnrichedAIContext = {
      user: targetUser,
      historyMessages,
      userName: targetDisplayName,
      dialogueState,
    };

    const { stream } = await askLLMWithEnrichedContext(enriched, String(query), 'general');
    const reader = stream.getReader();
    let finalText = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (typeof value === 'string') finalText += value;
    }

    try {
      const prev = Array.isArray(historyMessages) ? historyMessages : [];
      const updated: ChatCompletionMessageParam[] = [
        ...prev,
        { role: 'user', content: String(query) } as ChatCompletionUserMessageParam,
        { role: 'assistant', content: finalText } as ChatCompletionAssistantMessageParam,
      ].slice(-20);
      await stateService.setConversationHistory(conversationKey, updated);
      await stateService.updateDialogueState(conversationKey, { lastInteraction: Date.now() });
      try {
        const dstate = await stateService.getDialogueState(conversationKey).catch(() => ({ summaryTurnCounter: 0 } as any));
        const counter = (dstate?.summaryTurnCounter ?? 0) + 1;
        if (counter >= 6) {
          const summary = await generateConversationSummary(updated, targetDisplayName);
          await stateService.updateDialogueState(conversationKey, { conversationSummary: summary || dstate?.conversationSummary, summaryTurnCounter: 0 });
        } else {
          await stateService.updateDialogueState(conversationKey, { summaryTurnCounter: counter });
        }
      } catch {}
    } catch {}

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
      } catch {}
    }

    return NextResponse.json({ answer: finalText, cta }, { status: 200 });
  } catch (error: unknown) {
    console.error("POST /api/ai/chat error:", error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
