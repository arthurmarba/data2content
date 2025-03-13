"use client";

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric";
import { buildAggregatedReport } from "@/app/lib/reportHelpers";
import { generateReport, AggregatedMetrics } from "@/app/lib/reportService";
import { sendWhatsAppMessage } from "@/app/lib/whatsappService";
import { Model, Types } from "mongoose";

interface ReportResult {
  userId: string;
  success: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    await connectToDatabase();

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

    const now = new Date();
    const fromDate = new Date();
    fromDate.setDate(now.getDate() - 7);

    const results = await Promise.allSettled<ReportResult>(
      users.map(async (user) => {
        const userId = (user._id as Types.ObjectId).toString();
        try {
          // Faz o cast para Model<IDailyMetric> para garantir a tipagem correta
          const dailyMetricModel = DailyMetric as unknown as Model<IDailyMetric>;
          const dailyMetrics = await dailyMetricModel.find({
            user: user._id,
            postDate: { $gte: fromDate },
          }).lean();

          const aggregatedReport = buildAggregatedReport(dailyMetrics) as unknown as AggregatedMetrics;
          const reportText = await generateReport(aggregatedReport, "7 dias");

          if (!user.whatsappPhone) {
            console.warn(`Usuário ${userId} não possui número de WhatsApp.`);
            return { userId, success: false };
          }
          let phoneWithPlus = user.whatsappPhone;
          if (!phoneWithPlus.startsWith("+")) {
            phoneWithPlus = "+" + phoneWithPlus;
          }

          await safeSendWhatsAppMessage(phoneWithPlus, reportText);
          console.log(`Relatório enviado para userId=${userId}, phone=${phoneWithPlus}`);
          return { userId, success: true };
        } catch (error: unknown) {
          console.error(`Erro ao processar relatório para userId=${userId}:`, error);
          return { userId, success: false };
        }
      })
    );

    const countSends = results.filter((r) => r.status === "fulfilled" && r.value.success).length;

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

async function safeSendWhatsAppMessage(phone: string, body: string) {
  try {
    await sendWhatsAppMessage(phone, body);
  } catch (error: unknown) {
    console.error(`Falha ao enviar WhatsApp para ${phone}:`, error);
  }
}
