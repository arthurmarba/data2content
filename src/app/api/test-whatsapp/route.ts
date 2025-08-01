// Caminho do ficheiro: src/app/api/test-whatsapp/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService'; // Usando o alias do projeto
import { logger } from '@/app/lib/logger';

export async function GET(request: NextRequest) {
  const TAG = '[API Test WhatsApp]';

  // Medida de segurança: Garante que esta rota só funcione em ambiente de desenvolvimento.
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'This endpoint is for development use only.' }, { status: 403 });
  }

  // Pega o número de telefone de destino a partir dos parâmetros da URL.
  const { searchParams } = new URL(request.url);
  const to = searchParams.get('to');

  if (!to) {
    return NextResponse.json({ error: "Por favor, forneça o parâmetro 'to' na URL. Exemplo: /api/test-whatsapp?to=+5521999998888" }, { status: 400 });
  }

  const testMessage = `Olá, Mobi! 🚀 Teste de ativação do número oficial às ${new Date().toLocaleTimeString()}. Se você recebeu isto, funcionou!`;

  logger.info(`${TAG} Enviando mensagem de teste para o número: ${to}`);

  try {
    const wamid = await sendWhatsAppMessage(to, testMessage);
    
    const successResponse = {
      success: true,
      message: "Mensagem enviada com sucesso!",
      wamid: wamid,
      recipient: to
    };
    logger.info(`${TAG} Mensagem enviada com sucesso.`, successResponse);
    return NextResponse.json(successResponse, { status: 200 });

  } catch (error: any) {
    const errorResponse = {
      success: false,
      message: "Falha ao enviar mensagem.",
      error: error.message || String(error)
    };
    logger.error(`${TAG} Falha ao enviar mensagem.`, errorResponse);
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
