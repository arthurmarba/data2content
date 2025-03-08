import { NextResponse } from "next/server";
import { Configuration, OpenAIApi } from "openai";

/**
 * POST /api/ai/dynamicCards
 * Recebe { userStats, visao, missao, objetivos }
 * userStats -> array de Metric (ou apenas stats consolidados)
 * Retorna um JSON com "cards": [...]
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userStats, visao, missao, objetivos } = body;

    if (!userStats || userStats.length === 0) {
      return NextResponse.json({ error: "Sem métricas para analisar" }, { status: 400 });
    }

    // Monta o prompt com instruções detalhadas e estratégicas
    const prompt = `
Você é um consultor de marketing digital especializado em análises avançadas e recomendações estratégicas.
O usuário tem a seguinte visão: "${visao}"
Missão: "${missao}"
Objetivos: "${objetivos?.join(", ")}"

A seguir, temos as métricas do usuário (stats) em formato JSON:
${JSON.stringify(userStats)}

Cada item do array contém { rawData, stats, ... }. No "stats", podem existir métricas básicas 
(p.ex. "totalCurtidas", "taxaEngajamento") e métricas avançadas 
(p.ex. "ratioLikeComment", "indicePropagacao", "engajamentoProfundoAlcance", etc.).

1) Se métricas avançadas (valor > 0) estiverem disponíveis, priorize-as em vez de "taxaEngajamento" e "curtidas".
2) Escolha **entre 9 e 12 métricas** relevantes para a visão/missão/objetivos do usuário, 
   ignorando qualquer métrica com valor 0 ou nulo. 
   Se não houver métricas avançadas suficientes, use placeholders ou inclua básicas, mas só se necessário para chegar a 9.

3) Para cada métrica escolhida, retorne um objeto JSON no array "cards":
{
  "metricKey": "ex: taxaEngajamento",
  "title": "ex: 'Taxa de Engajamento'",
  "value": "valor numérico ou formatado",
  "description": "texto estratégico"
}

3.1) Na "description", ofereça direcionamento prático e estratégico:
    - Relacione a métrica com a visão, missão e objetivos do usuário.
    - Explique possíveis razões para aumento ou queda (ex.: se o alcance médio subiu ou desceu em relação à semana anterior).
    - Considere hipóteses sobre frequência de postagem (ex.: postar menos vezes pode ter aumentado o alcance).
    - Dê **duas dicas práticas** específicas para cada métrica (ex.: 'use CTAs', 'faça enquetes', 'otimize horários de postagem').
    - Seja sucinto, porém estratégico e prático.

4) Responda em JSON no formato:
{
  "cards": [
    {
      "metricKey": "...",
      "title": "...",
      "value": "...",
      "description": "..."
    },
    ...
  ]
}

5) Se não encontrar dados suficientes, retorne "cards": [].

Observação:
- Não use métricas zeradas ou nulas.
- Se houver 9 ou mais métricas avançadas disponíveis (>0), prefira elas a métricas básicas repetidas.
    `;

    // Configura OpenAI
    const configuration = new Configuration({
      apiKey: process.env.OPENAIAI_API_KEY || process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    // Chama GPT
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const responseText = completion.data.choices[0]?.message?.content || "";

    // Tenta parsear JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch (error) {
      // Se não vier JSON válido, devolve como texto cru
      parsed = { rawText: responseText };
    }

    // Se parsed tiver "cards" como array, filtramos as métricas com value=0
    if (
      parsed &&
      typeof parsed === "object" &&
      "cards" in parsed &&
      Array.isArray((parsed as { cards: unknown[] }).cards)
    ) {
      const parsedObj = parsed as { cards: unknown[] };
      parsedObj.cards = parsedObj.cards.filter((card: unknown) => {
        if (!card || typeof card !== "object") return false;
        const c = card as { value?: number };
        if (c.value === 0) return false;
        return true;
      });
    }

    return NextResponse.json({ result: parsed }, { status: 200 });

  } catch (error: unknown) {
    console.error("POST /api/ai/dynamicCards error:", error);

    let message = "Erro desconhecido.";
    if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
