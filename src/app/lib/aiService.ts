import { Configuration, OpenAIApi } from "openai";
import winston from "winston"; // <<< ADICIONADO: Logger para consistência

// Configuração básica do Logger (similar aos outros arquivos)
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info", // Usar 'info' ou 'debug'
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

/**
 * callOpenAIForQuestion:
 * Recebe um 'prompt' genérico e retorna a resposta do modelo GPT-4o.
 * Função genérica - A qualidade da resposta DEPENDE INTEIRAMENTE da qualidade e
 * das instruções contidas no 'prompt' fornecido pelo chamador.
 *
 * Requisitos:
 * - Definir OPENAI_API_KEY no .env
 */
export async function callOpenAIForQuestion(
    prompt: string,
    options?: { temperature?: number; max_tokens?: number } // <<< ADICIONADO: Opções para flexibilidade
): Promise<string> {
    logger.debug("[callOpenAIForQuestion] Iniciando chamada genérica...");

    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    if (!configuration.apiKey) {
        logger.error("[callOpenAIForQuestion] Chave da API OpenAI (OPENAI_API_KEY) não configurada.");
        return "Erro de configuração: A chave da API OpenAI não foi definida.";
    }
    const openai = new OpenAIApi(configuration);

    // Define defaults se não forem passados nas opções
    const temperature = options?.temperature ?? 0.7; // Default 0.7 para genérico
    const max_tokens = options?.max_tokens ?? 600;   // Default 600 para genérico

    try {
        logger.debug(`[callOpenAIForQuestion] Chamando GPT-4o com temp=${temperature}, max_tokens=${max_tokens}`);
        const completion = await openai.createChatCompletion({
            model: "gpt-4o", // <<< MODELO ATUALIZADO
            messages: [{ role: "user", content: prompt }],
            temperature: temperature,
            max_tokens: max_tokens,
        });

        const answer = completion.data.choices?.[0]?.message?.content?.trim() || "";
        logger.debug("[callOpenAIForQuestion] Resposta recebida da IA.");
        return answer;

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        let statusCode: number | string = 'N/A';
        if (typeof error === 'object' && error !== null && 'response' in error) {
            const responseError = error.response as any;
            statusCode = responseError?.status ?? 'N/A';
            logger.error("[callOpenAIForQuestion] Erro na chamada da API OpenAI:", { status: statusCode, message: errorMessage, data: responseError?.data });
        } else {
             logger.error("[callOpenAIForQuestion] Erro ao chamar OpenAI:", { message: errorMessage });
        }
        // Retorna uma string de erro genérica para o chamador tratar
        return `Desculpe, ocorreu um erro ao gerar a resposta da IA (Status: ${statusCode}).`;
    }
}

/**
 * Formato esperado ao retornar as dicas (se mantiver JSON):
 */
export interface TipsResponse {
  titulo: string;
  dicas: string[];
}

/**
 * callOpenAIForTips:
 * Recebe métricas agregadas e retorna um objeto JSON com dicas da semana.
 * ATENÇÃO: Este prompt AINDA pede JSON. Se o objetivo for dicas em texto
 * conversacional, o prompt e o tipo de retorno precisam ser alterados.
 */
export async function callOpenAIForTips(
  aggregated: Record<string, unknown> // Usar tipo mais específico se possível
): Promise<TipsResponse> {
     logger.debug(`[callOpenAIForTips] Gerando dicas em JSON...`);

     // <<< PROMPT MANTIDO para gerar JSON, mas modelo atualizado >>>
     // Se precisar de texto conversacional, este prompt deve ser reescrito!
     const prompt = `
Você é um consultor de Instagram focado em dados.
Estas são as métricas do usuário:
\`\`\`json
${JSON.stringify(aggregated, null, 2)}
\`\`\`

Instruções:
- Baseie as dicas **exclusivamente** nos dados apresentados.
- Retorne sua resposta **APENAS** em formato JSON válido, seguindo esta estrutura EXATA:
{
  "titulo": "Dicas da Semana",
  "dicas": [
    "Dica concisa 1 baseada nos dados",
    "Dica concisa 2 baseada nos dados",
    "Dica concisa 3 baseada nos dados"
  ]
}
- Gere 3 dicas curtas, em português, e focadas em melhorar o engajamento ou otimizar performance com base nas métricas vistas.
- **NÃO** adicione nenhum texto, comentário ou explicação fora do JSON. Sua resposta deve começar com { e terminar com }.
`;
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    if (!configuration.apiKey) {
        logger.error("[callOpenAIForTips] Chave da API OpenAI (OPENAI_API_KEY) não configurada.");
        // Retorna um objeto TipsResponse indicando o erro
        return { titulo: "Erro", dicas: ["Erro de configuração: Chave da API não definida."] };
    }
    const openai = new OpenAIApi(configuration);

    try {
        logger.debug(`[callOpenAIForTips] Chamando GPT-4o para gerar JSON de dicas...`);
        const completion = await openai.createChatCompletion({
            model: "gpt-4o",        // <<< MODELO ATUALIZADO
            messages: [{ role: "user", content: prompt }],
            temperature: 0.5,       // Temp baixa para seguir formato JSON
            max_tokens: 400,        // Suficiente para o JSON esperado
            // Forçar resposta JSON se a API suportar (algumas versões/modelos têm parâmetros para isso)
            // response_format: { type: "json_object" }, // Descomentar se aplicável e suportado
        });

        const rawAnswer = completion.data.choices?.[0]?.message?.content?.trim() || "";

        // Tenta parsear como JSON
        try {
            // Remover possíveis ```json ``` do início/fim se a IA adicionar
            const cleanedAnswer = rawAnswer.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            const parsed = JSON.parse(cleanedAnswer) as TipsResponse;
            // Validação básica da estrutura
            if (parsed && parsed.titulo && Array.isArray(parsed.dicas)) {
                 logger.info("[callOpenAIForTips] Dicas em JSON geradas e parseadas com sucesso.");
                 return parsed;
            } else {
                 throw new Error("Estrutura JSON inválida recebida da API.");
            }
        } catch (err) {
            logger.error("[callOpenAIForTips] Resposta de IA não pôde ser parseada como JSON:", { response: rawAnswer, error: err });
            // Retorna a resposta crua dentro da estrutura esperada como fallback
            return {
                titulo: "Dicas da Semana (Erro de Formato)",
                dicas: [rawAnswer || "Não foi possível gerar dicas em formato JSON válido."]
            };
        }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        let statusCode: number | string = 'N/A';
         if (typeof error === 'object' && error !== null && 'response' in error) {
            const responseError = error.response as any;
            statusCode = responseError?.status ?? 'N/A';
            logger.error("[callOpenAIForTips] Erro na chamada da API OpenAI:", { status: statusCode, message: errorMessage, data: responseError?.data });
        } else {
             logger.error("[callOpenAIForTips] Erro ao gerar dicas via OpenAI:", { message: errorMessage });
        }
        // Retorna um objeto TipsResponse indicando o erro
        return {
            titulo: "Erro ao Gerar Dicas",
            dicas: [`Desculpe, ocorreu um erro ao gerar as dicas (Status: ${statusCode}).`]
        };
    }
}