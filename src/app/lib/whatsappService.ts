// src/app/lib/whatsappService.ts

/**
 * WhatsApp Cloud API Service:
 * - Responsável por enviar mensagens através da WhatsApp Cloud API.
 * - Requer configuração de variáveis de ambiente:
 * - WHATSAPP_TOKEN: Token de acesso da Cloud API.
 * - WHATSAPP_PHONE_NUMBER_ID: ID do número de telefone configurado no Facebook Developers.
 *
 * Melhorias nesta versão:
 * - Implementado mecanismo de retentativas para erros transientes.
 * - Tratamento de erro aprimorado, com parsing da resposta de erro da API do WhatsApp.
 * - A função sendWhatsAppMessage agora retorna o ID da mensagem (wamid) em caso de sucesso.
 * - Logging mais detalhado.
 */

const WABA_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// URL base da Cloud API (ajuste a versão se necessário, ex: v17.0, v18.0, etc.)
// É uma boa prática manter a versão da API atualizada conforme as recomendações da Meta.
const WHATSAPP_API_VERSION = "v18.0"; // Exemplo, verifique a versão estável mais recente
const BASE_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;

// Constantes para o mecanismo de retentativas
const MAX_RETRIES = 3; // Número máximo de tentativas
const INITIAL_RETRY_DELAY_MS = 1000; // Atraso inicial para a primeira retentativa (1 segundo)

// Interfaces para tipagem das respostas da API
interface WhatsAppSuccessResponse {
  messaging_product: string;
  contacts?: { input: string; wa_id: string }[];
  messages?: { id: string }[]; // O 'id' aqui é o wamid
}

interface WhatsAppAPIErrorDetail {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  error_user_title?: string;
  error_user_msg?: string;
  fbtrace_id: string;
}

interface WhatsAppErrorResponse {
  error: WhatsAppAPIErrorDetail;
}

// Função auxiliar para criar um atraso (delay)
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// Função auxiliar para verificar se um status code HTTP indica um erro retryable
function isRetryableStatusCode(status: number): boolean {
  // 429: Too Many Requests (Rate Limiting)
  // 5xx: Server-side errors
  return status === 429 || (status >= 500 && status <= 599);
}

/**
 * sendWhatsAppMessage:
 * Envia uma mensagem de texto para o número de WhatsApp fornecido, com lógica de retentativas.
 *
 * @param to - Número de destino em formato internacional (ex.: "+5511999998888").
 * @param body - Texto da mensagem que deseja enviar.
 * @returns O ID da mensagem (wamid) em caso de sucesso.
 * @throws Lança erro caso falhe no envio após todas as tentativas,
 * ou se as variáveis de ambiente não estiverem definidas,
 * ou se a API retornar um erro não recuperável.
 */
