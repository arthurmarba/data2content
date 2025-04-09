import { NextRequest, NextResponse } from "next/server";
import { connectDB, normalizePhoneNumber, safeSendWhatsAppMessage } from "@/app/lib/helpers";
import { getConsultantResponse } from "@/app/lib/consultantService";

/**
 * GET /api/whatsapp/incoming
 * Handler para a verificação do webhook do WhatsApp/Facebook.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.debug("[whatsapp/incoming] Webhook verification succeeded.");
    return new Response(challenge || "", { status: 200 });
  }
  console.error("[whatsapp/incoming] Webhook verification failed:", {
    mode,
    token,
    expected: process.env.WHATSAPP_VERIFY_TOKEN,
  });
  return NextResponse.json(
    { error: "Webhook verification failed. Invalid token or missing parameters." },
    { status: 403 }
  );
}

/**
 * Extrai o remetente e o texto da mensagem do payload recebido.
 */
async function getSenderAndMessage(body: any): Promise<{ fromPhone: string; incomingText: string } | null> {
  if (body.entry && Array.isArray(body.entry)) {
    for (const entry of body.entry) {
      if (entry.changes && Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          if (change.value) {
            if (change.value.messages && Array.isArray(change.value.messages) && change.value.messages.length > 0) {
              const message = change.value.messages[0];
              if (message.from && message.text && message.text.body) {
                return { fromPhone: message.from, incomingText: message.text.body };
              }
            }
          }
        }
      }
    }
  }
  return null;
}

/**
 * Vincula o número de WhatsApp ao usuário utilizando um código de verificação.
 * Nota: Essa função pode ser extraída para um módulo de helpers, se desejado.
 */
async function verifyWhatsapp(phoneNumber: string, code: string): Promise<{ success: boolean; message: string }> {
  try {
    const { connectToDatabase } = await import("@/app/lib/mongoose");
    const User = (await import("@/app/models/User")).default;

    await connectToDatabase();
    const user = await User.findOne({ whatsappVerificationCode: code });
    if (!user) {
      return { success: false, message: "Código inválido ou expirado." };
    }
    if (user.whatsappPhone && user.whatsappPhone === phoneNumber) {
      return { success: true, message: "Seu número já está vinculado." };
    }
    if (user.planStatus !== "active") {
      return { success: false, message: "Seu plano não está ativo." };
    }
    user.whatsappPhone = phoneNumber;
    user.whatsappVerificationCode = null;
    await user.save();
    console.debug("[whatsapp/verify] Número vinculado para usuário:", user._id.toString());
    return { success: true, message: "Seu número foi vinculado com sucesso!" };
  } catch (error) {
    console.error("Erro ao vincular número:", error);
    return { success: false, message: "Erro ao vincular número." };
  }
}

/**
 * POST /api/whatsapp/incoming
 * Processa a mensagem recebida e envia a resposta via WhatsApp.
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    console.debug("[whatsapp/incoming] Payload recebido:", JSON.stringify(body, null, 2));

    const senderData = await getSenderAndMessage(body);
    if (!senderData) {
      // Verifica se é um payload de status e ignora se for o caso.
      if (body.entry && Array.isArray(body.entry)) {
        const hasStatuses = body.entry.some((entry: any) =>
          entry.changes && Array.isArray(entry.changes) &&
          entry.changes.some((change: any) => change.value && Array.isArray(change.value.statuses))
        );
        if (hasStatuses) {
          console.debug("[whatsapp/incoming] Payload de status recebido; ignorando processamento adicional.");
          return NextResponse.json({ received: true }, { status: 200 });
        }
      }
      console.error("[whatsapp/incoming] Nenhum remetente encontrado no payload.");
      return NextResponse.json({ error: "Nenhum remetente encontrado." }, { status: 400 });
    }

    let { fromPhone, incomingText } = senderData;
    fromPhone = normalizePhoneNumber(fromPhone);
    console.debug("[whatsapp/incoming] Remetente normalizado:", fromPhone, "Texto:", incomingText);

    // Verifica se a mensagem contém um código de verificação (6 caracteres alfanuméricos).
    const codeMatch = incomingText.match(/\b[A-Z0-9]{6}\b/);
    if (codeMatch) {
      const code = codeMatch[0];
      console.debug("[whatsapp/incoming] Código de verificação detectado:", code);
      const verificationResult = await verifyWhatsapp(fromPhone, code);
      await safeSendWhatsAppMessage(fromPhone, verificationResult.message);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // --- Lógica para solicitação de relatório fora de sexta-feira ---
    const lowerText = incomingText.toLowerCase();
    if (lowerText.includes("relatório") || lowerText.includes("relatorio")) {
      const today = new Date().getDay();
      if (today !== 5) {
        const resposta = "O relatório semanal é enviado automaticamente às sextas-feiras. Por favor, aguarde até sexta-feira para recebê-lo.";
        await safeSendWhatsAppMessage(fromPhone, resposta);
        return NextResponse.json({ received: true }, { status: 200 });
      }
    }
    // --- Fim da lógica para relatório fora de sexta ---

    // Gera a resposta do consultor utilizando a lógica centralizada.
    const responseText = await getConsultantResponse(fromPhone, incomingText);

    // Envia a resposta para o usuário via WhatsApp.
    await safeSendWhatsAppMessage(fromPhone, responseText);
    console.debug("[whatsapp/incoming] Resposta enviada para:", fromPhone);

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[whatsapp/incoming] Erro ao processar mensagem:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
