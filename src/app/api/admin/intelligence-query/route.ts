/**
 * @fileoverview Endpoint da API para a Central de Inteligência.
 * @version 5.0.0
 * @description
 * ## Principais Melhorias na Versão 5.0.0:
 * - **Compatibilidade Modular:** Atualizadas as importações para utilizar a nova
 * estrutura modular (orchestrator, types).
 * - **Schema Simplificado:** A validação de mensagens foi simplificada, pois
 * o cliente agora envia apenas os papéis 'user' e 'assistant'.
 * - **Robustez:** Mantida a validação de schema com Zod e o tratamento
 * de erros estruturado.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// --- Importações da Nova Arquitetura Modular ---
import { logger } from '@/app/lib/logger';
import { askAdminLLM } from '@/app/lib/admin-ai/orchestrator';
import { AdminAIContext } from '@/app/lib/admin-ai/types';

const SERVICE_TAG = '[api/admin/intelligence-query v5.0.0]';

// ============================================================================
// --- Validação de Schema com Zod ---
// ============================================================================

// O cliente só enviará mensagens de 'user' e 'assistant'.
// As roles 'system' e 'tool' são gerenciadas no backend.
const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const requestBodySchema = z.object({
  messages: z.array(messageSchema).min(1, 'A lista de mensagens não pode estar vazia.'),
});

type ClientMessage = z.infer<typeof messageSchema>;

// ============================================================================
// --- Funções Helper ---
// ============================================================================

function apiError(message: string, status: number): NextResponse {
  logger.warn(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

// Mapeia as mensagens do cliente para o formato esperado pela OpenAI.
function mapToOpenAIMessages(messages: ClientMessage[]): ChatCompletionMessageParam[] {
    return messages.map((msg): ChatCompletionMessageParam => {
        return { role: msg.role, content: msg.content };
    });
}

// ============================================================================
// --- Handler da API (POST) ---
// ============================================================================

export async function POST(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[POST]`;
  logger.info(`${TAG} Requisição recebida.`);

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return apiError('Acesso não autorizado.', 401);
    }

    const body = await req.json();
    const validationResult = requestBodySchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return apiError(`Corpo da requisição inválido: ${errorMessage}`, 400);
    }

    const { messages } = validationResult.data;
    const lastMessage = messages[messages.length - 1];
    
    if (!lastMessage || lastMessage.role !== 'user') {
        return apiError('A última mensagem da conversa deve ser do tipo "user".', 400);
    }

    const userQuery = lastMessage.content;
    const history = messages.slice(0, -1);
    const openAIHistory = mapToOpenAIMessages(history);

    const adminContext: AdminAIContext = {
      adminName: session.user.name || 'Administrador',
    };
    
    logger.info(`${TAG} Chamando o orquestrador com a nova arquitetura.`);
    const { stream } = askAdminLLM(adminContext, userQuery, openAIHistory);
    
    return new Response(stream, {
        headers: { 
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'no-cache',
        }
    });

  } catch (error: any) {
    logger.error(`${TAG} Erro inesperado no endpoint:`, error);
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}
