// src/app/api/whatsapp/weeklyReport/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { DailyMetric } from "@/app/models/DailyMetric";
import { buildAggregatedReport } from "@/app/lib/reportHelpers";
import { generateReport } from "@/app/lib/reportService";
import { sendWhatsAppMessage } from "@/app/lib/whatsappService";

/**
 * Função auxiliar para enviar WhatsApp com try/catch
 */
async function safeSendWhatsAppMessage(phone: string, body: string) {
  try {
    await sendWhatsAppMessage(phone, body);
  } catch (error: unknown) {
    console.error(`Falha ao enviar WhatsApp para ${phone}:`, error);
  }
}

/**
 * Interface para o resultado do envio de relatório a cada usuário.
 */
interface ReportResult {
  userId: string;
  success: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // 1) Verifica autenticação (opcional – ex.: admin)
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 2) Conecta ao banco de dados
    await connectToDatabase();

    // 3) Busca todos os usuários com plano ativo e WhatsApp cadastrado
    const users = await User.find({
      planStatus: "active",
      whatsappPhone: { $ne: null },
    });

    if (!users?.length) {
      return NextResponse.json(
        { message: "Nenhum usuário ativo com WhatsApp cadastrado." },
        { status: 200 }
      );
    }

    // 4) Define o período para os dados: últimos 7 dias
    const now = new Date();
    const fromDate = new Date();
    fromDate.setDate(now.getDate() - 7);

    // 5) Processa todos os usuários de forma concorrente
    const results = await Promise.allSettled<ReportResult>(
      users.map(async (user) => {
        try {
          // 5a) Carrega as métricas (DailyMetric) dos últimos 7 dias para o usuário
          const dailyMetrics = await DailyMetric.find({
            user: user._id,
            postDate: { $gte: fromDate },
          });

          // 5b) Agrega os dados com a função buildAggregatedReport
          const aggregatedReport = buildAggregatedReport(dailyMetrics);

          // 5c) Gera o relatório padronizado, usando o período "7 dias"
          const reportText = await generateReport(aggregatedReport, "7 dias");

          // 5d) Assegura que o número de WhatsApp esteja no formato internacional
          let phoneWithPlus = user.whatsappPhone;
          if (!phoneWithPlus.startsWith("+")) {
            phoneWithPlus = "+" + phoneWithPlus;
          }

          // 5e) Envia o relatório via WhatsApp
          await safeSendWhatsAppMessage(phoneWithPlus, reportText);

          console.log(`Relatório enviado para userId=${user._id}, phone=${phoneWithPlus}`);
          return { userId: user._id.toString(), success: true };
        } catch (error: unknown) {
          console.error(`Erro ao processar relatório para userId=${user._id}:`, error);
          return { userId: user._id.toString(), success: false };
        }
      })
    );

    // 6) Conta quantos relatórios foram enviados com sucesso
    const countSends = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;

    return NextResponse.json(
      { message: `Relatórios enviados para ${countSends} usuários.` },
      { status: 200 }
    );

  } catch (error: unknown) {
    console.error("Erro no endpoint weeklyReport:", error);

    let message = "Erro desconhecido.";
    if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
