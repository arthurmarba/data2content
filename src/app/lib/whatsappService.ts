// src/app/lib/whatsappService.ts

/**
 * WhatsApp Cloud API Service:
 * - Responsável por enviar mensagens através da WhatsApp Cloud API.
 * - Requer configuração de variáveis de ambiente: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID.
 *
 * Melhorias nesta versão (v2.0.0):
 * - Adicionada a função `sendTemplateMessage` para enviar mensagens baseadas em templates pré-aprovados.
 * Isso é essencial para notificações proativas fora da janela de 24h.
 * - Tipagem robusta para os componentes e parâmetros dos templates.
 * - Mantida a função `sendWhatsAppMessage` para respostas de texto simples dentro da janela de 24h.
 * - Logging e tratamento de erro aprimorados em ambas as funções.
 */

import { logger } from '@/app/lib/logger'; // Supondo que você tenha um logger centralizado
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';

const WABA_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

const WHATSAPP_API_VERSION = "v18.0";
const BASE_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;
const OUTBOUND_ENABLED = (process.env.WHATSAPP_OUTBOUND_ENABLED || "true").toLowerCase() !== "false";
const ALLOW_FREE_TEXT = process.env.WHATSAPP_ALLOW_FREE_TEXT === "true" || process.env.NODE_ENV !== "production";

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

// --- Interfaces para Tipagem ---

// Parâmetros que podem ser usados dentro de um componente de template
// Ex: "Olá {{1}}" -> o parâmetro é o valor que substitui {{1}}
export interface ITemplateComponentParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  text?: string;
  // Adicionar outros tipos de parâmetro conforme necessário (currency, date_time, etc.)
  // image?: { link: string; }; 
}

// Componentes de um template (header, body, buttons)
export interface ITemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: ITemplateComponentParameter[];
  // Adicionar sub_type e index para botões, se necessário
}

// Respostas da API
interface WhatsAppSuccessResponse {
  messaging_product: string;
  contacts?: { input: string; wa_id: string }[];
  messages?: { id: string }[]; // wamid
}

interface WhatsAppAPIErrorDetail {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  fbtrace_id: string;
}

interface WhatsAppErrorResponse {
  error: WhatsAppAPIErrorDetail;
}


// --- Funções Auxiliares ---

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