export async function sendWhatsAppMessage(to: string, body: string): Promise<string> {
  // 1) Verifica se as variáveis de ambiente essenciais estão definidas
  if (!WABA_TOKEN || !PHONE_NUMBER_ID) {
    console.error("[WhatsAppService] Erro Crítico: Variáveis WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não definidas no .env");
    throw new Error("Configuração do WhatsApp Service incompleta: WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID ausentes.");
  }

  // 2) Garante que o número de telefone comece com '+' e remove outros caracteres não numéricos
  //    (exceto o '+') para maior robustez.
  const cleanedPhoneNumber = to.replace(/[^\d+]/g, '');
  const phoneNumber = cleanedPhoneNumber.startsWith("+") ? cleanedPhoneNumber : `+${cleanedPhoneNumber}`;

  // 3) Monta a URL e o payload para a requisição
  const url = `${BASE_URL}/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    text: { body }, // Para mensagens de texto simples. A API suporta Markdown básico aqui.
    // Para outros tipos de mensagem (imagens, botões, etc.), a estrutura do payload muda.
  };

  let lastError: Error | null = null;

  // 4) Loop de retentativas
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.debug(`[WhatsAppService] Tentativa ${attempt}/${MAX_RETRIES} de enviar mensagem para ${phoneNumber}`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WABA_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // 5) Processa a resposta da API
      if (response.ok) {
        const data = (await response.json()) as WhatsAppSuccessResponse;
        const wamid = data.messages?.[0]?.id;

        if (wamid) {
          console.info(`[WhatsAppService] Mensagem enviada com sucesso para ${phoneNumber}. WAMID: ${wamid}`);
          return wamid; // Sucesso, retorna o WAMID
        } else {
          // Isso seria um comportamento inesperado da API para uma resposta 200 OK.
          console.warn("[WhatsAppService] Resposta OK da API, mas WAMID não encontrado na resposta:", data);
          lastError = new Error("Resposta bem-sucedida da API do WhatsApp, mas o WAMID não foi retornado.");
          // Considerar se deve tentar novamente ou falhar imediatamente.
          // Por ora, vamos permitir que tente novamente, caso seja um problema transitório na formação da resposta da API.
          // Se persistir, falhará após MAX_RETRIES.
        }
      } else {
        // A API retornou um erro (status code não OK)
        let errorData: WhatsAppErrorResponse | null = null;
        let errorText = `Status ${response.status}: ${response.statusText}`;
        try {
          errorData = (await response.json()) as WhatsAppErrorResponse;
          if (errorData && errorData.error) {
            errorText = `API Error Code ${errorData.error.code}: ${errorData.error.message} (Type: ${errorData.error.type}, FBTrace: ${errorData.error.fbtrace_id})`;
            console.error(`[WhatsAppService] Erro da API do WhatsApp ao enviar para ${phoneNumber}: ${errorText}`, errorData.error);
          } else {
            // Se o JSON não tiver o formato esperado, tenta ler como texto.
            const rawErrorText = await response.text();
            errorText = `Status ${response.status}: ${rawErrorText || response.statusText}`;
            console.error(`[WhatsAppService] Erro da API do WhatsApp (resposta não JSON ou formato inesperado) ao enviar para ${phoneNumber}: ${errorText}`);
          }
        } catch (jsonParseError) {
          // Se não conseguir parsear o JSON do erro, usa o texto bruto.
          const rawErrorText = await response.text().catch(() => response.statusText); // Fallback para statusText
          errorText = `Status ${response.status}: ${rawErrorText}`;
          console.error(`[WhatsAppService] Erro da API do WhatsApp (falha ao parsear JSON do erro) ao enviar para ${phoneNumber}: ${errorText}`, jsonParseError);
        }
        
        lastError = new Error(errorText);

        // Verifica se o erro é recuperável e se ainda há tentativas restantes
        if (isRetryableStatusCode(response.status) && attempt < MAX_RETRIES) {
          const retryDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Backoff exponencial
          console.warn(`[WhatsAppService] Erro recuperável (status ${response.status}). Tentando novamente em ${retryDelay / 1000}s...`);
          await delay(retryDelay);
          continue; // Próxima tentativa
        } else {
          // Erro não recuperável ou última tentativa falhou
          throw lastError;
        }
      }
    } catch (error: unknown) { // Captura erros de rede, ou erros lançados no try (ex: falha no JSON.parse)
      console.error(`[WhatsAppService] Exceção na tentativa ${attempt} de enviar para ${phoneNumber}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      lastError = new Error(`Exceção na tentativa ${attempt}: ${errorMessage}`);

      if (attempt < MAX_RETRIES) {
        const retryDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Backoff exponencial
        console.warn(`[WhatsAppService] Exceção durante o envio. Tentando novamente em ${retryDelay / 1000}s...`);
        await delay(retryDelay);
        continue; // Próxima tentativa
      } else {
        // Última tentativa falhou
        throw new Error(`Falha ao enviar mensagem via WhatsApp Cloud API para ${phoneNumber} após ${MAX_RETRIES} tentativas. Último erro: ${lastError?.message || "Erro desconhecido"}`);
      }
    }
  }

  // Se o loop terminar sem retornar ou lançar um erro explicitamente (o que não deveria acontecer com a lógica atual),
  // lança o último erro conhecido ou um erro genérico.
  throw lastError || new Error(`Falha desconhecida ao enviar mensagem para ${phoneNumber} após ${MAX_RETRIES} tentativas.`);
}

// Exemplo de como poderia ser usado (não faz parte do serviço em si):
/*
async function testSend() {
  try {
    const userPhoneNumber = "+55XXYYYYYYYYY"; // Substituir pelo número de teste
    const messageBody = "Olá da Tuca! 🚀 Esta é uma mensagem de teste com otimizações.";
    console.log(`[Test] Enviando mensagem para ${userPhoneNumber}...`);
    const wamid = await sendWhatsAppMessage(userPhoneNumber, messageBody);
    console.log(`[Test] Mensagem enviada com sucesso! WAMID: ${wamid}`);
  } catch (error) {
    console.error("[Test] Falha no envio da mensagem de teste:", error);
  }
}

// Para testar, descomente a linha abaixo e execute o arquivo (ex: node whatsappService.js),
// certificando-se que as variáveis de ambiente estão carregadas.
// testSend();
*/
