// @/src/app/api/ai/dynamicCards/route.ts – rev. OpenAI‑v4
// Corrige import do SDK, simplifica instância e mantém restante da lógica.

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { guardPremiumRequest } from "@/app/lib/planGuard";

/**
 * POST /api/ai/dynamicCards
 * Recebe { userStats, visao, missao, objetivos, filtros? }
 *   - userStats -> array de Metric (ou stats consolidados)
 *   - visao, missao, objetivos -> strings do usuário
 *   - filtros (opcional) -> array de strings
 * Retorna um JSON com "cards": [...]
 */
export async function POST(request: NextRequest) {
  const guardResponse = await guardPremiumRequest(request);
  if (guardResponse) {
    return guardResponse;
  }
  try {
    /* --------------------------------------------------
       1. Leitura e validação do corpo
    -------------------------------------------------- */
    const body = await request.json();
    const { userStats, visao, missao, objetivos, filtros } = body ?? {};

    if (!Array.isArray(userStats) || userStats.length === 0) {
      return NextResponse.json({ error: "Sem métricas para analisar" }, { status: 400 });
    }

    /* --------------------------------------------------
       2. Construção do prompt → (fica igual)
    -------------------------------------------------- */
    const prompt = `
Você é um consultor de marketing digital especializado em análises avançadas e recomendações estratégicas.
O usuário tem a seguinte visão: "${visao}"
Missão: "${missao}"
Objetivos: "${(objetivos ?? []).join(", ")}"
Filtros (se houver): "${(filtros ?? []).join(", ")}"

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
  "cards": [ <objetos> ]
}

5) Se não encontrar dados suficientes, retorne "cards": [].

Observação:
- Não use métricas zeradas ou nulas.
- Se houver 9 ou mais métricas avançadas disponíveis (>0), prefira elas a métricas básicas repetidas.
`;

    /* --------------------------------------------------
       3. Instância OpenAI (v4)
    -------------------------------------------------- */
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    /* --------------------------------------------------
       4. Chamada Chat Completion
    -------------------------------------------------- */
    const { choices } = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      temperature: 0.3,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = choices[0]?.message?.content ?? "";

    /* --------------------------------------------------
       5. Parseia saída JSON (tolerante a erro)
    -------------------------------------------------- */
    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { rawText: responseText };
    }

    // Filtra cards com value === 0
    if (
      parsed &&
      typeof parsed === "object" &&
      "cards" in parsed &&
      Array.isArray((parsed as { cards: unknown[] }).cards)
    ) {
      (parsed as { cards: any[] }).cards = (parsed as { cards: any[] }).cards.filter((card) => {
        if (!card || typeof card !== "object") return false;
        const val = (card as any).value;
        return !(val === 0 || val === "0");
      });
    }

    return NextResponse.json({ result: parsed }, { status: 200 });
  } catch (err: unknown) {
    console.error("POST /api/ai/dynamicCards error:", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
