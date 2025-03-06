// src/app/api/lib/whatsappService.ts

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
 * Envia uma mensagem de texto simples para o número de WhatsApp fornecido (ex.: "+5561999998888").
 *
 * @param to   Número de destino em formato internacional (com código de país). Ex.: "+5511999998888"
 * @param body Texto da mensagem que deseja enviar
 * @throws Lança erro caso falhe no envio ou se as variáveis de ambiente não estiverem definidas
 */
export async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  // 1) Verifica se as variáveis de ambiente estão definidas
  if (!WABA_TOKEN || !PHONE_NUMBER_ID) {
    throw new Error(
      "Variáveis WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não definidas no .env"
    );
  }

  // 2) Garante que 'to' comece com '+'
  if (!to.startsWith("+")) {
    to = "+" + to;
  }

  // 3) Monta a URL e o payload
  const url = `${BASE_URL}/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to,
    text: { body },
  };

  try {
    // 4) Faz a requisição
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WABA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // 5) Se falhar, lança erro com detalhes
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro ao enviar mensagem WhatsApp:", errorText);
      throw new Error(`WhatsApp API retornou status ${response.status}: ${errorText}`);
    }

    // Se quiser confirmar que a mensagem foi enviada, descomente:
    // console.log(`Mensagem enviada com sucesso para ${to}: ${body}`);
  } catch (error: any) {
    console.error("Erro no sendWhatsAppMessage:", error);
    throw new Error("Falha ao enviar mensagem via WhatsApp Cloud API.");
  }
}

/*
Exemplo de uso (em outro arquivo):

import { sendWhatsAppMessage } from "@/app/api/lib/whatsappService";

await sendWhatsAppMessage("+5511999998888", "Olá, isso é um teste!");

- Certifique-se de que o número esteja no formato internacional.
- Ajuste a versão da API se necessário (ex.: v17.0).
- Se precisar enviar mídia (imagens, documentos), pesquise a documentação oficial
  da WhatsApp Cloud API para montar o payload apropriado.
*/
