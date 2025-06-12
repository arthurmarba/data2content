/**
 * @fileoverview Processador de Chat da IA do Admin.
 * @version 3.0.0
 * @description Contém a classe `AdminAIChatProcessor` que gerencia o ciclo
 * de vida de uma conversa com a IA, incluindo o manuseio de chamadas de
 * ferramentas (tool calls) de forma recursiva.
 *
 * ## Melhorias na Versão 3.0.0:
 * - **Respostas Contextuais Otimizadas:** A lógica de `_executeSingleToolCall`
 * foi aprimorada. Agora, quando uma ferramenta não retorna dados, a IA recebe
 * instruções claras para ser mais proativa e guiar o usuário com as sugestões
 * disponíveis, em vez de apenas relatar a falha. Isso evita loops de conversação
 * repetitivos e melhora a experiência do usuário.
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionMessageToolCall } from 'openai/resources/chat/completions';
import { logger } from '../logger';
import { openai, MODEL } from './config';
import { getAdminSystemPrompt } from '../adminPromptSystem';
import { adminFunctionSchemas, adminFunctionExecutors } from '../adminAiFunctions';
import { SERVICE_TAG, STATUS_DELIMITER, DATA_DELIMITER, MAX_TOOL_ITERATIONS, ExtractedDataPayload, ToolFunctionResult } from './types';

export class AdminAIChatProcessor {
    private writer: WritableStreamDefaultWriter<string>;
    private messages: ChatCompletionMessageParam[];
    private iteration = 0;
    private textResponseForCache = '';
    private dataPayloadForCache: ExtractedDataPayload = { visualizations: [], suggestions: [] };
    private readonly TAG = `${SERVICE_TAG}[AdminAIChatProcessor]`;

    constructor(writer: WritableStreamDefaultWriter<string>, adminName: string, history: ChatCompletionMessageParam[], query: string) {
        this.writer = writer;
        this.messages = [
            { role: 'system', content: getAdminSystemPrompt(adminName) },
            ...history,
            { role: 'user', content: query },
        ];
    }
    
    public async run(): Promise<string> {
        await this.processTurn();
        return this.getFinalResponseForCache();
    }

    private async processTurn(): Promise<void> {
        if (this.iteration >= MAX_TOOL_ITERATIONS) {
            throw new Error(`Atingido o máximo de ${MAX_TOOL_ITERATIONS} iterações de função.`);
        }
        this.iteration++;
        await this.writer.write(`${STATUS_DELIMITER}Consultando IA (tentativa ${this.iteration})...`);

        const stream = await openai.chat.completions.create({
            model: MODEL,
            temperature: 0.3,
            stream: true,
            messages: this.messages,
            tools: adminFunctionSchemas,
            tool_choice: 'auto',
        });

        let currentTextResponse = '';
        const toolCalls: ChatCompletionMessageToolCall[] = [];

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
                currentTextResponse += delta.content;
                await this.writer.write(delta.content);
            }
            if (delta?.tool_calls) {
                this.accumulateToolCalls(delta.tool_calls, toolCalls);
            }
        }

        if (currentTextResponse) {
            this.messages.push({ role: 'assistant', content: currentTextResponse });
            this.textResponseForCache += currentTextResponse;
        }

        if (toolCalls.length > 0) {
            await this.executeTools(toolCalls);
        }
    }
    
    private accumulateToolCalls(
        deltas: ReadonlyArray<OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall>,
        toolCalls: ChatCompletionMessageToolCall[]
    ): void {
        for (const delta of deltas) {
            if (!toolCalls[delta.index]) {
                toolCalls[delta.index] = { id: '', type: 'function', function: { name: '', arguments: '' } };
            }
            const toolCall = toolCalls[delta.index];

            if (!toolCall) {
                logger.warn(`${this.TAG} Índice de toolCall inconsistente recebido do stream: ${delta.index}`);
                continue;
            }

            if (delta.id) toolCall.id += delta.id;
            if (delta.function?.name) toolCall.function.name += delta.function.name;
            if (delta.function?.arguments) toolCall.function.arguments += delta.function.arguments;
        }
    }

    private async executeTools(toolCalls: ChatCompletionMessageToolCall[]): Promise<void> {
        this.messages.push({ role: 'assistant', content: null, tool_calls: toolCalls });
        await Promise.all(toolCalls.map(toolCall => this._executeSingleToolCall(toolCall)));
        await this.processTurn();
    }
    
    private async _executeSingleToolCall(toolCall: ChatCompletionMessageToolCall): Promise<void> {
        const { name, arguments: argsStr } = toolCall.function;
        const toolTag = `${this.TAG}[Tool:${name}]`;
        await this.writer.write(`${STATUS_DELIMITER}Ferramenta '${name}' solicitada...`);

        let args: any;
        try {
            args = JSON.parse(argsStr || '{}');
        } catch (jsonError) {
            logger.error(`${toolTag} Erro de parsing no JSON dos argumentos.`, { args: argsStr, error: jsonError });
            const errorMessage = `Falha ao interpretar os argumentos da ferramenta. O JSON fornecido é inválido.`;
            this.messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: errorMessage }) });
            return;
        }

        try {
            const executor = adminFunctionExecutors[name];
            if (!executor) throw new Error(`Executor da ferramenta não foi encontrado.`);
            
            await this.writer.write(`${STATUS_DELIMITER}Consultando fontes de dados...`);
            const functionResult = await executor(args) as ToolFunctionResult;

            this.dataPayloadForCache.visualizations.push(...(functionResult.visualizations || []));
            this.dataPayloadForCache.suggestions.push(...(functionResult.suggestions || []));
            
            // OTIMIZAÇÃO: Lógica para instruir melhor a IA.
            const hasData = (functionResult.visualizations || []).length > 0;
            let contentForAI: string;

            if (hasData) {
                contentForAI = `A ferramenta '${name}' foi executada com sucesso e retornou dados. Use o sumário a seguir para basear sua resposta: "${functionResult.summary}"`;
            } else {
                contentForAI = `A ferramenta '${name}' executou, mas não encontrou dados. A razão foi: "${functionResult.summary}". 
                **Instrução Crítica:** Não se limite a repetir essa falha. Informe ao usuário de forma empática e use as sugestões de próximos passos para guiá-lo ativamente. Pergunte qual alternativa ele prefere tentar.`;
            }

            this.messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: contentForAI,
            });
        } catch (executionError) {
            logger.error(`${toolTag} Erro na execução da ferramenta.`, { args, error: executionError });
            const errorMessage = `Falha ao executar a ferramenta: ${(executionError as Error).message}`;
            this.messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: errorMessage }) });
        }
    }

    public getFinalResponseForCache(): string {
        const hasDataPayload = this.dataPayloadForCache.visualizations.length > 0 || this.dataPayloadForCache.suggestions.length > 0;
        if (hasDataPayload) {
            return this.textResponseForCache + DATA_DELIMITER + JSON.stringify(this.dataPayloadForCache);
        }
        return this.textResponseForCache;
    }
}
