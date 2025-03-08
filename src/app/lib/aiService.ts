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
 *
 * Exemplo de uso:
 *   const reportText = await callOpenAIForWeeklyReport(aggregated, "Fulano");
 *   // Então, envie 'reportText' via WhatsApp
 */
export async function callOpenAIForWeeklyReport(
  aggregatedReport: unknown, // Ajuste para um tipo mais específico se quiser
  influencerName: string
): Promise<string> {
  try {
    // Monte um prompt contextualizado, incluindo dados de aggregatedReport
    const prompt = `
Você é um consultor de conteúdo no Instagram. Recebeu as seguintes informações agregadas (Top3, Bottom3, dia da semana, etc.):

Influencer: ${influencerName}
Relatório: ${JSON.stringify(aggregatedReport)}

Preciso que você gere um relatório semanal em tom profissional e objetivo, 
incluindo sugestões de planejamento de conteúdo (dias, formatos, duração),
o que evitar e possíveis CTAs. Conclua com uma frase de incentivo.
`;

    // Configura a API
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1200, // pode aumentar se o relatório for longo
    });

    const answer = completion.data.choices[0]?.message?.content || "";
    return answer;
  } catch (error: unknown) {
    console.error("Erro ao gerar relatório semanal via OpenAI:", error);
    return "Desculpe, ocorreu um erro ao gerar o relatório semanal.";
  }
}

/**
 * Caso queira outras funções específicas (ex.: callOpenAIForTips),
 * você pode criar funções similares:
 *
 * export async function callOpenAIForTips(aggregated: unknown): Promise<string> {
 *   // Monta prompt focado em 'dicas' e chama createChatCompletion
 * }
 */
