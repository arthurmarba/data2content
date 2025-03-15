import { NextResponse } from "next/server";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric, { IMetric } from "@/app/models/Metric";
import { Model } from "mongoose";
import { callOpenAIForQuestion } from "@/app/lib/aiService";

// Garante que essa rota use Node.js em vez de Edge (importante para Mongoose).
export const runtime = "nodejs";

/**
 * POST /api/ai/chat
 * Body esperado: { userId, query }
 * Retorna uma resposta da IA baseada nas métricas do usuário.
 */
export async function POST(request: Request) {
  try {
    // 1) Lê o body JSON
    const { userId, query } = (await request.json()) || {};

    // 2) Valida campos
    if (!userId) {
      return NextResponse.json({ error: "Falta userId" }, { status: 400 });
    }
    if (!query || !query.trim()) {
      return NextResponse.json({ error: "Falta query (pergunta do usuário)" }, { status: 400 });
    }

    // 3) Conecta ao banco e busca métricas do usuário
    await connectToDatabase();

    // Faz cast do Metric para Model<IMetric>, resolvendo tipagem no Mongoose
    const metricModel = Metric as Model<IMetric>;
    const userMetrics = await metricModel.find({ user: userId });

    // 4) Monta prompt para a IA
    const prompt = `
Você é um consultor de marketing digital.
Você só sabe sobre as métricas fornecidas abaixo e não deve usar nenhum conhecimento externo.
Métricas do usuário (em formato JSON):
${JSON.stringify(userMetrics)}

Pergunta do usuário: "${query}"

Responda somente com base nas métricas fornecidas, sem inventar dados externos.
Responda em português, de forma amigável e direta.
    `;

    // 5) Chama a IA via função de utilitários (callOpenAIForQuestion)
    const answer = await callOpenAIForQuestion(prompt);

    // 6) Retorna a resposta em JSON
    return NextResponse.json({ answer }, { status: 200 });

  } catch (error: unknown) {
    console.error("POST /api/ai/chat error:", error);

    let message = "Erro desconhecido.";
    if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
