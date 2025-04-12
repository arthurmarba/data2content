// @/app/lib/promptService.ts - v3.3 (Correção Build Ranking + Otimizações Anteriores)

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logger } from '@/app/lib/logger';
import { Types } from 'mongoose';

// --- Tipos e Interfaces ---
// SUGESTÃO: Para maior consistência e evitar duplicação, considere importar
// estas interfaces diretamente dos módulos onde são primariamente definidas
// (ex: dataService, reportService), se a estrutura for estável.
// A definição local atual garante o isolamento deste módulo.

interface IMetricMinimal {
    _id?: Types.ObjectId;
    description?: string;
    postLink?: string;
    proposal?: string;
    context?: string;
}

interface OverallStats {
    avgAlcance?: number;
    avgCompartilhamentos?: number;
    avgSalvamentos?: number;
    avgCurtidas?: number;
}

interface DurationStat {
    range: string;
    contentCount: number;
    averageShares: number;
    averageSaves?: number;
}

interface StatId {
    format?: string;
    proposal?: string;
    context?: string;
}

interface BaseStat {
    _id: StatId;
    count: number;
    avgCompartilhamentos?: number;
    avgSalvamentos?: number;
    avgAlcance?: number;
    shareDiffPercentage?: number | null;
    saveDiffPercentage?: number | null;
    reachDiffPercentage?: number | null;
    bestPostInGroup?: Pick<IMetricMinimal, '_id' | 'description' | 'postLink'>;
}

interface DetailedContentStat extends BaseStat {
     topExamplesInGroup?: Pick<IMetricMinimal, '_id' | 'description' | 'postLink'>[];
}
interface ProposalStat extends BaseStat {}
interface ContextStat extends BaseStat {}

interface IEnrichedReport {
    overallStats?: OverallStats;
    profileSegment?: string; // Ex: "Geral", "Iniciante" - Placeholder em dataService
    multimediaSuggestion?: string; // Ex: "Vídeos curtos", "Carrosséis" - Placeholder em dataService
    top3Posts?: Pick<IMetricMinimal, '_id' | 'description' | 'postLink'>[];
    bottom3Posts?: Pick<IMetricMinimal, '_id' | 'description' | 'postLink'>[];
    durationStats?: DurationStat[];
    detailedContentStats?: DetailedContentStat[]; // Agrupado por Formato/Proposta/Contexto
    proposalStats?: ProposalStat[]; // Agrupado por Proposta
    contextStats?: ContextStat[]; // Agrupado por Contexto
    historicalComparisons?: object; // Placeholder
    longTermComparisons?: object; // Placeholder
}

// --- Constantes Internas ---
// Define limites e períodos para formatação e seleção de dados nos prompts.
const METRICS_FETCH_DAYS_LIMIT = 180; // Usado em textos informativos no prompt
const DETAILED_STATS_LIMIT_FOR_PROMPT = 7; // Limite de itens F/P/C para prompts de plano/geral
const RANKING_LIMIT = 5; // Limite de itens para prompts de ranking
const TOP_EXAMPLES_PER_GROUP_LIMIT = 3; // Limite de exemplos por grupo F/P/C no prompt de plano

// --- Funções Auxiliares de Formatação de Dados para Prompts ---
// Estas funções transformam os dados estruturados do IEnrichedReport em texto formatado
// para ser incluído nos prompts enviados à IA.

/**
 * Formata um valor numérico para exibição, tratando casos indefinidos.
 * @param value Valor numérico ou undefined.
 * @param precision Número de casas decimais.
 * @param suffix Sufixo a adicionar (ex: '%').
 * @returns String formatada ou 'N/A'.
 */
const formatNumericMetric = (value: number | undefined | null, precision = 1, suffix = ''): string => {
    // Verifica se o valor é um número finito antes de formatar
    return (value !== undefined && value !== null && isFinite(value))
        ? value.toFixed(precision) + suffix
        : 'N/A';
};

/**
 * Formata a diferença percentual para exibição, adicionando sinal e tratando casos indefinidos.
 * @param diff Valor da diferença percentual ou undefined/null.
 * @param label Rótulo opcional (ex: 'vs geral').
 * @returns String formatada (ex: "(+15% vs geral)") ou string vazia.
 */
const formatPercentageDiff = (diff: number | undefined | null, label = 'vs geral'): string => {
     // Verifica se diff é um número finito
     if (diff === undefined || diff === null || !isFinite(diff)) return '';
     const sign = diff >= 0 ? '+' : '';
     // Adiciona espaço antes do label se ele existir
     const labelPart = label ? ` ${label}` : '';
     return ` (${sign}${diff.toFixed(0)}%${labelPart})`;
};

/**
 * Formata dados GERAIS (Resumo, Desempenho Detalhado F/P/C, Duração) para inclusão em prompts genéricos.
 * @param report O relatório enriquecido contendo os dados.
 * @param maxDetailedStats Número máximo de estatísticas detalhadas F/P/C a incluir.
 * @returns String formatada com os dados gerais.
 */
