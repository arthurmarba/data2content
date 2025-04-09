// src/app/lib/whatsappService.ts

/**
 * WhatsApp Cloud API:
 * - Defina no .env (ou .env.local):
 *   - WHATSAPP_TOKEN=<seu token de acesso do Cloud API>
 *   - WHATSAPP_PHONE_NUMBER_ID=<ID do número de telefone no Facebook Developers>
 *
 * Observações:
 * - Se estiver usando Next.js 13, você pode usar o fetch nativo e remover node-fetch.
 * - Garanta que seu número do usuário esteja no formato internacional (ex.: "+55xx9xxxx1111").
 * - Verifique se seu app do Facebook Developers está configurado corretamente com a Cloud API do WhatsApp.
 */

const WABA_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// URL base da Cloud API (ajuste a versão se necessário)
const BASE_URL = "https://graph.facebook.com/v16.0";

/**
 * sendWhatsAppMessage:
 * Envia uma mensagem de texto simples para o número de WhatsApp fornecido.
 *
 * @param to   Número de destino em formato internacional (ex.: "+5511999998888")
 * @param body Texto da mensagem que deseja enviar
 * @throws Lança erro caso falhe no envio ou se as variáveis de ambiente não estiverem definidas
 */
export async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  // 1) Verifica se as variáveis de ambiente estão definidas
  if (!WABA_TOKEN || !PHONE_NUMBER_ID) {
    throw new Error("Variáveis WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não definidas no .env");
  }

  // 2) Garante que o número comece com '+'
  const phoneNumber = to.startsWith("+") ? to : `+${to}`;

  // 3) Monta a URL e o payload para a requisição
  const url = `${BASE_URL}/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    text: { body },
  };

  try {
    // 4) Realiza a chamada à API do WhatsApp
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WABA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // 5) Verifica se a resposta foi bem-sucedida; se não, lança erro com os detalhes
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro ao enviar mensagem WhatsApp:", errorText);
      throw new Error(`WhatsApp API retornou status ${response.status}: ${errorText}`);
    }

    // Opcional: Log de sucesso
    // console.log(`Mensagem enviada com sucesso para ${phoneNumber}: ${body}`);
  } catch (error: unknown) {
    console.error("Erro no sendWhatsAppMessage:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Falha ao enviar mensagem via WhatsApp Cloud API: ${errorMessage}`);
  }
}
