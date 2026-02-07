// src/app/api/whatsapp/process-response/types.ts
// MODIFICADO: v1.3 - Adicionado campo opcional igConnected ao ProcessRequestBody para CTA de conexão do Instagram.
// MODIFICADO: v1.2.1 - Confirmada inclusão de instagramMediaId em PostObject para resolver erro de tipo.
// MODIFICADO: v1.2 - Tornar dialogueState opcional em EnrichedAIContext.
// MODIFICADO: v1.1 - Adicionado currentAlertDetails a EnrichedAIContext

import { DeterminedIntent } from '@/app/lib/intentService';
import { IUser, AlertDetails } from '../../../models/User';
import type { ContextPack } from '@/app/lib/ai/answerEngine/types';
import { IDialogueState } from '@/app/lib/stateService';

/**
 * Define a estrutura esperada para o corpo da requisição
 * processada pelo QStash worker.
 */
export interface ProcessRequestBody {
  fromPhone?: string;
  incomingText?: string;
  userId: string;
  taskType?: string;
  determinedIntent: DeterminedIntent | null;
  qstashMessageId?: string;

  /** NOVO: indica se o IG está conectado; vindo do incoming ou preenchido no worker */
  igConnected?: boolean;
}

/**
 * Representa a estrutura de um objeto de post como usado dentro
 * da lógica de detecção de alertas e outras manipulações nesta rota.
 * O campo instagramMediaId está incluído aqui.
 */
export interface PostObject {
  _id: string;
  userId: string;
  platformPostId?: string;
  instagramMediaId?: string; // Campo necessário para reportService.ts
  type: 'IMAGE' | 'CAROUSEL' | 'REEL' | 'VIDEO' | 'STORY' | string;
  description?: string;
  createdAt: Date | string;
  postDate?: Date | string;
  totalImpressions?: number;
  totalEngagement?: number;
  videoViews?: number;
  totalComments?: number;

  format?: string;
  proposal?: string;
  context?: string;

  tags?: string[];
}

/**
 * Estrutura para um evento detectado pelo Radar Mobi,
 * a ser usado para gerar a mensagem para a IA e para logs.
 */
export interface DetectedEvent {
  type: string;
  messageForAI: string;
  detailsForLog: AlertDetails;
}

/**
 * Contexto enriquecido passado para as funções da LLM.
 * MODIFICADO: dialogueState agora é opcional.
 */
export interface EnrichedAIContext {
  user: IUser;
  historyMessages: any[];
  dialogueState?: IDialogueState;
  userName: string;
  currentAlertDetails?: AlertDetails;
  channel?: 'web' | 'whatsapp';
  intentConfidence?: number;
  intentLabel?: DeterminedIntent | string;
  promptVariant?: string | null;
  chatContextJson?: string | null;
  experimentId?: string | null;
  answerEnginePack?: ContextPack | null;
  scriptContext?: {
    objectiveHint?: string | null;
    toneHint?: string | null;
    narrativePreference?: 'prefer_similar' | 'prefer_different' | null;
    topCategories?: {
      proposal?: string[];
      context?: string[];
      format?: string[];
      tone?: string[];
    };
    topPosts?: Array<{
      id: string;
      captionSnippet?: string;
      format?: string[] | string;
      proposal?: string[];
      context?: string[];
      tone?: string[];
      stats?: {
        shares?: number | null;
        saved?: number | null;
        comments?: number | null;
        likes?: number | null;
        reach?: number | null;
        views?: number | null;
        total_interactions?: number | null;
      };
      postDate?: string | null;
    }>;
    communityOptIn?: boolean;
  } | null;
}
