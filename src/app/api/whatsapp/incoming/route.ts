// src/app/api/whatsapp/incoming/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { DailyMetric } from "@/app/models/DailyMetric";
import { sendWhatsAppMessage } from "@/app/lib/whatsappService";
import { callOpenAIForQuestion } from "@/app/lib/aiService";
import { generateReport, AggregatedMetrics } from "@/app/lib/reportService";
import { buildAggregatedReport } from "@/app/lib/reportHelpers";

/**
 * Interface parcial para o corpo do Webhook do WhatsApp.
 */
interface WhatsAppWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string;
          text?: {
            body?: string;
          };
        }>;
      };
    }>;
  }>;
}

/**
 * parseIncomingBody:
 * Extrai 'from' e 'text' do JSON recebido no webhook da Cloud API.
 */
function parseIncomingBody(body: unknown): { from: string; text: string } {
  if (typeof body !== "object" || body === null) {
    return { from: "", text: "" };
  }

  const b = body as WhatsAppWebhookBody;
  const entry = b.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const msgObj = value?.messages?.[0];

  const from = msgObj?.from || "";
  const text = msgObj?.text?.body || "";
  return { from, text };
}

/**
 * extractVerificationCode:
 * Tenta encontrar um código de 6 caracteres (A-Z0-9) na mensagem do usuário.
 * Ex.: "Meu código é 1PN8J1".
 */
function extractVerificationCode(text: string): string | null {
  const codeRegex = /([A-Z0-9]{6})/;
  const match = text.match(codeRegex);
  return match ? match[1] : null;
}

/**
 * safeSendWhatsAppMessage:
 * Tenta enviar mensagem via WhatsApp e evita quebra de fluxo em caso de erro.
 */
async function safeSendWhatsAppMessage(to: string, body: string) {
  let phoneNumber = to;
  if (!phoneNumber.startsWith("+")) {
    phoneNumber = "+" + phoneNumber;
  }
  try {
    await sendWhatsAppMessage(phoneNumber, body);
  } catch (err) {
    console.error("Falha ao enviar mensagem para", phoneNumber, err);
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1) Lê o JSON do webhook
    const body = await request.json();
    console.log("Webhook WhatsApp /incoming - body:", JSON.stringify(body, null, 2));

    // 2) Extrai 'from' e 'text' do corpo
    const { from, text } = parseIncomingBody(body);
    if (!from || !text) {
      // Se não tivermos remetente ou texto, retornamos 200 (evita retries do WhatsApp)
      return NextResponse.json({ message: "Sem mensagem ou remetente" }, { status: 200 });
    }

    // 3) Conecta ao banco
    await connectToDatabase();

    // 4) Verifica se a mensagem contém um código de verificação (6 caracteres A-Z0-9)
    const verificationCode = extractVerificationCode(text);
    if (verificationCode) {
      // Tenta achar um user com esse code
      const user = await User.findOne({ whatsappVerificationCode: verificationCode });
      if (user) {
        // Vincula o phone e invalida o code
        user.whatsappPhone = from;
        user.whatsappVerificationCode = null;
        await user.save();

        console.log(`Phone vinculado com sucesso: userId=${user._id}, phone=${from}`);
        await safeSendWhatsAppMessage(
          from,
          "Número verificado com sucesso! Agora você pode enviar perguntas sobre suas métricas."
        );
      } else {
        console.log(`Nenhum user encontrado com code=${verificationCode}`);
        await safeSendWhatsAppMessage(
          from,
          "Código inválido ou expirado. Verifique se digitou corretamente."
        );
      }

      return NextResponse.json({ message: "Verificação processada" }, { status: 200 });
    }

    // 5) Se não for código, interpretamos como pergunta sobre métricas ou relatório
    const dbUser = await User.findOne({ whatsappPhone: from });
    if (!dbUser) {
      // Se não achou user vinculado
      await safeSendWhatsAppMessage(
        from,
        "Você não está cadastrado. Envie 'Meu código é ABC123' para vincular seu número."
      );
      return NextResponse.json({ message: "User not found" }, { status: 200 });
    }

    // 6) Verifica se o plano está ativo
    if (dbUser.planStatus !== "active") {
      await safeSendWhatsAppMessage(
        from,
        "Seu plano não está ativo. Acesse nosso site para assinar e continuar recebendo dicas!"
      );
      return NextResponse.json({ message: "Plano inativo" }, { status: 200 });
    }

    // 7) Define o período para carregamento das métricas: últimos 30 dias
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);

    const dailyMetrics = await DailyMetric.find({
      user: dbUser._id,
      postDate: { $gte: fromDate },
    });

    // 8) Verifica se o usuário está solicitando um relatório
    const lowerText = text.toLowerCase();
    if (lowerText.includes("relatório") || lowerText.includes("planejamento de conteúdo")) {
      // Agrega os dados completos utilizando buildAggregatedReport
      // Forçamos o cast para AggregatedMetrics
      const aggregatedReport = buildAggregatedReport(dailyMetrics) as AggregatedMetrics;

      // Gera o relatório detalhado para o período "30 dias"
      const reportText = await generateReport(aggregatedReport, "30 dias");

      // Envia o relatório via WhatsApp
      await safeSendWhatsAppMessage(from, reportText);

      return NextResponse.json({ message: "Relatório gerado e enviado via IA" }, { status: 200 });
    }

    // 9) Caso contrário, fluxo genérico de pergunta
    let totalCurtidas = 0;
    dailyMetrics.forEach((dm) => {
      totalCurtidas += dm.stats?.curtidas || 0;
    });
    const totalPosts = dailyMetrics.length;
    const avgCurtidas = totalPosts > 0 ? totalCurtidas / totalPosts : 0;

    // Monta um objeto de métricas simples para a IA
    const aggregated = { totalPosts, avgCurtidas };

    const prompt = `
Você é um consultor de Instagram.
Estas são as métricas (últimos 30 dias) do usuário: ${JSON.stringify(aggregated)}.
Pergunta: "${text}"

Responda de forma amigável e prática, em poucas linhas.
    `;

    // 10) Chama a IA com o prompt genérico
    const answer = await callOpenAIForQuestion(prompt);

    // 11) Envia a resposta no WhatsApp
    await safeSendWhatsAppMessage(from, answer);

    // 12) Retorna 200
    return NextResponse.json({ message: "Respondido com IA" }, { status: 200 });

  } catch (err: unknown) {
    console.error("Erro em /api/whatsapp/incoming POST:", err);

    let message = "Erro desconhecido.";
    if (err instanceof Error) {
      message = err.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