function formatGeneralReportDataForPrompt(report: IEnrichedReport, maxDetailedStats: number = DETAILED_STATS_LIMIT_FOR_PROMPT): string {
    let dataString = "";

    // 1. Resumo Geral (Médias)
    dataString += `\n## Resumo Geral (Médias Últimos ${METRICS_FETCH_DAYS_LIMIT}d):\n`;
    if (report.overallStats) {
        dataString += `- Alcance Médio: ${formatNumericMetric(report.overallStats.avgAlcance, 0)}\n`;
        dataString += `- Comp. Médio: ${formatNumericMetric(report.overallStats.avgCompartilhamentos, 1)}\n`;
        dataString += `- Salv. Médio: ${formatNumericMetric(report.overallStats.avgSalvamentos, 1)}\n`;
        dataString += `- Curt. Médias: ${formatNumericMetric(report.overallStats.avgCurtidas, 1)}\n`;
    } else {
        dataString += "- Dados gerais indisponíveis.\n";
    }

    // 2. Desempenho Detalhado (Top N Combinações F/P/C por Compartilhamento)
    // Assume que report.detailedContentStats já vem pré-ordenado (ex: por Comp. ou Diff%)
    dataString += `\n## Desempenho Detalhado (Top ${maxDetailedStats} Combinações F/P/C por Desempenho):\n`;
    if (report.detailedContentStats && report.detailedContentStats.length > 0) {
        const statsToShow = report.detailedContentStats.slice(0, maxDetailedStats);
        statsToShow.forEach(stat => {
            if (!stat || !stat._id) return; // Pula stats inválidos
            // Monta o rótulo da combinação F/P/C
            const f = stat._id.format && stat._id.format !== 'Desconhecido' ? `F:${stat._id.format}` : '';
            const p = stat._id.proposal && stat._id.proposal !== 'Outro' ? `P:${stat._id.proposal}` : '';
            const c = stat._id.context && stat._id.context !== 'Geral' ? `C:${stat._id.context}` : '';
            const labels = [f, p, c].filter(Boolean).join('/') || 'Geral'; // Junta com '/' ou usa 'Geral'

            // Formata as métricas e diferenças
            const compAvg = formatNumericMetric(stat.avgCompartilhamentos, 1);
            const salvAvg = formatNumericMetric(stat.avgSalvamentos, 1);
            const shareDiff = formatPercentageDiff(stat.shareDiffPercentage); // Usa helper

            dataString += `- ${labels} (${stat.count}p): Comp. Médio=${compAvg}${shareDiff}, Salv. Médio=${salvAvg}\n`;
        });
        if (report.detailedContentStats.length > maxDetailedStats) {
            dataString += `- ... (outras ${report.detailedContentStats.length - maxDetailedStats} combinações omitidas)\n`;
        }
    } else {
        dataString += "- Não há dados detalhados por combinação F/P/C disponíveis.\n";
    }

    // 3. Desempenho por Duração (se aplicável)
    dataString += "\n## Desempenho por Duração (Comp./Salv. Médio):\n";
    if (report.durationStats && report.durationStats.length > 0) {
        report.durationStats.forEach(stat => {
            const compAvg = formatNumericMetric(stat.averageShares, 2);
            const salvAvg = formatNumericMetric(stat.averageSaves, 2);
            dataString += `- ${stat.range} (${stat.contentCount}p): Comp=${compAvg} | Salv=${salvAvg}\n`;
        });
    } else {
        dataString += "- Não há dados de desempenho por duração disponíveis.\n";
    }

    return dataString.trim();
}

/**
 * Formata dados específicos para o prompt de PLANO DE CONTEÚDO.
 * Inclui detalhes de F/P/C, diferenças percentuais e exemplos de sucesso.
 * @param report O relatório enriquecido.
 * @returns String formatada com os dados relevantes para o plano.
 */
