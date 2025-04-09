import { callOpenAIForQuestion } from '@/app/lib/aiService'; // <-- VERIFIQUE O CAMINHO
import { logger } from '@/app/lib/logger';       // <-- VERIFIQUE O CAMINHO

// =======================================================
// DEFINIÇÃO DAS CATEGORIAS DE CLASSIFICAÇÃO v3.2
// !! IMPORTANTE: Revise e ajuste estas listas !!
// =======================================================

/**
 * <<< NOVO >>> Lista de FORMATOS válidos.
 * ---> REVISE E AJUSTE ESTA LISTA CONFORME SUA NECESSIDADE <---
 */
const VALID_FORMATS: string[] = [
  "Reel",
  "Foto",           // Foto única
  "Carrossel",      // Múltiplas fotos/vídeos
  "Story",          // Se você rastrear stories
  "Live",           // Se você rastrear lives
  "Vídeo Longo",    // Vídeos que não são Reels (ex: IGTV antigo, YouTube)
  "Outro",          // Formatos não listados ou mistos
  "Desconhecido"    // Default se a classificação falhar
];

/**
 * Lista de PROPÓSITOS / INTENÇÕES válidas. (Mantida da versão anterior)
 */
const VALID_PROPOSALS: string[] = [
  "Dicas", "Review", "Trend", "Humor/Cena", "Clipe", "Mensagem/Motivacional",
  "Posicionamento/Autoridade", "Chamada", "React", "Participação", "Publi/Divulgação",
  "LifeStyle", "Bastidores", "Notícia", "Outro"
];

/**
 * Lista de CONTEXTOS / NICHOS / TÓPICOS válidos. (Mantida da versão anterior)
 */
const VALID_CONTEXTS: string[] = [
    "Beleza/Cuidados Pessoais", "Moda/Estilo", "LifeStyle/Rotina", "Relacionamentos/Família",
    "Fitness/Esporte", "Alimentação/Culinária", "Viagem/Turismo", "Parentalidade",
    "Casa/Decor/DIY", "Tecnologia/Digital", "Finanças", "Carreira/Trabalho",
    "Saúde/Bem-Estar", "Arte/Cultura", "Mídia/Entretenimento", "Automotivo",
    "Natureza/Animais", "Eventos/Celebrações", "Social/Causas/Religião",
    "Desenvolvimento Pessoal", "Geral", "Outro"
];
// =======================================================
// FIM DA DEFINIÇÃO DE CATEGORIAS
// =======================================================


/**
 * Interface para o resultado da classificação.
 * <<< MODIFICADO v3.2: Inclui format >>>
 */
interface ClassificationResult {
  format: string;
  proposal: string;
  context: string;
}

/**
 * Classifica a descrição de um post usando IA (LLM).
 * <<< MODIFICADO v3.2: Tenta identificar format, proposal e context >>>
 * com base nas listas de categorias válidas.
 *
 * @param description A descrição textual do post.
 * @returns Um objeto Promise contendo format, proposal e context classificados. Retorna defaults em caso de erro.
 */
