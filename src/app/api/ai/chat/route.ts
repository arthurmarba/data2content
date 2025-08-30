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
    // 1) Sessão e segurança: userId exclusivamente da sessão
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as (NonNullable<Session['user']> & { id?: string; name?: string | null; instagramConnected?: boolean }) | undefined;
    const userId = sessionUser?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // 2) Rate limiting (tolerante quando Redis não está disponível)
    try {
      const { allowed } = await checkRateLimit(`chat:${userId}`, 30, 3600); // 30 req/hora
      if (!allowed) {
        return NextResponse.json({ error: 'Muitas requisições. Tente novamente em breve.' }, { status: 429 });
      }
    } catch {
      // Em caso de erro no rate-limit, segue sem bloquear
    }

    // 3) Lê body para obter apenas a query
    const { query } = (await request.json()) || {};
    if (!query || !String(query).trim()) {
      return NextResponse.json({ error: 'Falta query (pergunta do usuário)' }, { status: 400 });
    }

    const isIgConnected = Boolean(sessionUser?.instagramConnected);

    // 4) Bifurcação: Genérico vs. Contextual
    if (!isIgConnected) {
      // MODO GENÉRICO — Resposta baseada em conhecimento geral + CTA no servidor
      const genericPrompt = `
Você é Mobi, um consultor de IA prático para criadores de conteúdo.
Responda de forma direta, útil e aplicável a qualquer criador (sem dados pessoais).
Evite suposições sobre métricas específicas do usuário. Foque em boas práticas, táticas e estruturas.
Pergunta: "${String(query)}"`;

      const answerRaw = await callOpenAIForQuestion(genericPrompt);
      const inviteText = 'Conecte seu Instagram para ter respostas contextuais com suas métricas e desbloquear seu Mídia Kit gratuito.';
      const answer = `${answerRaw?.trim() || ''}\n\n${inviteText}`.trim();
      // Mantém label compatível com o texto exibido no ChatPanel
      const cta = { label: 'Contextualizar com minhas métricas do Instagram', action: 'connect_instagram' as const };

      // Salva histórico básico (user + assistant) — tolerante a falhas do Redis
      try {
        const prev = await stateService.getConversationHistory(userId).catch(() => []);
        const updated: ChatCompletionMessageParam[] = [
          ...prev,
          { role: 'user', content: String(query) } as ChatCompletionUserMessageParam,
          { role: 'assistant', content: answer } as ChatCompletionAssistantMessageParam,
        ].slice(-20);
        await stateService.setConversationHistory(userId, updated);
        await stateService.updateDialogueState(userId, { lastInteraction: Date.now() });
        // resumo periódico
        try {
          const dstate = await stateService.getDialogueState(userId).catch(() => ({ summaryTurnCounter: 0 } as any));
          const counter = (dstate?.summaryTurnCounter ?? 0) + 1;
          if (counter >= 6) {
            const summary = await generateConversationSummary(updated, sessionUser?.name || 'usuário');
            await stateService.updateDialogueState(userId, { conversationSummary: summary || dstate?.conversationSummary, summaryTurnCounter: 0 });
          } else {
            await stateService.updateDialogueState(userId, { summaryTurnCounter: counter });
          }
        } catch {}
      } catch {}
      return NextResponse.json({ answer, cta }, { status: 200 });
    }

    // MODO CONTEXTUAL — Usa orchestrator com contexto do usuário e bufferiza o stream
    await connectToDatabase();
    const user = await UserModel.findById(userId).lean<IUser | null>();
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // carrega histórico e envia para o orchestrator (tolerante a falhas)
    let historyMessages: ChatCompletionMessageParam[] = [];
    try {
      historyMessages = (await stateService.getConversationHistory(userId)).slice(-6);
    } catch {}

    // carrega estado do diálogo (para fornecer resumo ao orchestrator)
    let dialogueState: any = undefined;
    try {
      dialogueState = await stateService.getDialogueState(userId);
    } catch {}

    const enriched: EnrichedAIContext = {
      user,
      historyMessages,
      userName: sessionUser?.name || user.name || 'usuário',
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

    // persiste histórico com a resposta contextual (tolerante)
    try {
      const prev = Array.isArray(historyMessages) ? historyMessages : [];
      const updated: ChatCompletionMessageParam[] = [
        ...prev,
        { role: 'user', content: String(query) } as ChatCompletionUserMessageParam,
        { role: 'assistant', content: finalText } as ChatCompletionAssistantMessageParam,
      ].slice(-20);
      await stateService.setConversationHistory(userId, updated);
      await stateService.updateDialogueState(userId, { lastInteraction: Date.now() });
      // resumo periódico
      try {
        const dstate = await stateService.getDialogueState(userId).catch(() => ({ summaryTurnCounter: 0 } as any));
        const counter = (dstate?.summaryTurnCounter ?? 0) + 1;
        if (counter >= 6) {
          const summary = await generateConversationSummary(updated, sessionUser?.name || 'usuário');
          await stateService.updateDialogueState(userId, { conversationSummary: summary || dstate?.conversationSummary, summaryTurnCounter: 0 });
        } else {
          await stateService.updateDialogueState(userId, { summaryTurnCounter: counter });
        }
      } catch {}
    } catch {}

    // 5) Anexa CTA de upsell quando IG está conectado mas plano não é PRO (active-like)
    let cta: { label: string; action: 'go_to_billing' } | undefined;
    try {
      const planFromSession = normalizePlanStatus((sessionUser as any)?.planStatus);
      const planFromDb = normalizePlanStatus((user as any)?.planStatus);
      const effectivePlan = planFromSession || planFromDb;
      if (!isActiveLike(effectivePlan)) {
        cta = {
          label: 'Seja PRO e receba alertas diários via WhatsApp',
          action: 'go_to_billing',
        };
      }
    } catch {}

    return NextResponse.json({ answer: finalText, cta }, { status: 200 });
  } catch (error: unknown) {
    console.error("POST /api/ai/chat error:", error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
