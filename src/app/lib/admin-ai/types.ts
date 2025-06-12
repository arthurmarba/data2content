/**
 * @fileoverview Tipos, interfaces e constantes compartilhadas para a IA do Admin.
 * @description Centraliza as definições de tipo para garantir consistência
 * em toda a lógica da Central de Inteligência.
 */

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// --- Constantes de Serviço ---
// ATUALIZADO: Versão alinhada com o orquestrador de produção.
export const SERVICE_TAG = '[adminAiOrchestrator v13.0.0]';
export const DATA_DELIMITER = '\n---JSON_DATA_PAYLOAD---';
export const STATUS_DELIMITER = '---STATUS_UPDATE---';
export const MAX_TOOL_ITERATIONS = 5;

// --- Interfaces de Dados ---

/**
 * Contexto da requisição, contendo informações sobre o usuário administrador.
 */
export interface AdminAIContext {
  adminName: string;
}

/**
 * Objeto de retorno da função principal do orquestrador.
 */
export interface AdminLLMResult {
  stream: ReadableStream<string>;
}

/**
 * Representa os dados estruturados extraídos da resposta da IA
 * para renderização de componentes no frontend.
 */
export interface ExtractedDataPayload {
  visualizations: any[];
  suggestions: any[];
}

/**
 * Representa o conteúdo de uma mensagem de ferramenta, que pode
 * conter tanto o sumário para a IA quanto os dados para o frontend.
 */
export interface ToolFunctionResult {
  summary: string;
  visualizations?: any[];
  suggestions?: any[];
}