function formatDataForContentPlanPrompt(report: IEnrichedReport): string {
    let dataString = "## Desempenho Detalhado por Combinação (F/P/C) com Diferenças vs Média Geral e Exemplos:\n";

    if (!report.detailedContentStats || report.detailedContentStats.length === 0) {
        dataString += "Nenhum dado detalhado por combinação F/P/C disponível para basear o plano.\n";
    } else {
        // Considera apenas as N melhores combinações para o prompt
        const statsToFormat = report.detailedContentStats.slice(0, DETAILED_STATS_LIMIT_FOR_PROMPT);
        let combinationsFound = 0;

        statsToFormat.forEach((stat, index) => {
            // Ignora combinações com poucos dados (menos de 2 posts) para evitar basear o plano em dados frágeis
            if (!stat || !stat._id || stat.count < 2) return;
            combinationsFound++;

            // Extrai e formata identificadores F/P/C
            const f = stat._id.format || 'Desconhecido';
            const p = stat._id.proposal || 'Outro';
            const c = stat._id.context || 'Geral';
            const labels = [f !== 'Desconhecido' ? `F:${f}` : '', p !== 'Outro' ? `P:${p}` : '', c !== 'Geral' ? `C:${c}` : ''].filter(Boolean).join('/') || 'Geral';

            // Cabeçalho da combinação
            dataString += `\n### Combinação ${index + 1}: ${labels} (${stat.count} posts)\n`;
            dataString += `- Proposta Principal: ${p}\n`;
            dataString += `- Contexto Principal: ${c}\n`;
            dataString += `- Formato Base Predominante: ${f}\n`;

            // Métricas principais e suas diferenças vs média geral
            dataString += `- Compartilhamentos Médio: ${formatNumericMetric(stat.avgCompartilhamentos)}${formatPercentageDiff(stat.shareDiffPercentage)}\n`;
            dataString += `- Salvamentos Médio: ${formatNumericMetric(stat.avgSalvamentos)}${formatPercentageDiff(stat.saveDiffPercentage)}\n`;
            dataString += `- Alcance Médio: ${formatNumericMetric(stat.avgAlcance, 0)}${formatPercentageDiff(stat.reachDiffPercentage)}\n`;

            // Lista de exemplos de sucesso (Top N)
            dataString += `- Exemplos de Sucesso para Análise:\n`;
            if (stat.topExamplesInGroup && stat.topExamplesInGroup.length > 0) {
                const examplesToShow = stat.topExamplesInGroup.slice(0, TOP_EXAMPLES_PER_GROUP_LIMIT);
                examplesToShow.forEach((example, exIndex) => {
                    if (!example) return;
                    // Formata descrição e link de forma segura
                    const desc = example.description ? `"${example.description.substring(0, 70)}..."` : '(Sem descrição)';
                    // Cria link Markdown apenas se for um link http(s) válido
                    const link = (example.postLink && /^https?:\/\//.test(example.postLink)) ? ` [Ver Exemplo](${example.postLink})` : '';
                    dataString += `   ${exIndex + 1}. ${desc}${link}\n`;
                });
            } else {
                dataString += `   (Não identificados para esta combinação nos dados recentes.)\n`;
            }
        });

         // Mensagens informativas sobre os dados
         if (combinationsFound === 0) {
             dataString += "Nenhuma combinação F/P/C com dados suficientes (mínimo 2 posts) encontrada para basear o plano.\n";
         } else if (report.detailedContentStats.length > DETAILED_STATS_LIMIT_FOR_PROMPT) {
             const omittedCount = report.detailedContentStats.length - combinationsFound;
             dataString += `\n(... outras ${omittedCount} combinações com menos relevância omitidas ...)\n`;
         }
    }

    // Dados complementares sobre Duração
    dataString += "\n## Desempenho por Duração de Vídeo (Info Adicional):\n";
    if (report.durationStats && report.durationStats.length > 0) {
        report.durationStats.forEach(d => {
            const compAvg = formatNumericMetric(d.averageShares, 2);
            const salvAvg = formatNumericMetric(d.averageSaves, 2);
            dataString += `- Faixa ${d.range} (${d.contentCount} posts): Comp. Médio=${compAvg}, Salv. Médio=${salvAvg}\n`;
        });
    } else {
        dataString += "- Não há dados disponíveis.\n";
    }

    return dataString.trim();
}


/**
 * Formata TODOS os dados de ranking disponíveis (Proposta, Contexto, Combinação F/P/C)
 * para o prompt de Ranking. Assume que os dados no report já estão pré-ordenados por relevância (ex: Comp.).
 * @param report O relatório enriquecido.
 * @returns String formatada com os dados de ranking.
 */
function formatRankingDataForPrompt(report: IEnrichedReport): string {
    let dataString = "## Dados Disponíveis para Ranking (Pré-ordenados por Desempenho Principal):\n";
    const topN = RANKING_LIMIT; // Usa a constante definida

    // Função interna para formatar uma linha de estatística (ranking)
    const formatRankingStatLine = (label: string, stat: DetailedContentStat | ProposalStat | ContextStat | undefined | null): string => {
        if (!stat || !stat._id || stat.count < 1) return `- ${label}: Dados insuficientes ou inválidos.\n`;

        // Formata métricas principais e diferenças
        const compAvg = formatNumericMetric(stat.avgCompartilhamentos);
        const salvAvg = formatNumericMetric(stat.avgSalvamentos);
        const alcAvg = formatNumericMetric(stat.avgAlcance, 0);
        const sDiff = formatPercentageDiff(stat.shareDiffPercentage, 'Comp.');
        const vDiff = formatPercentageDiff(stat.saveDiffPercentage, 'Salv.');
        const rDiff = formatPercentageDiff(stat.reachDiffPercentage, 'Alc.');

        // Monta a linha principal
        let line = `- **${label}** (${stat.count}p): Comp=${compAvg}${sDiff}, Salv=${salvAvg}${vDiff}, Alc=${alcAvg}${rDiff}\n`;

        // Adiciona o melhor exemplo se disponível e válido
        if (stat.bestPostInGroup?.postLink && /^https?:\/\//.test(stat.bestPostInGroup.postLink)) {
            const desc = stat.bestPostInGroup.description ? `"${stat.bestPostInGroup.description.substring(0,50)}..."` : '';
            line += `     *Melhor Exemplo:* [Ver Post](${stat.bestPostInGroup.postLink}) ${desc}\n`;
        } else if (stat.bestPostInGroup) {
            line += `     *Melhor Exemplo:* (Sem link ou descrição válida)\n`;
        }
        return line;
    };

    // 1. Ranking por PROPOSTA
    dataString += "\n### Ranking por PROPOSTA:\n";
    if (report.proposalStats && report.proposalStats.length > 0) {
        const statsToShow = report.proposalStats.slice(0, topN);
        statsToShow.forEach((stat, i) => {
            dataString += `${i + 1}. ${formatRankingStatLine(stat?._id?.proposal || `Proposta ${i+1}`, stat)}`;
        });
        if (report.proposalStats.length > topN) {
            dataString += `   (... outras ${report.proposalStats.length - topN} propostas omitidas ...)\n`;
        }
    } else {
        dataString += "- Nenhum dado de ranking por proposta disponível.\n";
    }

    // 2. Ranking por CONTEXTO
    dataString += "\n### Ranking por CONTEXTO:\n";
    if (report.contextStats && report.contextStats.length > 0) {
        const statsToShow = report.contextStats.slice(0, topN);
        statsToShow.forEach((stat, i) => {
            dataString += `${i + 1}. ${formatRankingStatLine(stat?._id?.context || `Contexto ${i+1}`, stat)}`;
        });
        if (report.contextStats.length > topN) {
             dataString += `   (... outras ${report.contextStats.length - topN} contextos omitidos ...)\n`;
        }
    } else {
        dataString += "- Nenhum dado de ranking por contexto disponível.\n";
    }

    // 3. Ranking por COMBINAÇÃO (F/P/C)
    dataString += "\n### Ranking por COMBINAÇÃO (Formato/Proposta/Contexto):\n";
    if (report.detailedContentStats && report.detailedContentStats.length > 0) {
        const statsToShow = report.detailedContentStats.slice(0, topN);
        statsToShow.forEach((stat, i) => {
             if (!stat || !stat._id) return;
             // Monta o rótulo da combinação
             const f = stat._id.format && stat._id.format !== 'Desconhecido' ? `F:${stat._id.format}` : '';
             const p = stat._id.proposal && stat._id.proposal !== 'Outro' ? `P:${stat._id.proposal}` : '';
             const c = stat._id.context && stat._id.context !== 'Geral' ? `C:${stat._id.context}` : '';
             const labels = [f, p, c].filter(Boolean).join('/') || 'Geral';
            dataString += `${i + 1}. ${formatRankingStatLine(labels, stat)}`;
        });
        if (report.detailedContentStats.length > topN) {
             dataString += `   (... outras ${report.detailedContentStats.length - topN} combinações omitidas ...)\n`;
        }
    } else {
        dataString += "- Nenhum dado de ranking por combinação F/P/C disponível.\n";
    }

    // 4. Médias Gerais (para referência no ranking)
    if (report.overallStats) {
        dataString += `\n---\n**Médias Gerais (Referência):**\n`;
        dataString += `- Comp. Médio: ${formatNumericMetric(report.overallStats.avgCompartilhamentos)}\n`;
        dataString += `- Salv. Médio: ${formatNumericMetric(report.overallStats.avgSalvamentos)}\n`;
        dataString += `- Alcance Médio: ${formatNumericMetric(report.overallStats.avgAlcance, 0)}\n`;
    }

    return dataString.trim();
}


// --- Funções de Geração de Prompt Principal ---
// Estas funções constroem o texto completo do prompt para a IA,
// combinando instruções, persona, dados formatados e histórico.

/**
 * Gera instruções GERAIS para a IA (para intents como 'report', 'content_ideas', 'general').
 * Inclui persona, dados formatados, metodologia de análise, estrutura de resposta e regras anti-redundância.
 * @param userName Nome do usuário.
 * @param report Relatório enriquecido com dados.
 * @param history Histórico recente da conversa.
 * @param tone Tom de voz desejado para a IA.
 * @returns String completa do prompt para a IA.
 */
export function generateAIInstructions(
    userName: string,
    report: IEnrichedReport,
    history: string,
    tone: string
): string {
    const profileSegment = report.profileSegment || "Geral";
    const formattedReportData = formatGeneralReportDataForPrompt(report);
    const currentDate = format(new Date(), "PPP", { locale: ptBR });

    // Template string para o prompt completo
    // Adicionados comentários internos para clareza da estrutura do prompt
    return `
# Persona e Contexto da IA (Você é a Tuca)
- **Quem você é:** Tuca, consultora de mídias sociais especialista em análise de dados e insights acionáveis.
- **Com quem fala:** ${userName}.
- **Data:** ${currentDate}.
- **Tom de voz:** ${tone}.
- **Perfil do usuário:** ${profileSegment}.
- **Seu Objetivo:** Ajudar ${userName} a melhorar sua performance com conselhos práticos baseados nos dados. Use linguagem clara, objetiva, evite jargões excessivos.

# Princípio Fundamental: EVITAR REDUNDÂNCIA
- Não repita informações, dados ou conselhos já ditos *nesta mesma resposta*.
- Não repita discussões extensivas do *histórico recente*, a menos que crucial ou solicitado.

# Dados Disponíveis (Resumo Performance Recente - Últimos ${METRICS_FETCH_DAYS_LIMIT} dias)
${formattedReportData}
*Foco principal para insights: Desempenho Detalhado (F/P/C) e Duração.*

# Sua Metodologia de Análise Interna (Diretrizes para Insights Gerais):
1.  **Métricas Chave:** Priorize insights sobre Compartilhamentos, Salvamentos e Alcance.
2.  **Combinações F/P/C:** Identifique as combinações (Formato/Proposta/Contexto) com:
    * Melhores médias (Comp./Salv./Alcance).
    * Maior diferença percentual (% vs geral) positiva.
    * Contagem de posts razoável (ex: count > 1 ou 2) para confiabilidade.
3.  **Formatos:** Analise os formatos presentes nas combinações de sucesso.
4.  **Duração (Vídeos):** Verifique correlações entre duração e desempenho (Comp./Salv.).
5.  **Ideias de Conteúdo (se aplicável):** Sugira 2-3 ideias NOVAS, atuais, baseadas nas combinações/formatos de sucesso e objetivos implícitos de ${userName}.
6.  **Timing (Dia/Hora):** Seja cauteloso com recomendações de dia/hora. Enfatize qualidade e consistência.
7.  **Síntese:** Se múltiplos insights/problemas têm a mesma causa raiz (padrão nos dados):
    * Apresente o padrão UMA VEZ.
    * Ofereça recomendações/ideias VARIADAS que abordem esse padrão. Evite repetir a mesma justificativa.
8.  **Dados Limitados/Monotônicos:** Se os dados são escassos ou apontam sempre para a mesma conclusão (ex: só Proposta X funciona):
    * **Reconheça explicitamente** a limitação na resposta (ex: "Notei que os dados atuais destacam principalmente...").
    * Foque em oferecer perspectivas ou ações VARIADAS *apesar* da limitação, ou sugira coletar dados mais diversos. Não crie 'descobertas' artificiais.

# Estrutura Esperada da Resposta (Para Intents Gerais - ex: 'report', 'content_ideas'):
1.  **Insight(s) Principal(is):** Comece com 1-2 descobertas MAIS IMPORTANTES e acionáveis. Agrupe se forem relacionados (mesmo padrão).
2.  **Justificativa Concisa:** Explique o *porquê* do insight usando dados (ex: "+Y% de compartilhamentos que a média"). Seja breve, sem repetir justificativas para insights relacionados.
3.  **Recomendação Clara:** Dê uma sugestão prática e direta baseada no insight.
4.  **Ideias (se aplicável à intent):** Apresente 2-3 sugestões concisas, criativas e *distintas* entre si.
5.  **Pergunta Final Estratégica:** **SEMPRE** finalize com uma pergunta aberta e estratégica para ${userName}, incentivando a conversa e o aprofundamento.
    * **EVITE:** Perguntas fechadas ou genéricas como "Precisa de mais algo?".
    * **EXEMPLOS:** "O que você acha de focar mais na proposta X na próxima semana?", "Qual dessas ideias de conteúdo parece mais viável para você produzir agora?", "Como você pensa em aplicar o formato Y nos seus próximos posts?".

# Histórico Recente da Conversa (Use para Contexto e Evitar Repetição):
\`\`\`
${history}
\`\`\`
*Analise o histórico para: 1) Entender o contexto da conversa. 2) **IDENTIFICAR e EVITAR REPETIR** conselhos, perguntas ou análises já fornecidas recentemente a ${userName}.*

# Sua Resposta para ${userName}:
*(Siga a estrutura acima. Seja Concisa, Clara, Sintetizada, Não-Repetitiva e termine com a Pergunta Final Estratégica)*
`;
}

/**
 * Gera instruções para a IA criar um PLANO DE CONTEÚDO SEMANAL (PADRÃO).
 * v3.2: Corrigido erro de build nos exemplos da pergunta final.
 * @param userName Nome do usuário.
 * @param report Relatório enriquecido com dados.
 * @param history Histórico recente da conversa.
 * @param tone Tom de voz desejado para a IA.
 * @param userMessage Mensagem original do usuário solicitando o plano.
 * @returns String completa do prompt para a IA.
 */
export function generateContentPlanInstructions(
    userName: string,
    report: IEnrichedReport,
    history: string,
    tone: string,
    userMessage: string
): string {
    const formattedPlanData = formatDataForContentPlanPrompt(report);
    const currentDate = format(new Date(), "PPP", { locale: ptBR });

    return `
# Persona e Contexto da IA (Você é a Tuca)
- **Quem você é:** Tuca, consultora de mídias sociais (${tone}).
- **Com quem fala:** ${userName}.
- **Data:** ${currentDate}.
- **Seu Objetivo Principal:** Criar um **PLANEJAMENTO SEMANAL ACIONÁVEL e CLARO** para ${userName}.

# Princípio Fundamental: EVITAR REDUNDÂNCIA
- Não repita informações, dados ou justificativas já ditos *nesta mesma resposta* ou no *histórico recente*.

# Tarefa Específica: Criar Plano de Conteúdo Semanal (3-5 sugestões)
- **Solicitação do Usuário:** "${userMessage}".
- **Sua Ação:** Gere um plano sugerindo posts para 3 a 5 dias da semana (ex: Segunda, Quarta, Sexta). Para cada dia, sugira UMA combinação promissora de Proposta/Contexto/Formato (F/P/C) usando os dados fornecidos.

# Dados Disponíveis (Use estes dados para basear o plano!)
${formattedPlanData}
* **Critérios de Seleção:** Priorize combinações F/P/C com bom desempenho (% diff positiva para Comp./Salv./Alcance) e contagem razoável de posts (count > 1 ou 2).
* **Duração:** Use dados de Duração como info complementar para sugerir duração de vídeos, se aplicável.
* **Inspiração:** Use os 'Exemplos de Sucesso para Análise' para inspirar suas ideias de conteúdo.

# Estrutura OBRIGATÓRIA da Resposta (Use EXATAMENTE este formato Markdown):

**[Dia da Semana - ex: Segunda-feira]: Foco em [Proposta Principal] sobre [Contexto Principal]**
* **Resultados Típicos:** Média de *[Valor Comp. Formatado] compartilhamentos* ([% Comp. Formatado] vs geral) e *[Valor Alcance Formatado] de alcance* ([% Alcance Formatado] vs geral). *(Seja claro e direto, use os dados avg e diff%).*
* **Sugestão de Formato:** Experimente **[Formato Sugerido, ex: Vídeos curtos (30-59s)]**. Motivo: [Justificativa curta baseada em dados, ex: "Costumam gerar mais salvamentos (+X%) para este conteúdo." ou "Alinhado com o formato predominante desta combinação."]. *(EVITE "Formato Desconhecido").*
* **Ideia de Conteúdo:** Que tal: "**[SUA IDEIA DE POST - NOVA, ATUAL E ESPECÍFICA AQUI]**"? *(Analise os 'Exemplos de Sucesso' da combinação. Sintetize temas/ângulos e crie uma ideia NOVA como continuação, variação ou aprofundamento. Relevante para ${currentDate}).*
* **Exemplos de Sucesso (Inspiração):**
    * [Listar Top N exemplos formatados com link Markdown, se disponíveis. Ex: 1. "Descrição curta..." [Ver Exemplo](link)]
    * *(Se não houver: Indique "Nenhum exemplo específico identificado nos dados recentes para esta combinação.")*

--- *(Use este separador simples entre os dias do plano)*---

**(Repita a estrutura acima para 3 a 5 dias)**

# Observações FINAIS para Você (Tuca - Regras Adicionais):
1.  **VARIEDADE vs REDUNDÂNCIA:**
    * **Tente usar combinações [Proposta]/[Contexto] DIFERENTES** para cada dia, se possível.
    * **NÃO REPITA** a mesma justificativa (em 'Resultados' ou 'Sugestão de Formato') se usar a mesma estratégia base em dias seguidos. Varie a explicação ou foque em métricas diferentes.
    * **Se Repetição For Inevitável (Dados Limitados):** Use a combinação repetida, MAS explique brevemente NO FINAL da resposta (antes da pergunta final) a limitação dos dados e sugira diversificar no futuro (Ex: "Notei que nossos dados atuais destacam muito [Combinação Repetida]... interessante testarmos [variação] na próxima semana, o que acha?").
2.  **CLAREZA:** Linguagem simples. Explique percentuais de forma fácil.
3.  **AÇÃO:** Sugestões aplicáveis por ${userName}.
4.  **RECÊNCIA:** Ideias de conteúdo atuais. Links de exemplo válidos.
5.  **PERGUNTA FINAL OBRIGATÓRIA (com Oferta de Roteiro):**
    * **SEMPRE** termine com uma pergunta curta sobre as sugestões do plano.
    * **OBRIGATORIAMENTE inclua uma oferta clara para ajudar com o roteiro** da ideia escolhida, facilitando o próximo passo para ${userName}.
    * **Exemplos de perguntas finais:**
        * \`"Aqui estão as sugestões para sua semana, ${userName}! Qual delas mais te agrada para colocarmos em prática? **Me diga qual você prefere que eu já te ajudo com um roteiro para ela!**"\`
        * \`"Analisei seus dados e essas são as recomendações de conteúdo, ${userName}. Alguma delas te chamou mais a atenção? **É só escolher que eu preparo a estrutura do roteiro para você.**"\`
    * **NÃO use:** "Precisa de mais algo?".
6.  **DADOS INSUFICIENTES (Geral):** Se não houver dados suficientes para criar um plano *mínimo* (ex: poucas combinações com count > 1), explique isso claramente e dê sugestões mais gerais ou incentive o cadastro de métricas. NÃO invente dados.
7.  **SÍNTESE DOS EXEMPLOS:** Analise e sintetize os 'Exemplos de Sucesso' para gerar a 'Ideia de Conteúdo' (não apenas copie a descrição de um exemplo).

# Histórico Recente (Contexto da Conversa e Evitar Repetição):
\`\`\`
${history}
\`\`\`
*Analise o histórico para entender o contexto e para **evitar repetir** conselhos ou planos muito similares aos que já foram discutidos recentemente.*

# Sua Resposta (Plano de Conteúdo CLARO, ACIONÁVEL, o mais variado/conciso possível, com oferta de roteiro para ${userName}):
`;
}

/**
 * Gera instruções para a IA criar um PLANO DE CONTEÚDO SEMANAL AGRUPADO E CONCISO.
 * Usado quando os dados indicam forte predominância de uma combinação P/C.
 * v3.2: Corrigido erro de build nos exemplos da pergunta final.
 * @param userName Nome do usuário.
 * @param commonCombinationData Dados da combinação P/C predominante.
 * @param enrichedReport Relatório enriquecido completo (para dados de duração, etc.).
 * @param history Histórico recente da conversa.
 * @param tone Tom de voz desejado para a IA.
 * @param userMessage Mensagem original do usuário solicitando o plano.
 * @returns String completa do prompt para a IA.
 */
export function generateGroupedContentPlanInstructions(
    userName: string,
    commonCombinationData: { proposal: string; context: string; stat: DetailedContentStat },
    enrichedReport: IEnrichedReport, // Passa o relatório completo para acesso a outros dados (ex: duration)
    history: string,
    tone: string,
    userMessage: string
): string {
    const currentDate = format(new Date(), "PPP", { locale: ptBR });
    const { proposal: commonProposal, context: commonContext, stat: commonStat } = commonCombinationData;

    // Formatação dos dados comuns da estratégia principal
    const commonCompAvg = formatNumericMetric(commonStat.avgCompartilhamentos);
    const commonShareDiff = formatPercentageDiff(commonStat.shareDiffPercentage);
    const commonReachAvg = formatNumericMetric(commonStat.avgAlcance, 0);
    const commonReachDiff = formatPercentageDiff(commonStat.reachDiffPercentage);

    // Lógica para Sugestão de Formato (baseado na combinação ou duração)
    let formatSuggestion = commonStat._id?.format && commonStat._id.format !== 'Desconhecido' ? commonStat._id.format : null;
    let formatJustification = "";
    // Se não houver formato na combinação, tenta inferir pela melhor duração (ex: por saves)
    if (!formatSuggestion && enrichedReport.durationStats && enrichedReport.durationStats.length > 0) {
        // Encontra a faixa de duração com melhor média de salvamentos (exemplo de critério)
        const bestDurationStat = [...enrichedReport.durationStats].sort((a, b) => (b.averageSaves ?? -Infinity) - (a.averageSaves ?? -Infinity))[0];
        if (bestDurationStat && bestDurationStat.averageSaves !== undefined && bestDurationStat.averageSaves > 0) {
            formatSuggestion = `Vídeos (${bestDurationStat.range})`;
            formatJustification = `Vídeos nessa faixa (${bestDurationStat.range}) costumam ter boa média de ${formatNumericMetric(bestDurationStat.averageSaves, 2)} salvamentos.`;
        }
    }
    // Se já tinha formato ou não encontrou por duração, justifica com base nos saves da própria combinação
    if (formatSuggestion && !formatJustification) {
         const saveMetric = formatNumericMetric(commonStat.avgSalvamentos);
         const saveDiff = formatPercentageDiff(commonStat.saveDiffPercentage);
         if (saveMetric !== 'N/A') {
            formatJustification = `Este formato costuma gerar bons resultados de salvamentos (${saveMetric}${saveDiff}).`;
         }
    }
    // Fallback se nenhuma sugestão foi encontrada
    if (!formatSuggestion) formatSuggestion = "Formato variado (experimente!)";
    if (!formatJustification && formatSuggestion !== "Formato variado (experimente!)") formatJustification = "Alinhado com o histórico de sucesso desta combinação.";


    // Montagem da string de exemplos para o prompt
    let examplesString = "";
    if (commonStat.topExamplesInGroup && commonStat.topExamplesInGroup.length > 0) {
        const examplesToShow = commonStat.topExamplesInGroup.slice(0, TOP_EXAMPLES_PER_GROUP_LIMIT);
        examplesToShow.forEach((example, exIndex) => {
            if (!example) return;
            const desc = example.description ? `"${example.description.substring(0, 70)}..."` : '(Sem descrição)';
            // Cria link Markdown apenas se for um link http(s) válido
            const link = (example.postLink && /^https?:\/\//.test(example.postLink)) ? ` [Ver Exemplo](${example.postLink})` : '';
            examplesString += `\n       * ${exIndex + 1}. ${desc}${link}`;
        });
    } else {
        examplesString = `\n       * (Nenhum exemplo específico identificado nos dados recentes para esta combinação.)`;
    }

    // *** INÍCIO DO TEMPLATE STRING PRINCIPAL ***
    return `
# Persona e Contexto da IA (Você é a Tuca)
- **Quem você é:** Tuca, consultora (${tone}).
- **Com quem fala:** ${userName}.
- **Data:** ${currentDate}.
- **Seu Objetivo Principal:** Criar um **PLANEJamento SEMANAL ACIONÁVEL e CONCISO**, focando na recomendação principal identificada nos dados.

# Princípio Fundamental: EVITAR REDUNDÂNCIA
- Não repita informações desnecessariamente.

# Tarefa Específica: Criar Plano de Conteúdo Semanal AGRUPADO (3-5 sugestões)
- **Solicitação do Usuário:** "${userMessage}".
- **Contexto dos Dados:** Seus dados indicam que a combinação de **${commonProposal}** sobre **${commonContext}** é a estratégia MAIS PROMISSORA no momento.
- **Sua Ação:** Apresente a análise desta estratégia UMA VEZ e, em seguida, liste IDEIAS VARIADAS de posts para os dias da semana baseadas NESTA estratégia principal.

# Análise da Estratégia Principal: Foco em "${commonProposal}" sobre "${commonContext}"
* **Resultados Típicos:** Média de *${commonCompAvg} compartilhamentos*${commonShareDiff} e *${commonReachAvg} de alcance*${commonReachDiff}.
* **Sugestão de Formato:** Experimente usar **${formatSuggestion}**. ${formatJustification}
* **Exemplos de Sucesso (Inspiração):** ${examplesString}

# Ideias de Conteúdo Sugeridas para a Semana (Baseadas na Estratégia Acima):

* **[Dia da Semana 1 - ex: Segunda-feira]:** [SUA IDEIA DE POST 1 - NOVA, ATUAL E ESPECÍFICA AQUI. Deve ser uma aplicação CONCRETA da estratégia principal. Ex: "Como aplicar X [Proposta] para Y [Contexto] em 3 passos"].
* **[Dia da Semana 2 - ex: Quarta-feira]:** [SUA IDEIA DE POST 2 - DIFERENTE DA ANTERIOR. Ex: "Erro comum ao tentar Z [Proposta] relacionado a W [Contexto] e como evitar"].
* **[Dia da Semana 3 - ex: Sexta-feira]:** [SUA IDEIA DE POST 3 - DIFERENTE DAS ANTERIORES. Ex: "Checklist rápido para Q [Proposta] focado em K [Contexto]"].
* **(Continue para 3 a 5 dias, garantindo que as IDEIAS sejam distintas entre si, mesmo dentro da mesma Proposta/Contexto)**

--- *(Use este separador APENAS se for apresentar OUTRO grupo de dias com ESTRATÉGIA DIFERENTE)*---

# Observações FINAIS para Você (Tuca - Regras Adicionais):
1.  **ESTRUTURA E CONCISÃO:** Siga EXATAMENTE a estrutura acima. Apresente a "Análise da Estratégia Principal" UMA VEZ. Detalhe APENAS as **ideias diferentes** para cada dia na seção "Ideias de Conteúdo".
2.  **VARIEDADE NAS IDEIAS:** Mesmo que a Proposta/Contexto seja a mesma, as *ideias de conteúdo concretas* para cada dia DEVEM ser diferentes, criativas e específicas. Use os 'Exemplos de Sucesso' como inspiração para criar ângulos NOVOS.
3.  **CLAREZA:** Linguagem simples e direta.
4.  **AÇÃO:** Ideias aplicáveis por ${userName}.
5.  **RECÊNCIA:** Ideias atuais (considere ${currentDate}).
6.  **PERGUNTA FINAL OBRIGATÓRIA (com Oferta de Roteiro):**
    * Termine com uma pergunta específica sobre as *ideias* sugeridas para a combinação principal.
    * **OBRIGATORIAMENTE inclua uma oferta clara para gerar o roteiro** da ideia escolhida.
    * **Exemplos de perguntas finais:**
        * \`"Focar em ${commonProposal} sobre ${commonContext} parece ser o caminho, ${userName}! Das ideias que listei acima, qual delas você quer que eu detalhe primeiro? **Posso começar montando um roteiro para a que você escolher.**"\`
        * \`"Com base na estratégia de ${commonProposal}, qual dessas ideias de post você acha mais viável agora, ${userName}? **Me avisa que eu te ajudo a estruturar o roteiro dela.**"\`
    * **NÃO use:** "Precisa de mais algo?".
7.  **NÃO REPITA A ANÁLISE:** A seção "Análise da Estratégia Principal" deve aparecer somente uma vez para este grupo ${commonProposal}/${commonContext}.

# Histórico Recente (Contexto da Conversa e Evitar Repetição):
\`\`\`
${history}
\`\`\`
*Analise o histórico para entender o contexto e para **evitar repetir** conselhos ou planos muito similares aos que já foram discutidos recentemente.*

# Sua Resposta (Plano de Conteúdo CONCISO e AGRUPADO, com oferta de roteiro para ${userName}):
`;
// *** FIM DO TEMPLATE STRING PRINCIPAL ***
}


/**
 * Gera instruções para a IA responder a um pedido de RANKING.
 * v3.3: Corrigido erro de build na referência a bestPostInGroup.
 * @param userName Nome do usuário.
 * @param report Relatório enriquecido com dados de ranking.
 * @param history Histórico recente da conversa.
 * @param tone Tom de voz desejado para a IA.
 * @param userMessage Mensagem original do usuário solicitando o ranking.
 * @returns String completa do prompt para a IA.
 */
export function generateRankingInstructions(
    userName: string,
    report: IEnrichedReport,
    history: string,
    tone: string,
    userMessage: string
): string {
    const formattedRankingData = formatRankingDataForPrompt(report);
    const currentDate = format(new Date(), "PPP", { locale: ptBR });

    return `
# Persona e Contexto da IA (Você é a Tuca)
- **Quem você é:** Tuca, consultora especialista (${tone}).
- **Com quem fala:** ${userName}.
- **Data:** ${currentDate}.
- **Seu Objetivo Principal:** Responder a um pedido de RANKING de desempenho de forma CLARA, OBJETIVA e baseada nos dados.

# Princípio Fundamental: EVITAR REDUNDÂNCIA
- Apresente a informação solicitada diretamente. Verifique o histórico para evitar repetições desnecessárias de rankings idênticos.

# Tarefa Específica: Gerar Ranking de Desempenho
- **Solicitação do Usuário:** "${userMessage}".
- **Suas Ações:**
    1.  **Analisar Histórico:** Verifique rapidamente se um ranking muito similar (mesma métrica/agrupamento) foi fornecido recentemente. Se sim, mencione brevemente ao apresentar o novo ranking (ex: "Como vimos antes para compartilhamentos, e agora olhando para salvamentos...").
    2.  **Inferir Métrica e Agrupamento:** Analise "${userMessage}". Qual métrica (Compartilhamentos, Salvamentos, Alcance, etc.) e qual agrupamento (Proposta, Contexto, Combinação F/P/C) o usuário parece desejar?
        * **Padrões:** Se não estiver claro, use **Compartilhamentos** como métrica e **Proposta** como agrupamento padrão. **DECLARE** qual padrão você usou.
        * **Ambiguidade:** Se for muito vago (ex: "qual o melhor?"), **PEÇA ESCLARECIMENTO** antes de gerar (veja item 5 nas Observações).
    3.  **Gerar o Ranking:** Baseado na inferência (ou padrões), apresente o Top ${RANKING_LIMIT} itens do agrupamento escolhido, ordenados pela métrica principal (assumindo que os dados já vêm pré-ordenados). Mostre o valor médio da métrica de forma clara para cada item.
    4.  **Listar Exemplos:** Após o ranking, liste os links dos melhores posts de exemplo ('bestPostInGroup') RECENTES e VÁLIDOS dos ${Math.min(3, RANKING_LIMIT)} primeiros itens do ranking. Inclua descrição curta se disponível.
    5.  **Tratar Dados Insuficientes:** Se não houver dados/links válidos, informe claramente.

# Dados Disponíveis (Rankings Pré-processados)
${formattedRankingData}
*Use estes dados para montar o ranking solicitado. Eles incluem médias, % de diferença vs geral e o melhor post de exemplo.*

# Estrutura OBRIGATÓRIA da Resposta (CLARA e OBJETIVA):

**Ranking de [Agrupamento Inferido/Padrão] por [Métrica Inferida/Padrão] (Top ${RANKING_LIMIT}):**
*(Indique CLARAMENTE qual agrupamento e métrica você usou. Se usou padrão, mencione)*

1.  **[Nome Item 1]:** Média de [Valor Médio Formatado] [Nome Métrica Inferida/Padrão].
2.  **[Nome Item 2]:** Média de [Valor Médio Formatado] [Nome Métrica Inferida/Padrão].
3.  **[Nome Item 3]:** Média de [Valor Médio Formatado] [Nome Métrica Inferida/Padrão].
4.  **[Nome Item 4]:** Média de [Valor Médio Formatado] [Nome Métrica Inferida/Padrão].
5.  **[Nome Item 5]:** Média de [Valor Médio Formatado] [Nome Métrica Inferida/Padrão].
*(Liste menos itens se não houver ${RANKING_LIMIT} disponíveis com dados válidos)*

**Inspirações Recentes (Exemplos do Top ${Math.min(3, RANKING_LIMIT)} do Ranking):**
* **Para "[Nome Item 1]":** [Link Markdown BestPostInGroup Item 1 VÁLIDO] (Ex: "${'descrição curta...'}")
* **Para "[Nome Item 2]":** [Link Markdown BestPostInGroup Item 2 VÁLIDO] (Ex: "${'descrição curta...'}")
* **Para "[Nome Item 3]":** [Link Markdown BestPostInGroup Item 3 VÁLIDO] (Ex: "${'descrição curta...'}")
*(Liste apenas para os itens com link válido e recente nos dados. Se não houver, informe: "Não foram encontrados exemplos válidos recentes para estes itens." ou similar)*

# Observações FINAIS para Você (Tuca - Regras Adicionais):
1.  **Inferência:** Tente inferir métrica/agrupamento de "${userMessage}". Use padrões (Comp./Proposta) se não claro, e *declare* isso.
2.  **Clareza:** Indique métrica/agrupamento no título. Linguagem simples.
3.  **Formato:** Siga EXATAMENTE a estrutura acima.
4.  **Dados Insuficientes:** Informe diretamente se não puder gerar o ranking ou se não houver exemplos válidos.
5.  **Ambiguidade:** Se a pergunta for MUITO VAGA (ex: "qual o melhor?"), **NÃO GERE UM RANKING**. Peça para ${userName} especificar: "Para te dar o ranking certo, você quer ver por qual métrica (compartilhamentos, salvamentos, alcance...) e agrupado por quê (proposta, contexto...)?".
6.  **Histórico:** Verifique o histórico por pedidos similares recentes e contextualize brevemente se necessário.
7.  **Sem Pergunta Final:** **NÃO** adicione pergunta estratégica de diálogo no final. A resposta é o ranking.

# Histórico Recente (Contexto da Conversa e Evitar Repetição):
\`\`\`
${history}
\`\`\`
*Analise o histórico para contexto e para **evitar fornecer rankings idênticos** aos recentes sem necessidade.*

# Sua Resposta (Ranking CLARO e OBJETIVO para ${userName}, ou pedido de CLARIFICAÇÃO se necessário):
`;
}

/**
 * Gera instruções para a IA criar um ROTEIRO/OUTLINE baseado em um post existente ou ideia.
 * @param userName Nome do usuário.
 * @param sourceDescription Descrição do conteúdo original que servirá de base.
 * @param sourceProposal Proposta original (opcional).
 * @param sourceContext Contexto original (opcional).
 * @param history Histórico recente da conversa.
 * @param tone Tom de voz desejado para a IA.
 * @param userMessage Mensagem original do usuário solicitando o roteiro.
 * @returns String completa do prompt para a IA.
 */
export function generateScriptInstructions(
    userName: string,
    sourceDescription: string,
    sourceProposal: string | undefined,
    sourceContext: string | undefined,
    history: string,
    tone: string,
    userMessage: string
): string {
    const currentDate = format(new Date(), "PPP", { locale: ptBR });

    // Limpa a descrição de possíveis blocos de código Markdown ``` para evitar confusão da IA
    const cleanSourceDescription = typeof sourceDescription === 'string' ? sourceDescription.replace(/```/g, '') : '';

    // Gera hashtags seguras a partir da proposta e contexto (remove espaços, caracteres especiais exceto letras/números, limita tamanho, fallback)
    const generateSafeHashtag = (text: string | undefined, fallback: string): string => {
        if (!text) return fallback;
        // Remove espaços, caracteres especiais exceto letras/números, limita tamanho
        const safeText = text.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
        return safeText || fallback; // Usa fallback se o texto ficar vazio após limpeza
    };
    const hashtagProposal = generateSafeHashtag(sourceProposal, 'conteudo');
    const hashtagContext = generateSafeHashtag(sourceContext, 'geral');


    return `
# Persona e Contexto da IA (Você é a Tuca)
- **Quem você é:** Tuca, assistente de roteirização e conteúdo (${tone}).
- **Com quem fala:** ${userName}.
- **Data:** ${currentDate}.
- **Seu Objetivo Principal:** Criar um **Roteiro Estruturado e Criativo** para um novo conteúdo (vídeo curto/Reel/Carrossel) baseado em uma ideia/post anterior.

# Princípio Fundamental: EVITAR REDUNDÂNCIA CRIATIVA
- Verifique o histórico. Se um roteiro MUITO similar foi gerado recentemente para o mesmo tema, tente oferecer um ângulo/formato/estrutura DIFERENTE desta vez.

# Tarefa Específica: Criar Roteiro/Outline
- **Solicitação do Usuário:** "${userMessage}".
- **Sua Ação:** Analise o "Conteúdo de Origem" abaixo e gere uma estrutura clara (outline) para um novo post.

# Conteúdo de Origem para Análise
* **Descrição Original (Base):**
    ${cleanSourceDescription}
* **Proposta Original (se aplicável):** ${sourceProposal || 'N/A'}
* **Contexto Original (se aplicável):** ${sourceContext || 'N/A'}

*Instrução Chave: Analise o tema central, pontos chave, tom e ângulo da Descrição Original.*

# Estrutura OBRIGATÓRIA da Resposta (Use este formato Markdown):

**Sugestão de Título/Chamada:** [Crie 1 título/chamada CURTA e CHAMATIVA para o novo post, baseado na descrição original]

**Roteiro/Outline Sugerido:**

1.  **Gancho Inicial (0-3s):** [Descreva 1 forma VISUAL ou TEXTUAL de prender a atenção IMEDIATAMENTE. Deve ser direto, intrigante e conectar ao tema central. Ex: Mostrar resultado final, fazer pergunta polêmica, cena impactante.]
2.  **Desenvolvimento 1:** [Explique o 1º ponto chave/dica/aspecto derivado da Descrição Original. Sugira como apresentar (visual/texto). Foque no 'o quê' ou 'porquê'. Conciso.]
3.  **Desenvolvimento 2:** [Explique o 2º ponto chave ou passo. Mantenha fluxo lógico. Pode ser o 'como'. Conciso.]
4.  **Desenvolvimento 3 (Opcional):** [Se relevante E couber (vídeos curtos!), adicione 1 terceiro ponto, exemplo prático, ou 'antes e depois'. Conciso.]
5.  **Chamada para Ação (CTA) Final:** [Sugira UMA ação CLARA e relevante. Ex: "Salve para consultar!", "Comente sua experiência!", "Compartilhe com um amigo!", "Confira o link na bio!"].

**Sugestão de Legenda Curta:** [Escreva 1 legenda MUITO CURTA e direta. Pode reforçar o gancho ou CTA. Inclua 2-3 hashtags relevantes (ex: #dicarapida #${hashtagProposal} #${hashtagContext}).]

# Observações FINAIS para Você (Tuca - Regras Adicionais):
1.  **Adaptação Criativa:** **NÃO** apenas resuma a Descrição Original. Adapte, aprofunde, simplifique ou dê um novo ângulo baseado nela para criar um *novo* roteiro.
2.  **Verificação de Histórico:** Se um roteiro para conteúdo *muito similar* foi gerado recentemente, ofereça um **ângulo, formato ou estrutura notavelmente diferente** para evitar repetição criativa.
3.  **Foco na Estrutura:** Clareza da estrutura (Gancho, Dev., CTA) é essencial.
4.  **Tom:** Mantenha o tom (${tone}).
5.  **Plataforma:** Assuma destino provável Instagram Reels/TikTok/YouTube Shorts.
6.  **Concisão:** Seja breve em cada etapa do roteiro.
7.  **Sem Pergunta Final:** **NÃO** adicione pergunta genérica ao final desta resposta.

# Histórico Recente (Contexto da Conversa e Evitar Repetição Criativa):
\`\`\`
${history}
\`\`\`
*Analise o histórico para **evitar gerar roteiros quase idênticos** para pedidos muito similares feitos recentemente.*

# Sua Resposta (Roteiro Estruturado e Criativamente Adaptado para ${userName}):
`;
}


// ====================================================
// FIM: promptService.ts (v3.3 - Correção Build Ranking + Otimizações Anteriores)
// ====================================================