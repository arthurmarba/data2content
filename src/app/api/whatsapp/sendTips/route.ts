import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { Model } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { DailyMetric } from "@/app/models/DailyMetric";
import { sendWhatsAppMessage } from "@/app/lib/whatsappService";
import { callOpenAIForTips } from "@/app/lib/aiService";

// Garante que essa rota use Node.js em vez de Edge (importante para Mongoose).
export const runtime = "nodejs";

/**
 * Interface mínima para as métricas diárias usadas em aggregateWeeklyMetrics.
 */
interface DailyMetricDoc {
  stats?: {
    curtidas?: number;
    // Adicione outras propriedades se necessário
  };
}

/**
 * Função que agrega as métricas dos últimos 7 dias.
 * Ajuste conforme sua necessidade (somar curtidas, calcular engajamento médio, etc.).
 */
function aggregateWeeklyMetrics(dailyMetrics: DailyMetricDoc[]) {
  let totalCurtidas = 0;
  const totalPosts = dailyMetrics.length;

  dailyMetrics.forEach((dm) => {
    totalCurtidas += dm.stats?.curtidas || 0;
  });

  const avgCurtidas = totalPosts > 0 ? totalCurtidas / totalPosts : 0;

  return {
    totalPosts,
    avgCurtidas,
  };
}

/**
 * Interface mínima para o objeto de dicas retornado pela IA.
 * Exemplo: { titulo: "...", dicas: ["dica1", "dica2"] }
 */
interface TipsData {
  titulo?: string;
  dicas?: string[];
}

/**
 * Formata a mensagem final para enviar no WhatsApp a partir do objeto de dicas.
 */
function formatTipsMessage(tipsData: TipsData) {
  const titulo = tipsData.titulo || "Dicas da Semana";
  const dicas = tipsData.dicas || [];

  let msg = `*${titulo}*\n\n`;
  dicas.forEach((d, i) => {
    msg += `${i + 1}. ${d}\n`;
  });
  msg += "\nBons posts e até a próxima!";

  return msg;
}

/**
 * Envolve sendWhatsAppMessage em try/catch para evitar que um erro interrompa o envio para os demais usuários.
 */
async function safeSendWhatsAppMessage(phone: string, body: string) {
  if (!phone.startsWith("+")) {
    phone = "+" + phone;
  }
  try {
    await sendWhatsAppMessage(phone, body);
  } catch (error) {
    console.error(`Falha ao enviar WhatsApp para ${phone}:`, error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1) Verifica se a requisição está autenticada (ex.: admin)
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    // (Opcional) Caso queira restringir a admins: if (token.role !== "admin") { ... }

    // 2) Conecta ao banco
    await connectToDatabase();

    // 3) Busca todos os usuários com plano ativo e whatsappPhone
    const users = await User.find({
      planStatus: "active",
      whatsappPhone: { $ne: null },
    });

    if (!users.length) {
      return NextResponse.json(
        { message: "Nenhum usuário ativo com WhatsApp cadastrado." },
        { status: 200 }
      );
    }

    // 4) Define o período: 7 dias atrás
    const now = new Date();
    const fromDate = new Date();
    fromDate.setDate(now.getDate() - 7);

    let countSends = 0; // Contador de mensagens enviadas

    // 5) Para cada usuário, gera dicas e envia no WhatsApp
    for (const user of users) {
      try {
        // 5a) Carrega dailyMetrics dos últimos 7 dias
        const dailyMetricModel = DailyMetric as Model<DailyMetricDoc>;
        const dailyMetrics = await dailyMetricModel.find({
          user: user._id,
          postDate: { $gte: fromDate },
        });

        // 5b) Agrega as métricas
        const aggregated = aggregateWeeklyMetrics(dailyMetrics);

        // 5c) Chama a IA para gerar dicas com base nas métricas agregadas
        const tipsData = await callOpenAIForTips(aggregated);

        // 5d) Formata a mensagem para enviar no WhatsApp
        const msg = formatTipsMessage(tipsData);

        // 5e) Envia a mensagem
        if (user.whatsappPhone) {
          await safeSendWhatsAppMessage(user.whatsappPhone, msg);
          countSends++;
          console.log(`Dicas enviadas para userId=${user._id} no número ${user.whatsappPhone}`);
        } else {
          console.warn(`Usuário ${user._id} não possui número de WhatsApp.`);
        }
      } catch (error: unknown) {
        console.error(`Erro ao processar userId=${user._id}:`, error);
      }
    }

    // 6) Retorna sucesso
    return NextResponse.json(
      { message: `Dicas enviadas para ${countSends} usuários.` },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Erro em /api/whatsapp/sendTips:", error);

    let message = "Erro desconhecido.";
    if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