function isRetryableStatusCode(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function normalizePhone(to: string): string {
  const cleanedPhoneNumber = to.replace(/[^\d+]/g, '');
  return cleanedPhoneNumber.startsWith("+") ? cleanedPhoneNumber : `+${cleanedPhoneNumber}`;
}

async function enforceOutboundGuard(to: string): Promise<{ blocked: boolean; userId?: string | null }> {
  if (!OUTBOUND_ENABLED) {
    logger.warn("[WhatsAppService] Envio bloqueado por WHATSAPP_OUTBOUND_ENABLED=false", { to });
    return { blocked: true, userId: null };
  }

  try {
    await connectToDatabase();
    const user = await User.findOne({ whatsappPhone: to }).select("_id whatsappOptOut").lean();
    const userId = user?._id ? String(user._id) : null;
    if (user?.whatsappOptOut) {
      logger.warn("[WhatsAppService] Envio bloqueado por opt-out ativo", { to, userId });
      return { blocked: true, userId };
    }
    return { blocked: false, userId };
  } catch (err) {
    logger.error("[WhatsAppService] Falha ao checar opt-out; permitindo envio por segurança reversa", err);
    return { blocked: false, userId: null };
  }
}

function validateEnvVariables() {
    if (!WABA_TOKEN || !PHONE_NUMBER_ID) {
        logger.error("[WhatsAppService] Erro Crítico: Variáveis WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não definidas.");
        throw new Error("Configuração do WhatsApp Service incompleta.");
    }
}


/**
 * sendTemplateMessage: (NOVA FUNÇÃO)
 * Envia uma mensagem baseada em um template pré-aprovado.
 * Esta é a função CORRETA para notificações proativas (alertas, dicas, etc.).
 *
 * @param to - Número de destino em formato internacional.
 * @param templateName - O nome do template aprovado (ex: 'daily_alert_v1').
 * @param components - Array de componentes (header, body) com seus parâmetros.
 * @param lang - Código do idioma do template (padrão: 'pt_BR').
 * @returns O ID da mensagem (wamid) em caso de sucesso.
 * @throws Lança erro em caso de falha.
 */
export async function sendTemplateMessage(
    to: string,
    templateName: string,
    components: ITemplateComponent[],
    lang: string = 'pt_BR'
): Promise<string> {
    const TAG = '[sendTemplateMessage]';
    validateEnvVariables();

    const phoneNumber = normalizePhone(to);
    const guard = await enforceOutboundGuard(phoneNumber);
    if (guard.blocked) {
      throw new Error("Envio bloqueado (opt-out ou kill switch ativo).");
    }

    const url = `${BASE_URL}/${PHONE_NUMBER_ID}/messages`;
    const payload = {
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "template",
        template: {
            name: templateName,
            language: { code: lang },
            components: components,
        },
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            logger.debug(`${TAG} Tentativa ${attempt}/${MAX_RETRIES} de enviar template '${templateName}' para ${phoneNumber}`);

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${WABA_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                const data = (await response.json()) as WhatsAppSuccessResponse;
                const wamid = data.messages?.[0]?.id;
                if (wamid) {
                    logger.info(`${TAG} Template '${templateName}' enviado com sucesso para ${phoneNumber}.`, {
                      wamid,
                      template: templateName,
                      userId: guard.userId,
                    });
                    return wamid;
                } else {
                    lastError = new Error("Resposta OK da API, mas WAMID não encontrado.");
                    logger.warn(`${TAG} ${lastError.message}`, data);
                }
            } else {
                let errorText = `Status ${response.status}: ${response.statusText}`;
                try {
                    const errorData = (await response.json()) as WhatsAppErrorResponse;
                    if (errorData?.error) {
                        errorText = `API Error Code ${errorData.error.code}: ${errorData.error.message}`;
                        logger.error(`${TAG} Erro da API ao enviar template para ${phoneNumber}: ${errorText}`, errorData.error);
                    }
                } catch (e) { /* Ignora erro de parse */ }
                
                lastError = new Error(errorText);

                if (isRetryableStatusCode(response.status) && attempt < MAX_RETRIES) {
                    const retryDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                    logger.warn(`${TAG} Erro recuperável (status ${response.status}). Tentando novamente em ${retryDelay / 1000}s...`);
                    await delay(retryDelay);
                    continue;
                } else {
                    throw lastError;
                }
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            lastError = new Error(`Exceção na tentativa ${attempt}: ${errorMessage}`);
            logger.error(`${TAG} Exceção na tentativa ${attempt} de enviar template para ${phoneNumber}:`, error);

            if (attempt < MAX_RETRIES) {
                const retryDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                await delay(retryDelay);
                continue;
            }
        }
    }
    throw lastError || new Error(`Falha desconhecida ao enviar template para ${phoneNumber}`);
}


/**
 * sendWhatsAppMessage: (FUNÇÃO ORIGINAL MANTIDA)
 * Envia uma mensagem de texto simples.
 * Use esta função APENAS para responder a uma mensagem do usuário dentro da janela de 24 horas.
 *
 * @param to - Número de destino em formato internacional.
 * @param body - Texto da mensagem.
 * @returns O ID da mensagem (wamid) em caso de sucesso.
 * @throws Lança erro em caso de falha.
 */
export async function sendWhatsAppMessage(to: string, body: string): Promise<string> {
    const TAG = '[sendWhatsAppMessage]';
    validateEnvVariables();

    if (!ALLOW_FREE_TEXT) {
      const msg = "[sendWhatsAppMessage] Bloqueado em produção — habilite WHATSAPP_ALLOW_FREE_TEXT=true se necessário.";
      logger.error(msg);
      throw new Error(msg);
    }

    const phoneNumber = normalizePhone(to);
    const guard = await enforceOutboundGuard(phoneNumber);
    if (guard.blocked) {
      throw new Error("Envio bloqueado (opt-out ou kill switch ativo).");
    }

    const url = `${BASE_URL}/${PHONE_NUMBER_ID}/messages`;
    const payload = {
        messaging_product: "whatsapp",
        to: phoneNumber,
        text: { body },
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            logger.debug(`${TAG} Tentativa ${attempt}/${MAX_RETRIES} de enviar texto para ${phoneNumber}`);
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${WABA_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                const data = (await response.json()) as WhatsAppSuccessResponse;
                const wamid = data.messages?.[0]?.id;
                if (wamid) {
                    logger.info(`${TAG} Mensagem de texto enviada com sucesso para ${phoneNumber}.`, {
                      wamid,
                      userId: guard.userId,
                    });
                    return wamid;
                } else {
                     lastError = new Error("Resposta OK da API, mas WAMID não encontrado.");
                     logger.warn(`${TAG} ${lastError.message}`, data);
                }
            } else {
                let errorText = `Status ${response.status}: ${response.statusText}`;
                 try {
                    const errorData = (await response.json()) as WhatsAppErrorResponse;
                    if (errorData?.error) {
                        errorText = `API Error Code ${errorData.error.code}: ${errorData.error.message}`;
                        logger.error(`${TAG} Erro da API ao enviar texto para ${phoneNumber}: ${errorText}`, errorData.error);
                    }
                } catch (e) { /* Ignora erro de parse */ }

                lastError = new Error(errorText);

                if (isRetryableStatusCode(response.status) && attempt < MAX_RETRIES) {
                    const retryDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                    logger.warn(`${TAG} Erro recuperável (status ${response.status}). Tentando novamente em ${retryDelay / 1000}s...`);
                    await delay(retryDelay);
                    continue;
                } else {
                    throw lastError;
                }
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            lastError = new Error(`Exceção na tentativa ${attempt}: ${errorMessage}`);
            logger.error(`${TAG} Exceção na tentativa ${attempt} de enviar texto para ${phoneNumber}:`, error);
            
            if (attempt < MAX_RETRIES) {
                 const retryDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                 await delay(retryDelay);
                 continue;
            }
        }
    }
    throw lastError || new Error(`Falha desconhecida ao enviar mensagem de texto para ${phoneNumber}`);
}
