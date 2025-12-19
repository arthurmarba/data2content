import { sendTemplateMessage } from "@/app/lib/whatsappService";
import { connectToDatabase } from "@/app/lib/mongoose";

/**
 * Normaliza o número de telefone removendo espaços, traços e parênteses.
 */
export function normalizePhoneNumber(phone: string): string {
  let normalized = phone.replace(/[\s\-()]/g, "");
  if (!normalized.startsWith("+")) {
    normalized = "+" + normalized;
  }
  return normalized;
}

/**
 * Conecta ao banco de dados.
 */
export async function connectDB(): Promise<void> {
  await connectToDatabase();
}

/**
 * Envia uma mensagem via WhatsApp com tratamento de erros.
 */
export async function safeSendWhatsAppMessage(phone: string, body: string): Promise<void> {
  const template = process.env.WHATSAPP_GENERIC_TEMPLATE || "d2c_generic_text";
  try {
    console.debug("Tentando enviar mensagem para:", phone);
    await sendTemplateMessage(phone, template, [
      { type: "body", parameters: [{ type: "text", text: body }] },
    ]);
    console.debug("Mensagem enviada com sucesso para:", phone);
  } catch (error: unknown) {
    console.error(`Falha ao enviar WhatsApp para ${phone}:`, error);
  }
}
