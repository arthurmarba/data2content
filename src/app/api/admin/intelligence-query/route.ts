/**
 * @fileoverview Endpoint da API para a Central de Inteligência.
 * Recebe as perguntas do administrador, valida a sessão, chama o orquestrador da IA
 * e retorna a resposta em streaming.
 * @version 1.3.0
 */

import { logger } from '@/app/lib/logger';
import { askAdminLLM, AdminAIContext } from '@/app/lib/adminAiOrchestrator';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// --- Tipo de Mensagem do Cliente ---
// Define a estrutura que esperamos do cliente (compatível com Vercel AI SDK)
interface ClientMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string;
  name?: string; // Usado para role 'function'
}

// --- Placeholder para sua lógica de autenticação e sessão ---
async function getAdminSession() {
  // SIMULAÇÃO: Verifique se o usuário está logado e tem a role 'admin'.
  const isAdmin = true;
  if (!isAdmin) {
    return null;
  }
  return { user: { name: 'Admin User' } };
}
// --- Fim do Placeholder ---

const SERVICE_TAG = '[api/admin/intelligence-query v1.3.0]';

/**
 * Handler para requisições POST.
 */
export async function POST(req: Request) {
  const TAG = `${SERVICE_TAG}[POST]`;
  logger.info(`${TAG} Requisição recebida.`);

  try {
    const session = await getAdminSession();
    if (!session) {
      logger.warn(`${TAG} Acesso não autorizado.`);
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 });
    }

    const { messages } = (await req.json()) as { messages: ClientMessage[] };
    if (!messages || messages.length === 0) {
      logger.warn(`${TAG} Requisição inválida: sem mensagens.`);
      return new Response(JSON.stringify({ error: 'Corpo da requisição inválido' }), { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role !== 'user') {
      logger.warn(`${TAG} Requisição inválida: última mensagem não é do usuário.`);
        return new Response(JSON.stringify({ error: 'A última mensagem deve ser do usuário' }), { status: 400 });
    }

    const userQuery = lastMessage.content;
    const history = messages.slice(0, -1);

    const openAIHistory: ChatCompletionMessageParam[] = history.map((msg): ChatCompletionMessageParam => {
        switch (msg.role) {
            case 'function':
                if (!msg.name) {
                    logger.error(`${TAG} Mensagem com role 'function' recebida sem a propriedade 'name'.`);
                    return { role: 'user', content: `Resultado da função (nome não especificado): ${msg.content}`};
                }
                return { role: 'function', name: msg.name, content: msg.content };
            case 'assistant':
                 return { role: 'assistant', content: msg.content };
            case 'system':
                return { role: 'system', content: msg.content };
            case 'user':
                return { role: 'user', content: msg.content };
            default:
                const exhaustiveCheck: never = msg.role;
                throw new Error(`Role não suportado: ${exhaustiveCheck}`);
        }
    });

    const adminContext: AdminAIContext = {
      adminName: session.user.name || 'Administrador',
    };

    const { stream, historyPromise } = await askAdminLLM(adminContext, userQuery, openAIHistory);
    
    historyPromise.then(finalHistory => {
        logger.info(`${TAG} Conversa processada. Histórico final: ${finalHistory.length} mensagens.`);
    }).catch(err => {
        logger.error(`${TAG} Erro na promessa do histórico:`, err);
    });

    logger.info(`${TAG} Retornando stream de resposta para o cliente.`);
    return new Response(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });

  } catch (error: any) {
    logger.error(`${TAG} Erro inesperado no endpoint:`, error);
    return new Response(JSON.stringify({ error: `Erro interno no servidor: ${error.message}` }), { status: 500 });
  }
}
