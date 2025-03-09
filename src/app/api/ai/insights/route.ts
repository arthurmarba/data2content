// src/app/api/ai/insights/route.ts

import { NextResponse } from "next/server";
import { Configuration, OpenAIApi } from "openai";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/authOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { Metric } from "@/app/models/Metric";

export async function POST(request: Request) {
  try {
    // 1) Verifica se usuário está logado
    const session = await getServerSession(request, authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 2) Lê o body e obtém o metricId
    const body = (await request.json()) || {};
    const { metricId } = body;
    if (!metricId) {
      return NextResponse.json(
        { error: "Parâmetro 'metricId' é obrigatório." },
        { status: 400 }
      );
    }

    // 3) Conecta ao Mongo e busca o Metric pertencente ao usuário logado
    await connectToDatabase();
    const metric = await Metric.findOne({ _id: metricId, user: session.user.id });
    if (!metric) {
      return NextResponse.json(
        { error: "Métrica não encontrada ou não pertence a este usuário." },
        { status: 404 }
      );
    }

    // 4) Pega as stats do Metric (calculadas pelo Document AI, por ex.)
    const stats = metric.stats || {};

    // 5) Configura o client da OpenAI
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    // 6) Monta o prompt
    const prompt = `
Você é um consultor de marketing digital que recebe métricas do Instagram.
Métricas fornecidas: ${JSON.stringify(stats)}

1) Analise os dados e gere insights sobre engajamento, hashtags, melhores horários, etc.
2) Responda em formato JSON, com os campos:
   - "insightPrincipal": string
   - "recomendacoes": array de strings
   - "alertas": array de strings (caso encontre problemas)
`;

    // 7) Faz a chamada
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 600,
    });

    const answer = completion.data.choices[0]?.message?.content || "";

    // 8) Tenta parsear JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(answer);
    } catch (parseErr) {
      // Se não vier JSON válido, logamos o erro e retornamos texto cru
      console.warn("Falha ao parsear JSON da IA:", parseErr);
      parsed = { rawText: answer };
    }

    // 9) Retorna
    return NextResponse.json({ insights: parsed }, { status: 200 });

  } catch (error: unknown) {
    console.error("POST /api/ai/insights error:", error);

    let message = "Erro desconhecido.";
    if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
