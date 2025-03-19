import { NextResponse } from "next/server";
import { Configuration, OpenAIApi } from "openai";
import { getServerSession } from "next-auth"; // Para App Router, não passamos `request` como parâmetro
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric, { IMetric } from "@/app/models/Metric";
import { Model } from "mongoose";

// Garante que essa rota use Node.js em vez de Edge (importante para Mongoose).
export const runtime = "nodejs";

/**
 * POST /api/ai/insights
 * Body esperado: { metricId }
 * Retorna insights da IA (modelo GPT-3.5-turbo) baseados em métricas do usuário logado.
 */
export async function POST(request: Request) {
  try {
    // 1) Verifica se o usuário está logado
    // No App Router, use apenas `getServerSession(authOptions)`, sem passar `request`
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 2) Lê o body e obtém o metricId
    const body = await request.json();
    const { metricId } = body || {};
    if (!metricId) {
      return NextResponse.json(
        { error: "Parâmetro 'metricId' é obrigatório." },
        { status: 400 }
      );
    }

    // 3) Conecta ao banco e busca o Metric pertencente ao usuário logado
    await connectToDatabase();

    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json(
        { error: "Usuário sem ID na sessão." },
        { status: 400 }
      );
    }

    // Faz cast do Metric para Model<IMetric> para resolver tipagem no Mongoose
    const metricModel = Metric as Model<IMetric>;
    const metric = await metricModel.findOne({ _id: metricId, user: userId });

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

    // 7) Faz a chamada ao modelo GPT-3.5-turbo
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 600,
    });

    const answer = completion.data.choices[0]?.message?.content || "";

    // 8) Tenta parsear o JSON da resposta
    let parsed: unknown;
    try {
      parsed = JSON.parse(answer);
    } catch (parseErr) {
      console.warn("Falha ao parsear JSON da IA:", parseErr);
      parsed = { rawText: answer };
    }

    // 9) Retorna a resposta com os insights
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
