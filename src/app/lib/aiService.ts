// @/app/lib/aiService.ts - CORRIGIDO (Tratamento de Erro Robusto no Catch)

import { Configuration, OpenAIApi } from "openai";
import winston from "winston";
import { AIError } from "@/app/lib/errors"; // Importar erro customizado

// Configuração básica do Logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.colorize(),
                // Formatando para incluir contexto extra logado
                winston.format.printf(info => {
                    let log = `${info.timestamp} ${info.level}: ${info.message}`;
                    // Adiciona propriedades extras do objeto de log, exceto as padrões
                    const keys = Object.keys(info).filter(key => !['timestamp', 'level', 'message'].includes(key));
                    if (keys.length > 0) {
                        log += ' ' + JSON.stringify(Object.fromEntries(keys.map(key => [key, info[key]])));
                    }
                    return log;
                })
            )
        })
    ]
});


/**
 * callOpenAIForQuestion:
 * Recebe um 'prompt' genérico e retorna a resposta do modelo GPT-4o.
 * @throws {AIError} Se a chave API não estiver configurada, a API OpenAI retornar um erro, ou a resposta estiver vazia/inválida.
 */
export async function callOpenAIForQuestion(
    prompt: string,
    options?: { temperature?: number; max_tokens?: number }
): Promise<string> {
    const fnTag = "[callOpenAIForQuestion]";
    logger.debug(`${fnTag} Iniciando chamada genérica...`);

    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    if (!configuration.apiKey) {
        const errorMsg = "Chave da API OpenAI (OPENAI_API_KEY) não configurada.";
        logger.error(`${fnTag} ${errorMsg}`);
        throw new AIError(errorMsg, undefined); // Passa undefined como erro original
    }
    const openai = new OpenAIApi(configuration);

    const temperature = options?.temperature ?? 0.7;
    const max_tokens = options?.max_tokens ?? 600;

    try {
        logger.debug(`${fnTag} Chamando GPT-4o com temp=${temperature}, max_tokens=${max_tokens}`);
        const completion = await openai.createChatCompletion({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            temperature: temperature,
            max_tokens: max_tokens,
        });

        const rawContent = completion.data.choices?.[0]?.message?.content;

        if (rawContent === null || rawContent === undefined) {
             const errorMsg = "AI response structure missing message content.";
             logger.warn(`${fnTag} ${errorMsg}`);
             throw new AIError(errorMsg, undefined); // Passa undefined como erro original
        }

        const answer = rawContent.trim();

        if (answer === "") {
            const errorMsg = "AI returned empty content string.";
            logger.warn(`${fnTag} ${errorMsg}`);
            throw new AIError(errorMsg, undefined); // Passa undefined como erro original
        }

        logger.debug(`${fnTag} Resposta recebida e validada da IA.`);
        return answer;

    } catch (error: unknown) {
         // <<< INÍCIO: Bloco CATCH Reestruturado >>>
         if (error instanceof AIError) { // Se já for um AIError (das verificações acima), apenas relança
             throw error;
         }

         let message: string;
         let originalError: Error | undefined; // Inicializa para clareza

         if (error instanceof Error) { // Verifica se é uma instância de Error padrão
              originalError = error; // É seguro atribuir
              message = error.message; // Mensagem padrão é a do erro original

              // Tenta verificar se é um erro com detalhes de resposta HTTP (como Axios)
              if (typeof error === 'object' && error !== null && 'response' in error) {
                  // Usar 'as any' ou definir uma interface/tipo mais específico se conhecer a estrutura
                  const responseError = (error as any).response;
                  const statusCode = responseError?.status ?? 'N/A';
                  // Tenta pegar a mensagem de erro específica da API, se disponível
                  const apiErrorMessage = responseError?.data?.error?.message || message;
                  const errorData = responseError?.data;
                  logger.error(`${fnTag} Erro na chamada da API OpenAI:`, { status: statusCode, message: apiErrorMessage, data: errorData });
                  // Define uma mensagem mais específica para o AIError
                  message = `Falha na chamada da API OpenAI (Status: ${statusCode}): ${apiErrorMessage}`;
              } else {
                  // É um Error, mas não tem a estrutura esperada de erro de resposta HTTP
                  logger.error(`${fnTag} Erro (não-API) ao chamar OpenAI:`, { message: message, name: error.name });
                  // Mantém a mensagem original do erro
              }
              // Lança AIError com a mensagem definida e o erro original (que é instanceof Error)
              throw new AIError(message, originalError);

         } else {
              // Não é uma instância de Error (pode ser string, objeto, etc.)
              const unknownErrorMessage = String(error);
              logger.error(`${fnTag} Erro desconhecido (não-Error) ao chamar OpenAI:`, { error: unknownErrorMessage });
              message = `Erro desconhecido ao chamar OpenAI: ${unknownErrorMessage}`;
              // Lança AIError com a mensagem e undefined como erro original
              throw new AIError(message, undefined);
         }
         // <<< FIM: Bloco CATCH Reestruturado >>>
    }
}

