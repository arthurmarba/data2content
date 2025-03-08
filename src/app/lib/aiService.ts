import { Configuration, OpenAIApi } from "openai";

/**
 * callOpenAIForQuestion:
 * Recebe um 'prompt' genérico e retorna a resposta do modelo GPT-3.5-turbo.
 *
 * Requisitos:
 *  - Definir OPENAI_API_KEY no .env (ex.: OPENAI_API_KEY="sk-...")
 *  - Instalar 'openai' (npm install openai)
 */
export async function callOpenAIForQuestion(prompt: string): Promise<string> {
  try {
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 800, // se quiser aumentar o limite
    });

    const answer = completion.data.choices[0]?.message?.content || "";
    return answer;
  } catch (error: unknown) {
    console.error("Erro ao chamar OpenAI:", error);
    return "Desculpe, ocorreu um erro ao gerar a resposta da IA.";
  }
}

/**
 * callOpenAIForWeeklyReport:
 * Recebe um objeto 'aggregatedReport' (ex.: top3, bottom3, etc.) e retorna
 * um texto formatado, simulando um relatório semanal de planejamento de conteúdo.
 */
export async function callOpenAIForWeeklyReport(
  aggregatedReport: unknown, // Ajuste para um tipo mais específico se quiser
  influencerName: string
): Promise<string> {
  try {
    const prompt = `
Você é um consultor de conteúdo no Instagram. Recebeu as seguintes informações agregadas (Top3, Bottom3, dia da semana, etc.):

Influencer: ${influencerName}
Relatório: ${JSON.stringify(aggregatedReport)}

Preciso que você gere um relatório semanal em tom profissional e objetivo, 
incluindo sugestões de planejamento de conteúdo (dias, formatos, duração),
o que evitar e possíveis CTAs. Conclua com uma frase de incentivo.
`;

    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1200,
    });

    const answer = completion.data.choices[0]?.message?.content || "";
    return answer;
  } catch (error: unknown) {
    console.error("Erro ao gerar relatório semanal via OpenAI:", error);
    return "Desculpe, ocorreu um erro ao gerar o relatório semanal.";
  }
}

/**
 * callOpenAIForTips:
 * Recebe métricas agregadas (ex.: totalPosts, avgCurtidas, etc.)
 * e retorna um objeto JSON com dicas da semana:
 *   {
 *     "titulo": "Dicas da Semana",
 *     "dicas": ["Dica 1", "Dica 2", ...]
 *   }
 */
export async function callOpenAIForTips(aggregated: any): Promise<{
  titulo: string;
  dicas: string[];
}> {
  try {
    const prompt = `
Você é um consultor de Instagram.
Estas são as métricas do usuário (ex.: totalPosts, avgCurtidas, etc.): 
${JSON.stringify(aggregated)}

Preciso que você responda em JSON, no seguinte formato:
{
  "titulo": "Dicas da Semana",
  "dicas": [
    "Dica 1",
    "Dica 2",
    "Dica 3"
  ]
}
As dicas devem ser curtas, em português, e focadas em melhorar o engajamento.
Responda somente em JSON, sem texto adicional.
`;

    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 600,
    });

    const rawAnswer = completion.data.choices[0]?.message?.content || "";

    // Tenta parsear como JSON
    try {
      return JSON.parse(rawAnswer);
    } catch (err) {
      // Se não for JSON válido, retorna algo básico
      console.error("Resposta de IA não pôde ser parseada como JSON:", err);
      return {
        titulo: "Dicas da Semana",
        dicas: [rawAnswer || "Não foi possível gerar dicas em formato JSON."],
      };
    }
  } catch (error: unknown) {
    console.error("Erro ao gerar dicas via OpenAI:", error);
    // Retorna fallback
    return {
      titulo: "Dicas da Semana",
      dicas: ["Desculpe, ocorreu um erro ao gerar as dicas."],
    };
  }
}
