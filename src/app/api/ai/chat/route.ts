// src/app/api/ai/chat/route.ts

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/app/lib/mongoose";
import { Metric } from "@/app/models/Metric";
import { callOpenAIForQuestion } from "@/app/lib/aiService";

export async function POST(request: Request) {
  try {
    // 1) Lê o body JSON
    const { userId, query } = await request.json() || {};

    // 2) Valida campos
    if (!userId) {
      return NextResponse.json({ error: "Falta userId" }, { status: 400 });
    }
    if (!query || !query.trim()) {
      return NextResponse.json({ error: "Falta query (pergunta do usuário)" }, { status: 400 });
    }

    // 3) Conecta ao banco e busca métricas do usuário
    await connectToDatabase();
    const userMetrics = await Metric.find({ user: userId });

    // 4) Monta prompt, instruindo a IA a usar somente as métricas fornecidas
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
  } catch (err: any) {
    console.error("POST /api/ai/chat error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