/**
 * Formato esperado ao retornar as dicas.
 */
export interface TipsResponse {
  titulo: string;
  dicas: string[];
}

/**
 * callOpenAIForTips:
 * Recebe métricas agregadas e retorna um objeto JSON com dicas da semana.
 * @throws {AIError} Se a chave API não estiver configurada, a API OpenAI retornar um erro, ou a resposta não for JSON válido.
 */
export async function callOpenAIForTips(
  aggregated: Record<string, unknown>
): Promise<TipsResponse> {
     const fnTag = "[callOpenAIForTips]";
     logger.debug(`${fnTag} Gerando dicas em JSON...`);

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
        const errorMsg = "Chave da API OpenAI (OPENAI_API_KEY) não configurada.";
        logger.error(`${fnTag} ${errorMsg}`);
        throw new AIError(errorMsg, undefined); // Passa undefined como erro original
    }
    const openai = new OpenAIApi(configuration);

    try {
        logger.debug(`${fnTag} Chamando GPT-4o para gerar JSON de dicas...`);
        const completion = await openai.createChatCompletion({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.5,
            max_tokens: 400,
        });

        const rawAnswer = completion.data.choices?.[0]?.message?.content?.trim() || "";

        try {
            const cleanedAnswer = rawAnswer.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            if (!cleanedAnswer) {
                 const errorMsg = "Resposta da IA estava vazia após limpeza, não é possível parsear JSON.";
                 logger.error(`${fnTag} ${errorMsg}`);
                 // Lança um erro normal aqui, que será pego pelo catch externo e transformado em AIError
                 throw new Error(errorMsg);
            }
            const parsed = JSON.parse(cleanedAnswer) as TipsResponse;

            if (parsed && parsed.titulo && Array.isArray(parsed.dicas)) {
                 logger.info(`${fnTag} Dicas em JSON geradas e parseadas com sucesso.`);
                 return parsed;
            } else {
                 // Lança um erro normal aqui, que será pego pelo catch externo e transformado em AIError
                 throw new Error("Estrutura JSON inválida recebida da API.");
            }
        } catch (parseError: unknown) {
            // Este catch pega erros do JSON.parse ou dos 'throw new Error' acima
            logger.error(`${fnTag} Resposta de IA não pôde ser parseada como JSON:`, { response: rawAnswer, error: parseError });
            // Lança um AIError específico para erro de formato, passando o erro de parse original
            throw new AIError("Resposta da IA não está no formato JSON esperado.", parseError as Error); // Assumindo que parseError é geralmente um Error
        }
    } catch (error: unknown) {
         // <<< INÍCIO: Bloco CATCH Reestruturado >>>
         if (error instanceof AIError) { // Se já for um AIError (do parser JSON acima), apenas relança
             throw error;
         }

         let message: string;
         let originalError: Error | undefined; // Inicializa para clareza

         if (error instanceof Error) { // Verifica se é uma instância de Error padrão
              originalError = error; // É seguro atribuir
              message = error.message; // Mensagem padrão é a do erro original

              // Tenta verificar se é um erro com detalhes de resposta HTTP (como Axios)
              if (typeof error === 'object' && error !== null && 'response' in error) {
                  const responseError = (error as any).response;
                  const statusCode = responseError?.status ?? 'N/A';
                  const apiErrorMessage = responseError?.data?.error?.message || message;
                  const errorData = responseError?.data;
                  logger.error(`${fnTag} Erro na chamada da API OpenAI para gerar dicas:`, { status: statusCode, message: apiErrorMessage, data: errorData });
                  message = `Falha na chamada da API OpenAI para gerar dicas (Status: ${statusCode}): ${apiErrorMessage}`;
              } else {
                  logger.error(`${fnTag} Erro (não-API) ao gerar dicas via OpenAI:`, { message: message, name: error.name });
                  // Mantém a mensagem original do erro
              }
              throw new AIError(message, originalError);

         } else {
              // Não é uma instância de Error
              const unknownErrorMessage = String(error);
              logger.error(`${fnTag} Erro desconhecido (não-Error) ao gerar dicas via OpenAI:`, { error: unknownErrorMessage });
              message = `Erro desconhecido ao gerar dicas via OpenAI: ${unknownErrorMessage}`;
              throw new AIError(message, undefined);
         }
         // <<< FIM: Bloco CATCH Reestruturado >>>
    }
}

// --- NOTA IMPORTANTE ---
// (Mesma nota anterior sobre AIError e a necessidade de revisar a camada de resiliência)
// **Recomendação:** Para manter informações extras como 'errorCode', 'statusCode'
// ou 'errorData' de forma estruturada, considere modificar a classe `AIError`
// em `@/app/lib/errors.ts` para aceitar esses parâmetros no construtor ou
// ter propriedades públicas para armazená-los.
//
// Lembre-se também de revisar a LÓGICA DE RESILIÊNCIA (callAIWithResilience, etc.)
// para garantir que ela capture e propague corretamente os AIError lançados aqui.