export async function classifyContent(description: string): Promise<ClassificationResult> {
  const defaultFormat = "Desconhecido";
  const defaultProposal = "Outro";
  const defaultContext = "Geral";
  const defaults: ClassificationResult = { format: defaultFormat, proposal: defaultProposal, context: defaultContext };

  if (!description || description.trim().length < 10) { // Ajuste mínimo se necessário
      logger.warn('[classifyContent v3.2] Descrição muito curta ou vazia, usando defaults.');
      return defaults;
  }

  // <<< MODIFICADO v3.2: Prompt atualizado para incluir format >>>
  const classificationPrompt = `
    Analise a seguinte descrição de post de mídia social. Sua tarefa é classificar o conteúdo em TRÊS dimensões:

    1.  **"format" (Formato do Conteúdo):** Qual o tipo de post? Escolha EXATAMENTE UMA opção da seguinte lista: [${VALID_FORMATS.join(', ')}]. (Se for óbvio pela descrição, classifique. Se não, use '${defaultFormat}' ou 'Outro').
    2.  **"proposal" (Propósito/Intenção):** Qual o objetivo principal do post para a audiência? Escolha EXATAMENTE UMA opção da seguinte lista: [${VALID_PROPOSALS.join(', ')}].
    3.  **"context" (Nicho/Tópico):** Sobre qual assunto/nicho principal o post trata? Escolha EXATAMENTE UMA opção da seguinte lista: [${VALID_CONTEXTS.join(', ')}].

    Instruções Importantes:
    - Priorize as opções mais específicas que se encaixam bem para proposal e context. Para format, use '${defaultFormat}' se a descrição não der pistas claras.
    - Se for difícil classificar proposal ou context, use "Outro" ou "Geral" respectivamente.
    - Sua resposta DEVE ser APENAS um objeto JSON válido, sem NENHUM texto, explicação ou formatação adicional antes ou depois.
    - O JSON deve conter EXATAMENTE as chaves "format", "proposal" e "context".

    Exemplo de Resposta Válida:
    {"format": "Reel", "proposal": "Dicas", "context": "Fitness/Esporte"}

    Descrição para analisar:
    ---
    ${description.substring(0, 1500)}
    ---

    Objeto JSON de classificação:
  `;

  try {
      logger.debug(`[classifyContent v3.2] Chamando IA para classificar format/proposal/context (início: "${description.substring(0, 50)}...")`);

      const rawResponse = await callOpenAIForQuestion(classificationPrompt, {
          temperature: 0.15, // Mantém baixa para consistência
          max_tokens: 100    // Aumenta um pouco para acomodar o novo campo
      });

      if (!rawResponse) {
          throw new Error("Resposta vazia da IA para classification.");
      }

      logger.debug(`[classifyContent v3.2] Resposta crua da IA: ${rawResponse}`);

      // <<< MODIFICADO v3.2: Parsing e validação para os três campos >>>
      let format = defaultFormat;
      let proposal = defaultProposal;
      let context = defaultContext;

      try {
          const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
          if (!jsonMatch || !jsonMatch[0]) {
            logger.warn(`[classifyContent v3.2] Nenhum JSON válido encontrado na resposta da IA: ${rawResponse}`);
            throw new Error("Nenhum JSON válido encontrado na resposta da IA.");
          }

          const parsedResponse = JSON.parse(jsonMatch[0]);

          // Validação do Format
          if (parsedResponse.format && typeof parsedResponse.format === 'string' && VALID_FORMATS.includes(parsedResponse.format)) {
              format = parsedResponse.format;
          } else if (parsedResponse.format) {
              logger.warn(`[classifyContent v3.2] Formato inválido ou ausente recebido: '${parsedResponse.format}', usando default '${defaultFormat}'.`);
          } else {
               logger.warn(`[classifyContent v3.2] Chave 'format' ausente na resposta JSON, usando default '${defaultFormat}'.`);
          }

          // Validação do Proposal (Mantida)
          if (parsedResponse.proposal && typeof parsedResponse.proposal === 'string' && VALID_PROPOSALS.includes(parsedResponse.proposal)) {
              proposal = parsedResponse.proposal;
          } else if (parsedResponse.proposal) {
              logger.warn(`[classifyContent v3.2] Proposta inválida ou ausente recebida: '${parsedResponse.proposal}', usando default '${defaultProposal}'.`);
          } else {
               logger.warn(`[classifyContent v3.2] Chave 'proposal' ausente na resposta JSON, usando default '${defaultProposal}'.`);
          }

          // Validação do Context (Mantida)
          if (parsedResponse.context && typeof parsedResponse.context === 'string' && VALID_CONTEXTS.includes(parsedResponse.context)) {
              context = parsedResponse.context;
          } else if (parsedResponse.context) {
               logger.warn(`[classifyContent v3.2] Contexto inválido ou ausente recebido: '${parsedResponse.context}', usando default '${defaultContext}'.`);
          } else {
              logger.warn(`[classifyContent v3.2] Chave 'context' ausente na resposta JSON, usando default '${defaultContext}'.`);
          }

      } catch (parseError) {
          logger.error(`[classifyContent v3.2] Falha ao parsear JSON da resposta da IA: ${parseError}. Resposta: ${rawResponse}`);
          // Retorna defaults em caso de erro de parse
          return defaults;
      }

      const finalResult: ClassificationResult = { format, proposal, context };
      logger.info(`[classifyContent v3.2] Classificação final: ${JSON.stringify(finalResult)}`);
      return finalResult;

  } catch (error) {
      logger.error('[classifyContent v3.2] Erro geral ao chamar IA para classificação:', error);
      return defaults; // Retorna defaults em caso de erro geral
  }
}