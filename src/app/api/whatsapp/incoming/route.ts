import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric";
import { buildAggregatedReport } from "@/app/lib/reportHelpers";
import { generateReport, AggregatedMetrics } from "@/app/lib/reportService";
import { sendWhatsAppMessage } from "@/app/lib/whatsappService";
import { Types, Model } from "mongoose";

export const runtime = "nodejs";

/**
 * Função auxiliar para enviar mensagem via WhatsApp com try/catch.
 */
async function safeSendWhatsAppMessage(phone: string, body: string) {
  try {
    await sendWhatsAppMessage(phone, body);
  } catch (error: unknown) {
    console.error(`Falha ao enviar WhatsApp para ${phone}:`, error);
  }
}

/**
 * Interface para o resultado do envio de relatório para cada usuário.
 */
interface ReportResult {
  userId: string;
  success: boolean;
}

/**
 * POST /api/whatsapp/weeklyReport
 * Envia relatórios semanais via WhatsApp para todos os usuários com plano ativo e número de WhatsApp cadastrado.
 */
export async function POST(request: NextRequest) {
  try {
    // 1) Verifica autenticação usando getServerSession passando { req, ...authOptions }
    const session = await getServerSession({ req: request, ...authOptions });
    console.debug("[whatsapp/weeklyReport] Sessão:", session);
    if (!session?.user?.id) {
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
        const userId = (user._id as Types.ObjectId).toString();
        try {
          // 5a) Carrega as métricas (DailyMetric) dos últimos 7 dias
          const dailyMetricModel = DailyMetric as Model<IDailyMetric>;
          const dailyMetrics = await dailyMetricModel.find({
            user: user._id,
            postDate: { $gte: fromDate },
          });

          // 5b) Agrega os dados utilizando buildAggregatedReport
          const aggregatedReport = buildAggregatedReport(dailyMetrics) as unknown as AggregatedMetrics;

          // 5c) Gera o relatório detalhado para o período "7 dias"
          const reportText = await generateReport(aggregatedReport, "7 dias");

          // 5d) Ajusta o número de telefone para o formato internacional
          if (!user.whatsappPhone) {
            console.warn(`Usuário ${userId} não possui número de WhatsApp.`);
            return { userId, success: false };
          }
          let phoneWithPlus = user.whatsappPhone;
          if (!phoneWithPlus.startsWith("+")) {
            phoneWithPlus = "+" + phoneWithPlus;
          }

          // 5e) Envia o relatório via WhatsApp
          await safeSendWhatsAppMessage(phoneWithPlus, reportText);
          console.log(`Relatório enviado para userId=${userId}, phone=${phoneWithPlus}`);
          return { userId, success: true };
        } catch (error: unknown) {
          console.error(`Erro ao processar relatório para userId=${userId}:`, error);
          return { userId, success: false };
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
