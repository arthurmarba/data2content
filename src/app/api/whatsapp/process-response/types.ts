// src/app/api/whatsapp/process-response/types.ts

import { DeterminedIntent } from '@/app/lib/intentService';
import { IUser, AlertDetails } from '../../../models/User'; // <-- ATUALIZADO: Importado AlertDetails
// Importe IMetricStats se quiser tipar o campo stats de forma mais precisa
// import { IMetricStats } from '@/app/models/Metric';

/**
 * Define a estrutura esperada para o corpo da requisição
 * processada pelo QStash worker.
 */
export interface ProcessRequestBody {
    fromPhone?: string;
    incomingText?: string;
    userId: string;
    taskType?: string; // Ex: "daily_tip" ou indefinido para mensagem de usuário
    determinedIntent: DeterminedIntent | null;
    qstashMessageId?: string;
}

/**
 * Representa a estrutura de um objeto de post como usado dentro
 * da lógica de detecção de alertas e outras manipulações nesta rota.
 * ATUALIZADO para incluir format, proposal, e context.
 */
export interface PostObject {
    _id: string;
    userId: string;
    platformPostId?: string;
    type: 'IMAGE' | 'CAROUSEL' | 'REEL' | 'VIDEO' | 'STORY' | string; // string para flexibilidade com DEFAULT_FORMAT
    description?: string;
    /** Data de criação do post. Pode ser string (ISO) ou Date dependendo da origem. */
    createdAt: Date | string;
    totalImpressions?: number;
    totalEngagement?: number;
    videoViews?: number;
    totalComments?: number; // Adicionado anteriormente para detectEngagementPeakNotCapitalized

    // --- CAMPOS ADICIONADOS PARA detectUntappedPotentialTopic ---
    format?: string;
    proposal?: string;
    context?: string;
    // --- FIM DOS CAMPOS ADICIONADOS ---

    // Opcional: Adicionar o campo stats se ele for consistentemente populado
    // e usado diretamente pelos detetores.
    // stats?: IMetricStats; // Descomente e ajuste o tipo se necessário

    // Adicione quaisquer outros campos de métricas ou informações relevantes
    // que são usados nas lógicas de `alertDetectionService` ou `dailyTipHandler`.
}

/**
 * Estrutura para um evento detectado pelo Radar Tuca,
 * a ser usado para gerar a mensagem para a IA e para logs.
 */
export interface DetectedEvent {
    type: string;
    messageForAI: string;
    detailsForLog: AlertDetails; // <-- ATUALIZADO: de 'any' para 'AlertDetails'
}

/**
 * Contexto enriquecido passado para as funções da LLM.
 * Pode ser expandido conforme necessário.
 */
export interface EnrichedAIContext {
    user: IUser;
    historyMessages: any[];
    dialogueState: any;
    userName: string;
}