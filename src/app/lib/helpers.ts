import { sendWhatsAppMessage } from "@/app/lib/whatsappService";
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
  try {
    console.debug("Tentando enviar mensagem para:", phone);
    await sendWhatsAppMessage(phone, body);
    console.debug("Mensagem enviada com sucesso para:", phone);
  } catch (error: unknown) {
    console.error(`Falha ao enviar WhatsApp para ${phone}:`, error);
  }
}
