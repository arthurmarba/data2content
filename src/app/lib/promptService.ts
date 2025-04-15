// @/app/lib/promptService.ts - v3.Z.11 (Exporta Formatadores + Foco Roteiro na Descrição)

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logger } from '@/app/lib/logger';
import { Types } from 'mongoose';

// --- Tipos e Interfaces (Revisar se necessário importar de outros locais) ---
// (Interfaces mantidas como na v3.Z.10)
interface IMetricMinimal { _id?: Types.ObjectId; description?: string; postLink?: string; proposal?: string; context?: string; }
interface OverallStats { avgAlcance?: number; avgCompartilhamentos?: number; avgSalvamentos?: number; avgCurtidas?: number; avgComentarios?: number; }
interface DurationStat { range: string; contentCount: number; averageShares: number; averageSaves?: number; }
interface StatId { format?: string; proposal?: string; context?: string; }
interface BaseStat { _id: object; avgCompartilhamentos: number; avgSalvamentos: number; avgCurtidas: number; avgAlcance: number; avgComentarios: number; count: number; shareDiffPercentage?: number | null; saveDiffPercentage?: number | null; reachDiffPercentage?: number | null; commentDiffPercentage?: number | null; likeDiffPercentage?: number | null; bestPostInGroup?: Pick<IMetricMinimal, '_id' | 'description' | 'postLink'>; avgVisualizacoes?: number; taxaRetencao?: number; taxaEngajamento?: number; }
export interface DetailedContentStat extends BaseStat { _id: { format: string; proposal: string; context: string; }; topExamplesInGroup?: { _id: Types.ObjectId; description?: string; postLink?: string; }[]; }
export interface ProposalStat extends BaseStat { _id: { proposal: string; }; }
export interface ContextStat extends BaseStat { _id: { context: string; }; }
export interface IEnrichedReport { overallStats?: OverallStats; profileSegment?: string; multimediaSuggestion?: string; top3Posts?: Pick<IMetricMinimal, '_id' | 'description' | 'postLink'>[]; bottom3Posts?: Pick<IMetricMinimal, '_id' | 'description' | 'postLink'>[]; durationStats?: DurationStat[]; detailedContentStats?: DetailedContentStat[]; proposalStats?: ProposalStat[]; contextStats?: ContextStat[]; historicalComparisons?: object; longTermComparisons?: object; }


// --- Constantes Internas ---
const METRICS_FETCH_DAYS_LIMIT = 180;
const DETAILED_STATS_LIMIT_FOR_PROMPT = 7;
const RANKING_LIMIT = 5;
const TOP_EXAMPLES_PER_GROUP_LIMIT = 3;

// --- Funções Auxiliares de Formatação (AGORA EXPORTADAS) ---
export const formatNumericMetric = (value: number | undefined | null, precision = 1, suffix = ''): string => {
    // Verifica se o valor é um número finito
    if (value !== undefined && value !== null && isFinite(value)) {
        return value.toFixed(precision) + suffix;
    }
    return 'N/A'; // Retorna 'N/A' para valores inválidos ou nulos
};

export const formatPercentageDiff = (diff: number | undefined | null, label = ''): string => {
    // Retorna string vazia se a diferença for inválida ou nula
    if (diff === undefined || diff === null || !isFinite(diff)) return '';
    const sign = diff >= 0 ? '+' : ''; // Adiciona sinal de '+' para valores positivos ou zero
    const labelPart = label ? ` ${label}` : ''; // Adiciona label se fornecido
    // Formata a diferença como porcentagem com 0 casas decimais e adiciona parênteses
    return ` (${sign}${diff.toFixed(0)}%${labelPart})`;
};

const createSafeMarkdownLink = (text: string, url: string | undefined | null): string => {
    // Cria um link Markdown seguro, verificando se a URL é válida
    if (url && /^https?:\/\//.test(url)) {
        return `[${text}](${url})`;
    }
    return ''; // Retorna string vazia se a URL for inválida
};

function formatFPCLabel(statId: StatId | undefined | null): string {
    // Formata o rótulo F/P/C (Formato/Proposta/Contexto)
    if (!statId) return 'Geral';
    const f = statId.format && statId.format !== 'Desconhecido' ? `F:${statId.format}` : '';
    const p = statId.proposal && statId.proposal !== 'Outro' ? `P:${statId.proposal}` : '';
    const c = statId.context && statId.context !== 'Geral' ? `C:${statId.context}` : '';
    // Junta as partes com '/', filtrando as vazias
    return [f, p, c].filter(Boolean).join('/') || 'Geral';
}

// --- Função Auxiliar para Formatação Objetiva de Lista de Posts ---
function formatPostListForObjectiveResponse(posts: Pick<IMetricMinimal, '_id' | 'description' | 'postLink'>[] | undefined): string {
    // Formata uma lista de posts para exibição concisa
    if (!posts || posts.length === 0) return "(Nenhum)";
    let formatted = "";
    posts.forEach(post => {
        const description = post.description ? `${post.description.substring(0, 40)}...` : 'Post sem descrição';
        const link = createSafeMarkdownLink('ver', post.postLink);
        formatted += `${description} ${link ? `(${link})` : ''}\n`;
    });
    return formatted.trim();
}


// --- Funções de Formatação de Dados para Prompt ---

/**
 * Formata dados gerais do relatório para o prompt.
 */
function formatGeneralReportDataForPrompt(report: IEnrichedReport, maxDetailedStats: number = DETAILED_STATS_LIMIT_FOR_PROMPT): string {
    // (Implementação mantida como na v3.Z.4)
    let dataString = "";
    dataString += `\n## **Resumo Geral (Médias ${METRICS_FETCH_DAYS_LIMIT}d):**\n`;
    if (report.overallStats) {
        dataString += `• **Alcance Médio:** ${formatNumericMetric(report.overallStats.avgAlcance, 0)}\n`;
        dataString += `• **Comp. Médio:** ${formatNumericMetric(report.overallStats.avgCompartilhamentos, 1)}\n`;
        dataString += `• **Salv. Médio:** ${formatNumericMetric(report.overallStats.avgSalvamentos, 1)}\n`;
        dataString += `• **Coment. Médio:** ${formatNumericMetric(report.overallStats.avgComentarios, 1)}\n`;
        dataString += `• **Curt. Médias:** ${formatNumericMetric(report.overallStats.avgCurtidas, 1)}\n`;
    } else { dataString += "• Dados gerais indisponíveis.\n"; }
    dataString += `\n## **Desempenho Detalhado (Top ${maxDetailedStats} Combinações F/P/C ordenadas por Desempenho Relativo em Compartilhamentos):**\n`;
    if (report.detailedContentStats && report.detailedContentStats.length > 0) {
        const sortedStats = [...report.detailedContentStats].sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity) );
        const statsToShow = sortedStats.slice(0, maxDetailedStats);
        statsToShow.forEach((stat, index) => {
            if (!stat || !stat._id) return;
            const labels = formatFPCLabel(stat._id);
            const compAvg = formatNumericMetric(stat.avgCompartilhamentos, 1);
            const salvAvg = formatNumericMetric(stat.avgSalvamentos, 1);
            const commentAvg = formatNumericMetric(stat.avgComentarios, 1);
            const shareDiff = formatPercentageDiff(stat.shareDiffPercentage, 'Comp.');
            const saveDiff = formatPercentageDiff(stat.saveDiffPercentage, 'Salv.');
            const commentDiff = formatPercentageDiff(stat.commentDiffPercentage, 'Coment.');
            dataString += `${index + 1}. **${labels}** (${stat.count}p): Comp=${compAvg}${shareDiff}, Salv=${salvAvg}${saveDiff}, Coment=${commentAvg}${commentDiff}\n`;
        });
        if (report.detailedContentStats.length > maxDetailedStats) { dataString += `• ... (outras ${report.detailedContentStats.length - maxDetailedStats} combinações omitidas)\n`; }
    } else { dataString += "• Não há dados detalhados por combinação F/P/C disponíveis.\n"; }
    dataString += "\n## **Desempenho por Duração (Vídeos):**\n";
    if (report.durationStats && report.durationStats.length > 0) {
        report.durationStats.forEach(stat => {
            const compAvg = formatNumericMetric(stat.averageShares, 2);
            const salvAvg = formatNumericMetric(stat.averageSaves, 2);
            dataString += `• **Faixa ${stat.range}** (${stat.contentCount}p): Comp. Médio=${compAvg}, Salv. Médio=${salvAvg}\n`;
        });
    } else { dataString += "• Não há dados de desempenho por duração disponíveis.\n"; }
    return dataString.trim();
}

/**
 * Formata dados para o prompt de plano de conteúdo.
 */
function formatDataForContentPlanPrompt(
    report: IEnrichedReport,
    targetMetricField: keyof DetailedContentStat | null,
    targetMetricFriendlyName: string | null
): string {
    // (Implementação mantida como na v3.Z.6)
    const fnTag = "[formatDataForContentPlanPrompt]";
    const defaultSortField: keyof DetailedContentStat = 'shareDiffPercentage';
    const sortField = targetMetricField ?? defaultSortField;
    const sortFriendlyName = targetMetricFriendlyName ?? 'Compartilhamentos (padrão)';
    logger.debug(`${fnTag} Iniciando formatação de dados para plano. Ordenando por: ${sortField} (Foco: ${sortFriendlyName})`);
    let dataString = `## **Desempenho Detalhado por Combinação (F/P/C) - Base para o Plano (Priorizado por ${sortFriendlyName}):**\n`;
    if (!report.detailedContentStats || report.detailedContentStats.length === 0) { dataString += "• Nenhum dado detalhado por combinação F/P/C disponível para basear o plano.\n"; }
    else { /* ... lógica de ordenação e formatação mantida ... */
        let sortedStats = [...report.detailedContentStats];
        const firstStat = sortedStats[0];
        const canSortByTarget = firstStat && sortField && sortField in firstStat;
        if (sortField && canSortByTarget) { logger.debug(`${fnTag} Aplicando ordenação dinâmica pelo campo: ${sortField}`); sortedStats.sort((a, b) => { const valA = (a[sortField] as number | null | undefined) ?? -Infinity; const valB = (b[sortField] as number | null | undefined) ?? -Infinity; return valB - valA; }); } else { logger.warn(`${fnTag} Campo alvo '${sortField}' não encontrado ou inválido para ordenação. Usando padrão ${defaultSortField}.`); if (firstStat && defaultSortField in firstStat) { sortedStats.sort((a, b) => (b[defaultSortField] ?? -Infinity) - (a[defaultSortField] ?? -Infinity)); } else { logger.error(`${fnTag} Campo de ordenação padrão '${defaultSortField}' também não encontrado!`); } }
        const statsToFormat = sortedStats.slice(0, DETAILED_STATS_LIMIT_FOR_PROMPT);
        let combinationsFound = 0;
        statsToFormat.forEach((stat, index) => {
            if (!stat || !stat._id || stat.count < 2) return; combinationsFound++;
            const f = stat._id.format || 'Desconhecido'; const p = stat._id.proposal || 'Outro'; const c = stat._id.context || 'Geral'; const labels = formatFPCLabel(stat._id);
            dataString += `\n### **${index + 1}. Combinação: ${labels} (${stat.count} posts)**\n`;
            dataString += `   • **Proposta Principal:** ${p}\n`; dataString += `   • **Contexto Principal:** ${c}\n`; dataString += `   • **Formato Base:** ${f}\n`;
            dataString += `   • **Desempenho Chave:** Comp=${formatNumericMetric(stat.avgCompartilhamentos)}${formatPercentageDiff(stat.shareDiffPercentage)}, Salv=${formatNumericMetric(stat.avgSalvamentos)}${formatPercentageDiff(stat.saveDiffPercentage)}, Alcance=${formatNumericMetric(stat.avgAlcance, 0)}${formatPercentageDiff(stat.reachDiffPercentage)}, Coment=${formatNumericMetric(stat.avgComentarios)}${formatPercentageDiff(stat.commentDiffPercentage)}\n`;
            dataString += `   • **Exemplos de Sucesso Recentes (Base para Síntese do Tema):**\n`;
            if (stat.topExamplesInGroup && stat.topExamplesInGroup.length > 0) { const examplesToShow = stat.topExamplesInGroup.slice(0, TOP_EXAMPLES_PER_GROUP_LIMIT); examplesToShow.forEach((example, exIndex) => { if (!example) return; const desc = example.description ? `"${example.description.substring(0, 70)}..."` : '(Sem descrição)'; const link = createSafeMarkdownLink('Ver', example.postLink); dataString += `      * ${exIndex + 1}. DESCRIÇÃO: ${desc} ${link}\n`; }); } else { dataString += `      * (Nenhuma descrição de exemplo encontrada para esta combinação.)\n`; }
        });
        if (combinationsFound === 0) { dataString += "• Nenhuma combinação F/P/C com dados suficientes (mínimo 2 posts) encontrada para basear o plano.\n"; } else if (sortedStats.length > DETAILED_STATS_LIMIT_FOR_PROMPT) { const omittedCount = sortedStats.length - combinationsFound; if (omittedCount > 0) { dataString += `\n• (... outras ${omittedCount} combinações com menor desempenho em ${sortFriendlyName} ou dados omitidas ...)\n`; } }
    }
    dataString += "\n\n## **Desempenho Geral por Duração (Vídeos):**\n";
    if (report.durationStats && report.durationStats.length > 0) { const sortedDurationStats = [...report.durationStats].sort((a, b) => (b.averageSaves ?? -Infinity) - (a.averageSaves ?? -Infinity)); sortedDurationStats.forEach(d => { const compAvg = formatNumericMetric(d.averageShares, 2); const salvAvg = formatNumericMetric(d.averageSaves, 2); dataString += `• **Faixa ${d.range}** (${d.contentCount} posts): Comp. Médio=${compAvg}, Salv. Médio=${salvAvg}\n`; }); } else { dataString += "• Não há dados disponíveis.\n"; }
    return dataString.trim();
}


/**
 * Formata os dados para o prompt de ranking.
 */
function formatRankingDataForPrompt(report: IEnrichedReport): string {
    // (Implementação mantida como na v3.Z.4)
    const fnTag = "[formatRankingDataForPrompt v3.Z.4]";
    logger.debug(`${fnTag} Formatando dados para prompt de ranking objetivo.`);
    let dataString = "## **Dados Disponíveis para Ranking (Ordenados por Desempenho Relativo em Compartilhamentos):**\n";
    const topN = RANKING_LIMIT;
    const formatRankingStatLine = ( label: string, stat: DetailedContentStat | ProposalStat | ContextStat | undefined | null ): string => { if (!stat || !stat._id || stat.count < 1) return `   * ${label}: Dados insuficientes.`; let format = ''; if (typeof stat._id === 'object' && 'format' in stat._id && stat._id.format && stat._id.format !== 'Desconhecido') { format = stat._id.format; } else if (stat.bestPostInGroup && stat.bestPostInGroup.description?.toLowerCase().includes('reels')) { format = 'Reels'; } else if (stat.bestPostInGroup && stat.bestPostInGroup.description?.toLowerCase().includes('post')) { format = 'Post'; } const metricValue = formatNumericMetric(stat.avgCompartilhamentos, 1); const metricDiff = formatPercentageDiff(stat.shareDiffPercentage); let exampleLine = ''; if (stat.bestPostInGroup) { const link = createSafeMarkdownLink('link de referência', stat.bestPostInGroup.postLink); if (link) { exampleLine = `\n   * **Exemplo:** ${link}`; } } let line = `**${label}**`; if (format) { line += `\n   * **Formato:** ${format}`; } line += `\n   * **Métrica:** ${metricValue} compartilhamentos ${metricDiff}`; line += exampleLine; return line; };
    let proposalRanking = "\n**Ranking por PROPOSTA:**\n";
    const sortedProposalStats = [...(report.proposalStats || [])].sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity));
    if (sortedProposalStats.length > 0) { const statsToShow = sortedProposalStats.slice(0, topN); proposalRanking += statsToShow.map((stat, i) => `${i + 1}. ${formatRankingStatLine(stat?._id?.proposal || `Proposta ${i + 1}`, stat)}`).join('\n'); if (sortedProposalStats.length > topN) proposalRanking += `\n   • (...)\n`; } else { proposalRanking += "   • Nenhum dado disponível.\n"; }
    let contextRanking = "\n**Ranking por CONTEXTO:**\n";
    const sortedContextStats = [...(report.contextStats || [])].sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity));
    if (sortedContextStats.length > 0) { const statsToShow = sortedContextStats.slice(0, topN); contextRanking += statsToShow.map((stat, i) => `${i + 1}. ${formatRankingStatLine(stat?._id?.context || `Contexto ${i + 1}`, stat)}`).join('\n'); if (sortedContextStats.length > topN) contextRanking += `\n   • (...)\n`; } else { contextRanking += "   • Nenhum dado disponível.\n"; }
    let detailedRanking = "\n**Ranking por COMBINAÇÃO (F/P/C):**\n";
    const sortedDetailedStats = [...(report.detailedContentStats || [])].sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity));
    if (sortedDetailedStats.length > 0) { const statsToShow = sortedDetailedStats.slice(0, topN); detailedRanking += statsToShow.map((stat, i) => { if (!stat || !stat._id) return ''; const labels = formatFPCLabel(stat._id); return `${i + 1}. ${formatRankingStatLine(labels, stat)}`; }).filter(Boolean).join('\n'); if (sortedDetailedStats.length > topN) detailedRanking += `\n   • (...)\n`; } else { detailedRanking += "   • Nenhum dado disponível.\n"; }
    return (dataString + proposalRanking + contextRanking + detailedRanking).trim();
}

// --- Funções de Geração de Prompt Principal ---

/**
 * Gera instruções GERAIS para a IA.
 */
export function generateAIInstructions(
    userName: string,
    report: IEnrichedReport,
    history: string,
    tone: string,
    userQuery: string
): string {
    // (Mantida como na v3.Z.4)
    const profileSegment = report.profileSegment || "Geral";
    const formattedReportData = formatGeneralReportDataForPrompt(report);
    const currentDate = format(new Date(), "PPP", { locale: ptBR });
    const bestPerformingCombo = [...(report.detailedContentStats || [])] .filter(stat => stat.count >= 1) .sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity))[0];
    let mainIdeaDescriptionForPlaceholder = "Ideia Principal"; if (bestPerformingCombo) { mainIdeaDescriptionForPlaceholder = `Conteúdo ${bestPerformingCombo._id.proposal || ''} sobre ${bestPerformingCombo._id.context || 'Geral'}`.substring(0, 70); }

    return `
# **CONTEXTO**
• **Usuário:** ${userName} (Perfil: ${profileSegment})
• **Data:** ${currentDate}
• **Consulta:** "${userQuery}"
• **Histórico:** ${history}

# **DADOS DE PERFORMANCE (Últimos ${METRICS_FETCH_DAYS_LIMIT}d)**
${formattedReportData}

# **TAREFA**
Analise os dados e a consulta do usuário ("${userQuery}"). Gere uma resposta **extremamente objetiva** seguindo **EXATAMENTE** o formato abaixo. Use os dados para identificar o principal destaque e a principal melhoria. Gere ideias de conteúdo **APENAS SE** a consulta pedir explicitamente por ideias ou sugestões de posts.

# **FORMATO OBRIGATÓRIO DA RESPOSTA**

**Destaque**
• **Formato:** [Combinação F/P/C com MELHOR desempenho relativo em Shares ou Saves]
• **Métricas:** [Métrica Chave 1]=[Valor Formatado][Diff% Formatado] | [Métrica Chave 2]=[Valor Formatado][Diff% Formatado] *(Use Comp e Salv como métricas chave)*
• **Ação:** [Recomendação CURTA e direta. Ex: "Replicar este formato/estratégia"]

**Melhoria**
• [Item com PIOR desempenho relativo ou métrica geral baixa]: [Métrica e Valor Formatado com Diff%. Ex: Vídeos 30-59s: Comp. Médio=X (-Y%)]
• **Ação:** [Sugestão CURTA e direta. Ex: "Revisar gancho inicial" ou "Testar duração <30s"]

**Ideias de Conteúdo** *(APENAS SE SOLICITADO NA CONSULTA "${userQuery}")*
• [Ideia 1 concisa, baseada no Destaque]
• [Ideia 2 concisa]
• [(Opcional) Ideia 3 concisa]

---
**Próximos passos:**
[Comentário MUITO breve conectando com a consulta "${userQuery}". Ex: "Focar em [Destaque] pode ajudar com [objetivo do usuário]."] Qual dessas ideias (se houver) ou recomendações você quer explorar primeiro, ${userName}?

**(SE FORAM GERADAS IDEIAS DE CONTEÚDO ACIMA)**
**Próximo Passo Roteiro:** Se quiser ajuda para criar o roteiro de "[Descrição da Ideia Principal Gerada pela IA]", é só pedir! ✍️

---
***Referências de desempenho:***
*Top 3 posts:*
${formatPostListForObjectiveResponse(report.top3Posts)}
*3 posts com menor desempenho:*
${formatPostListForObjectiveResponse(report.bottom3Posts)}

# **DIRETRIZES ADICIONAIS**
• Use os dados para justificar Destaque e Melhoria de forma implícita na seleção.
• Seja direto nas Ações.
• Se gerar ideias, a primeira DEVE ser baseada no Destaque.
• Adapte a pergunta final ao contexto (se deu ideias, pergunte sobre elas; se deu recomendações, sobre elas).
• Use o formato de referência de posts EXATAMENTE como gerado por formatPostListForObjectiveResponse.
• NÃO use emojis antes do separador "---". Mantenha o tom neutro e objetivo.
• NÃO inclua a seção "Ideias de Conteúdo" se não for solicitada.

# **SUA RESPOSTA OBJETIVA PARA ${userName}:**
`;
}


/**
 * Gera instruções para a IA criar um PLANO DE CONTEÚDO SEMANAL (PADRÃO).
 */
export function generateContentPlanInstructions(
    userName: string,
    report: IEnrichedReport,
    history: string,
    tone: string,
    userMessage: string,
    targetMetricField: keyof DetailedContentStat | null,
    targetMetricFriendlyName: string | null
): string {
    // (Mantida como na v3.Z.6)
    const formattedPlanData = formatDataForContentPlanPrompt(report, targetMetricField, targetMetricFriendlyName);
    const currentDate = format(new Date(), "PPP", { locale: ptBR });
    const focusDescription = targetMetricFriendlyName ?? 'Desempenho Geral (Compartilhamentos/Salvamentos)';

    return `
# **CONTEXTO**
• **Usuário:** ${userName}
• **Data:** ${currentDate}
• **Consulta:** "${userMessage}" (**Foco desejado:** ${focusDescription})
• **Histórico:** ${history}

# **DADOS DISPONÍVEIS (Use para basear o plano! Priorizados por ${focusDescription})**
${formattedPlanData}
• Use os '**Exemplos de Sucesso Recentes (Base para Síntese do Tema)**' como **base principal** para gerar os temas. Analise as **descrições** deles.
• Use '**Desempenho Geral por Duração**' para adicionar contexto a vídeos.

# **TAREFA**
Gere um **PLANEJAMENTO SEMANAL OBJETIVO (3-5 posts)** para ${userName}, focado em **${focusDescription}**. Siga **EXATAMENTE** o formato abaixo. Para cada dia:
1. Escolha uma combinação F/P/C promissora em ${focusDescription} (idealmente \`count\` >= 2).
2. **Analise as DESCRIÇÕES** dos 'Exemplos de Sucesso' dessa combinação (fornecidos nos dados).
3. **Sintetize** essa análise em um **Tema** conciso e criativo que capture a essência do conteúdo descrito nos exemplos. **IMPORTANTE: O tema deve refletir o conteúdo das descrições, não apenas os rótulos Proposta/Contexto.**
4. Indique **Formato**, **Métrica Principal** (com % diff) e **Faixa de Duração** (se vídeo).
5. Liste o melhor **Exemplo** da combinação como referência.

# **FORMATO OBRIGATÓRIO DA RESPOSTA (Planejamento)**

**(Repita esta estrutura para 3 a 5 dias)**
1. **[Dia da Semana - ex: Segunda-feira]**
   • **Combinação:** [Proposta]/[Contexto] *(Combinação escolhida)*
   • **Tema:** [Sintetize as DESCRIÇÕES dos exemplos em um tema conciso e relevante para o conteúdo real da combinação]
   • **Formato:** [Formato Sugerido]
   • **Métrica Foco (${focusDescription}):** [Métrica Alvo Formatada] ([% Diff Formatado])
   • **Duração:** [Faixa de Duração com melhor performance geral, se vídeo. Ex: 15-29s]
   • **Exemplo Ref.:** [Link Markdown para bestPostInGroup/topExample, se válido]
(Use indentação com •)

---
**Próximos passos:**
[Mensagem CURTA sobre o plano focado em ${focusDescription}]. Qual destas ideias você prefere que eu detalhe com um roteiro, ${userName}?

# **DIRETRIZES ADICIONAIS**
• Seja extremamente conciso.
• Gere **Temas** criativos e **estritamente baseados na análise e síntese das DESCRIÇÕES** dos exemplos da combinação. Não use apenas os rótulos Proposta/Contexto para o tema.
• Use os dados de **duração** disponíveis. Se não houver, omita a linha "**Duração**".
• Se não houver combinações suficientes, informe e sugira alternativas.
• NÃO use emojis ou texto introdutório/conclusivo extra.

# **SUA RESPOSTA OBJETIVA PARA ${userName}:**
`;
}

/**
 * Gera instruções para a IA criar um PLANO DE CONTEÚDO SEMANAL AGRUPADO E CONCISO.
 */
export function generateGroupedContentPlanInstructions(
    userName: string,
    commonCombinationData: { proposal: string; context: string; stat: DetailedContentStat },
    enrichedReport: IEnrichedReport,
    history: string,
    tone: string,
    userMessage: string,
    targetMetricField: keyof DetailedContentStat | null,
    targetMetricFriendlyName: string | null
): string {
    // (Mantida como na v3.Z.6)
    const currentDate = format(new Date(), "PPP", { locale: ptBR });
    const { proposal: commonProposal, context: commonContext, stat: commonStat } = commonCombinationData;
    const commonCompAvg = formatNumericMetric(commonStat.avgCompartilhamentos);
    const commonShareDiff = formatPercentageDiff(commonStat.shareDiffPercentage);
    const commonReachAvg = formatNumericMetric(commonStat.avgAlcance, 0);
    const commonReachDiff = formatPercentageDiff(commonStat.reachDiffPercentage);
    const targetMetricValue = targetMetricField ? formatNumericMetric(commonStat[targetMetricField] as number | null) : 'N/A';
    const targetMetricDiff = targetMetricField ? formatPercentageDiff(commonStat[targetMetricField] as number | null) : '';
    const focusDescription = targetMetricFriendlyName ?? 'Desempenho Geral';
    let formatSuggestion = commonStat._id?.format && commonStat._id.format !== 'Desconhecido' ? commonStat._id.format : null;
    let formatJustification = "";
    if (!formatSuggestion && enrichedReport.durationStats && enrichedReport.durationStats.length > 0) { const bestDurationStat = [...enrichedReport.durationStats].sort((a, b) => (b.averageSaves ?? -Infinity) - (a.averageSaves ?? -Infinity))[0]; if (bestDurationStat?.averageSaves && bestDurationStat.averageSaves > (enrichedReport.overallStats?.avgSalvamentos ?? 0)) { formatSuggestion = `Vídeos (${bestDurationStat.range})`; formatJustification = `Vídeos nessa faixa (${bestDurationStat.range}) costumam ter boa média de ${formatNumericMetric(bestDurationStat.averageSaves, 2)} salvamentos (acima da sua média geral).`; } }
    if (formatSuggestion && !formatJustification) { const saveMetric = formatNumericMetric(commonStat.avgSalvamentos); const saveDiff = formatPercentageDiff(commonStat.saveDiffPercentage); formatJustification = saveMetric !== 'N/A' ? `Este formato costuma gerar bons resultados de salvamentos (${saveMetric}${saveDiff}).` : "Alinhado com o histórico de sucesso desta combinação."; }
    if (!formatSuggestion) formatSuggestion = "Formato variado (experimente!)";
    let examplesString = ""; if (commonStat.topExamplesInGroup && commonStat.topExamplesInGroup.length > 0) { const examplesToShow = commonStat.topExamplesInGroup.slice(0, TOP_EXAMPLES_PER_GROUP_LIMIT); examplesToShow.forEach((example, exIndex) => { if (!example) return; const desc = example.description ? `"${example.description.substring(0, 70)}..."` : '(Sem descrição)'; const link = createSafeMarkdownLink('Ver', example.postLink); examplesString += `\n      * ${exIndex + 1}. DESCRIÇÃO: ${desc} ${link}`; }); } else { examplesString = `\n      * (Nenhuma descrição de exemplo encontrada.)`; }

    let bestDurationRange = "";
    if (enrichedReport.durationStats && enrichedReport.durationStats.length > 0) {
        const sortedDuration = [...enrichedReport.durationStats].sort((a, b) => (b.averageSaves ?? -Infinity) - (a.averageSaves ?? -Infinity));
        if (sortedDuration[0] && (sortedDuration[0].averageSaves ?? 0) > 0) {
            bestDurationRange = sortedDuration[0].range;
        }
    }

    return `
# **CONTEXTO**
• **Usuário:** ${userName}
• **Data:** ${currentDate}
• **Consulta:** "${userMessage}" (**Foco desejado:** ${focusDescription})
• **Histórico:** ${history}
• **Estratégia Principal Identificada:** **${commonProposal}** sobre **${commonContext}**

# **DADOS DE PERFORMANCE (Estratégia Principal e Duração Geral)**
• **Resultados Típicos (${commonProposal}/${commonContext}):** Comp=${commonCompAvg}${commonShareDiff} | Salv=${formatNumericMetric(commonStat.avgSalvamentos)}${formatPercentageDiff(commonStat.saveDiffPercentage)} | Alcance=${commonReachAvg}${commonReachDiff} | **${focusDescription}**=${targetMetricValue}${targetMetricDiff}
• **Formato Sugerido:** ${formatSuggestion} (${formatJustification})
• **Exemplos (Base para Síntese dos Temas):** ${examplesString} *(Use as DESCRIÇÕES destes exemplos como base para os temas)*
• **Duração (Geral):** ${ bestDurationRange ? `Faixa de **${bestDurationRange}** teve melhor média de salvamentos.` : 'Dados de duração indisponíveis.' }

# **TAREFA**
Gere um **PLANEJAMENTO SEMANAL OBJETIVO (3-5 posts)** para ${userName}, com **TODAS as ideias focadas na estratégia principal (${commonProposal}/${commonContext})** e no objetivo de **${focusDescription}**. Siga **EXATAMENTE** o formato abaixo. Para cada ideia:
1. **Analise as DESCRIÇÕES** dos 'Exemplos (Base para Síntese dos Temas)' fornecidos.
2. **Sintetize** essa análise para criar um **Tema** conciso e **diferente** para cada dia, explorando ângulos variados da estratégia principal (${commonProposal}/${commonContext}). **IMPORTANTE: O tema deve refletir o conteúdo das descrições, não apenas os rótulos ${commonProposal}/${commonContext}.**
3. Sugira o **Formato** e uma **Dica** focada em ${focusDescription}.

# **FORMATO OBRIGATÓRIO DA RESPOSTA (Planejamento Agrupado)**

**(Repita esta estrutura para 3 a 5 dias)**
1. **[Dia da Semana]**
   • **Tema:** [Crie um tema conciso e específico para este dia, sintetizando/interpretando as DESCRIÇÕES dos exemplos, mas variando o ângulo dentro de ${commonProposal}/${commonContext}]
   • **Formato:** [Formato Sugerido acima ou variação]
   • **Dica:** [Dica curta focada em ${focusDescription}. Ex: "Faça uma pergunta clara no final" ou "Use visual impactante"]
(Use indentação com •)

---
**Próximos passos:**
Focar em **${commonProposal}/${commonContext}** pode impulsionar seus **${focusDescription}**, ${userName}. Qual destas ideias você prefere que eu detalhe com um roteiro?

# **DIRETRIZES ADICIONAIS**
• Seja extremamente conciso.
• Os **Temas** DEVEM ser **diferentes** entre si, explorando ângulos variados dentro da estratégia principal, e **estritamente baseados na análise e síntese das DESCRIÇÕES** dos exemplos. Não use apenas os rótulos Proposta/Contexto para o tema.
• As ideias DEVEM ser focadas em gerar **${focusDescription}**.
• Use o formato EXATO. Não adicione texto extra.
• NÃO use emojis.

# **SUA RESPOSTA OBJETIVA PARA ${userName}:**
`;
}

/**
 * Gera instruções para a IA responder a um pedido de RANKING.
 */
export function generateRankingInstructions(
    userName: string,
    report: IEnrichedReport,
    history: string,
    tone: string,
    userMessage: string
): string {
    // (Mantida como na v3.Z.4)
    const formattedRankingData = formatRankingDataForPrompt(report);
    const currentDate = format(new Date(), "PPP", { locale: ptBR });

    return `
# **CONTEXTO**
• **Usuário:** ${userName}
• **Data:** ${currentDate}
• **Consulta:** "${userMessage}"
• **Histórico:** ${history}

# **DADOS DISPONÍVEIS (Rankings pré-ordenados por Compartilhamentos)**
${formattedRankingData}

# **TAREFA**
Responda ao pedido de ranking de "${userMessage}" de forma **extremamente objetiva**, seguindo **EXATAMENTE** o formato abaixo.
1.  **Inferir Critérios:** Tente identificar qual **Métrica** (Compartilhamentos, Salvamentos, Alcance, etc.) e qual **Agrupamento** (Proposta, Contexto, Combinação F/P/C) o usuário deseja.
2.  **Usar Padrões:** Se a consulta for vaga (ex: "melhores"), use o padrão: **Compartilhamentos por Proposta**. Declare isso.
3.  **Pedir Clarificação:** Se for impossível inferir (ex: "como estou indo?"), **NÃO GERE RANKING**. Use a seção "**Próximos passos**" para pedir clarificação.
4.  **Gerar Ranking:** Liste o Top ${RANKING_LIMIT} (ou menos) do agrupamento/métrica inferido(s) ou padrão.
5.  **Listar Exemplos:** Para os Top 3 (ou menos), inclua o link do melhor exemplo, se disponível nos dados.
6.  **Informar Limitações:** Se não houver dados para o ranking solicitado, informe concisamente.

# **FORMATO OBRIGATÓRIO DA RESPOSTA (Ranking)**

*(Se o ranking PODE ser gerado):*
**Ranking de [Agrupamento Inferido/Padrão] por [Métrica Inferida/Padrão]** *(Declare o critério usado!)*

1. **[Nome Item 1]**
   • **Formato:** [Formato Predominante, se aplicável/óbvio no nome]
   • **Métrica:** [Métrica Principal Formatada] ([% Diff Formatado])
   • **Exemplo:** [Link Markdown para bestPostInGroup, se válido]
2. **[Nome Item 2]**
   • **Formato:** [Formato Predominante, se aplicável/óbvio no nome]
   • **Métrica:** [Métrica Principal Formatada] ([% Diff Formatado])
   • **Exemplo:** [Link]
(Repetir para Top N itens. Se não houver exemplos, omita a linha "**Exemplo:**")
*(Se não houver dados suficientes: "• Não há dados suficientes para gerar o ranking de [Agrupamento] por [Métrica].")*

---
**Próximos passos:**
[Mensagem CURTA com dica/insight sobre o ranking. Ex: "Analisando o ranking de [Agrupamento]..."]. Qual destes itens você gostaria de analisar mais a fundo, ${userName}?

*(Se o pedido foi MUITO VAGO e o ranking NÃO foi gerado):*
**Próximos passos:**
Para te dar o ranking certo, ${userName}, você quer ver por qual métrica (compartilhamentos, salvamentos, alcance...) e agrupado por quê (proposta, contexto...)?

# **DIRETRIZES ADICIONAIS**
• Seja direto e use o formato de lista.
• NÃO use emojis antes do separador "---".
• NÃO adicione introduções ou conclusões extras.
• Use os dados formatados fornecidos.

# **SUA RESPOSTA OBJETIVA PARA ${userName}:**
`;
}


// =========================================================================
// <<< INÍCIO DA FUNÇÃO MODIFICADA (generateScriptInstructions) >>>
// =========================================================================
/**
 * Gera instruções para a IA criar um ROTEIRO/OUTLINE otimizado.
 * v3.Z.10: Clarifica o uso da descrição fonte para IDENTIFICAR O TEMA, e não ser o tema literal.
 */
export function generateScriptInstructions(
    userName: string,
    sourceDescription: string, // Descrição EXEMPLO para identificar o tema
    sourceProposal: string | undefined, // Proposta associada (para contexto)
    sourceContext: string | undefined, // Contexto associado (para contexto)
    history: string,
    tone: string, // Tom da resposta (ex: 'informal e prestativo')
    userMessage: string // A solicitação original do usuário para roteirizar
): string {
    const currentDate = format(new Date(), "PPP", { locale: ptBR });
    const cleanSourceDescription = typeof sourceDescription === 'string' ? sourceDescription.replace(/```/g, '') : '';
    const generateSafeHashtag = (text: string | undefined, fallback: string): string => { if (!text) return fallback; const safeText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '').substring(0, 20); return safeText || fallback; };
    const hashtagProposal = generateSafeHashtag(sourceProposal, 'conteudo');
    const hashtagContext = generateSafeHashtag(sourceContext, 'geral');

    // Instruções para a IA
    return `
# **CONTEXTO DA TAREFA**
• **Assistente:** Você é um assistente de roteirização e conteúdo (${tone}), especialista em transformar ideias em estruturas de vídeo curtas e eficazes, atualizado com as últimas tendências.
• **Usuário:** ${userName}.
• **Data:** ${currentDate}.
• **Seu Objetivo Principal:** Criar um **Roteiro Estruturado (Outline), Criativo e Otimizado** para um vídeo curto (Reel/TikTok), **sobre o TEMA CENTRAL** identificado a partir da "Descrição Exemplo", enriquecendo-o com conhecimento atual sobre esse TEMA e sobre ESTRATÉGIAS DE VÍDEO.

# **Princípios Fundamentais**
• **IDENTIFICAR O TEMA:** A "Descrição Exemplo" fornecida é uma **amostra de conteúdo bem-sucedido**. Sua primeira tarefa é **analisá-la para identificar o TEMA CENTRAL, a MENSAGEM CHAVE ou o ASSUNTO** que provavelmente ressoou com o público.
• **FOCO NO TEMA IDENTIFICADO:** O roteiro que você vai gerar deve ser **SOBRE O TEMA/MENSAGEM que você identificou**, não sobre o texto literal da descrição exemplo.
• **ESTRUTURA É REI:** Foque em criar uma estrutura clara para o TEMA: Gancho -> Desenvolvimento -> CTA.
• **ENRIQUECIMENTO RELEVANTE:** Use o TEMA IDENTIFICADO como ponto de partida. Adapte, aprofunde e incorpore seu conhecimento atual **sobre esse TEMA específico** e sobre **estratégias eficazes para vídeos curtos** (tendências, ganchos virais, formatos de sucesso, CTAs que convertem) para criar um roteiro **NOVO, relevante e otimizado para aquele TEMA**. Elementos da descrição exemplo (como nomes, lugares, etc.) podem ser usados como *ilustração* no novo roteiro, se relevantes para o TEMA, mas não devem ser o foco principal.
• **EVITAR REPETIÇÃO:** Verifique o histórico. Se um roteiro sobre o mesmo TEMA foi gerado recentemente, sugira um ângulo ou formato **significativamente diferente** para esse TEMA.
• **SER DIRETO:** Uma vez que as informações ("Conteúdo de Origem") são fornecidas, **gere o roteiro sobre o TEMA identificado imediatamente**. **NÃO FAÇA PERGUNTAS DE CLARIFICAÇÃO** sobre a tarefa, a menos que a "Descrição Exemplo" seja *extremamente* vaga ou incompreensível.

# **Tarefa Específica: Criar Roteiro/Outline Otimizado para Vídeo Curto**
• **Solicitação do Usuário:** "${userMessage}".
• **Sua Ação:**
    1. Analise a "Descrição Exemplo" abaixo para **identificar seu TEMA CENTRAL ou MENSAGEM CHAVE** de sucesso.
    2. Considere a "Proposta" e "Contexto" para entender o universo temático.
    3. Gere uma estrutura clara e concisa de roteiro para um novo vídeo curto **SOBRE O TEMA IDENTIFICADO**, incorporando seu conhecimento atual sobre esse TEMA e sobre táticas de engajamento em vídeos curtos.
    4. Entregue o roteiro diretamente.

# **Conteúdo de Origem para Análise (Identificar o Tema Central)**
• **Descrição Exemplo:**
    \`\`\`
    ${cleanSourceDescription}
    \`\`\`
• **Proposta Original (para contexto do tema):** ${sourceProposal || 'N/A'}
• **Contexto Original (para contexto do tema):** ${sourceContext || 'N/A'}

*Instrução Chave: Identifique o TEMA principal da Descrição Exemplo e crie um roteiro eficaz sobre ESSE TEMA, aplicando conhecimento atual sobre o tema e sobre formatos/tendências de vídeo.*

# **Estrutura Esperada da Resposta (Dividida em Duas Partes - SIGA RIGOROSAMENTE)**

## **PARTE 1: Roteiro Objetivo (Use Formato Definido e Emojis ✨🎬📝🔥🚀🏷️)**

✨ **Sugestão de Título/Chamada (para o vídeo):** [Crie 1 título CURTO e MUITO CHAMATIVO, otimizado para retenção inicial, **diretamente relacionado ao TEMA IDENTIFICADO**]

🎬 **Roteiro/Outline Sugerido:**

1.  🔥 **Gancho Rápido (0-3s MAX):** [Descreva 1 forma **VISUAL** ou **TEXTUAL** (texto na tela) de capturar a atenção **IMEDIATAMENTE**, usando técnicas atuais (curiosidade, polêmica controlada, pergunta direta, estatística chocante, etc.) **100% conectada ao TEMA IDENTIFICADO**.]
2.  📝 **Desenvolvimento 1 (Essência Atualizada do Tema):** [Apresente o 1º ponto chave **do TEMA IDENTIFICADO**, já incorporando uma perspectiva atual ou dica relevante **sobre esse tema**. Use frases curtas. Sugira elemento visual/texto de apoio moderno. **MÁXIMO 5-10s**]
3.  📝 **Desenvolvimento 2 (Detalhe/Aplicação Prática do Tema):** [Apresente o 2º ponto chave **do TEMA IDENTIFICADO**, talvez o 'como fazer' atualizado ou um exemplo relevante hoje **sobre esse tema**. Mantenha o ritmo. **MÁXIMO 5-10s**]
4.  📝 **Desenvolvimento 3 (Opcional - Valor Extra sobre o Tema):** [Adicione um 3º ponto **APENAS** se for crucial para a mensagem **do TEMA IDENTIFICADO** e couber em **~5s**. Pode ser um reforço, dica extra ou conclusão rápida do desenvolvimento **desse tema**.]
5.  🚀 **Chamada para Ação (CTA) Clara e Eficaz:** [Sugira **UMA** ação **CLARA**, **SIMPLES** e **RELEVANTE** para o conteúdo **do TEMA IDENTIFICADO**, usando formatos de CTA que funcionam bem atualmente. *Ex: "Comenta aqui sua opinião sobre [tema]!", "Salva pra testar essa dica depois!", "Compartilha com quem precisa saber disso!", "Me segue pra mais sobre [tema]!", "Link na bio para [benefício claro relacionado ao tema]!"*]

🏷️ **Sugestão de Legenda (Curta, Direta e Otimizada):** [Escreva 1 legenda **MUITO CURTA** (1-2 frases) **sobre o TEMA IDENTIFICADO**. Pode reforçar o gancho ou o CTA. **OBRIGATÓRIO** incluir 2-3 hashtags relevantes (#${hashtagProposal} #${hashtagContext}) e talvez 1 hashtag de tendência **relevante ao tema** (se aplicável e seguro).]

--- *(Use um separador simples)*---

## **PARTE 2: Conversa e Próximos Passos (Tom de Consultora - CONCISO e DIRETO)**
*(Retome um tom mais conversacional, mas MANTENHA A CONCISÃO e seja direta. EVITE REPETIR o roteiro.)*
[Faça UM breve comentário sobre o roteiro gerado para o tema específico. Ex: "Aqui está uma sugestão de roteiro otimizada sobre **[Tema Identificado]**..." ou "Usei a ideia do seu post de sucesso para criar este roteiro sobre **[Tema Identificado]**, adicionando algumas táticas atuais..."]
**[Faça UMA pergunta CONCISA e relevante sobre o roteiro ou próximos passos. EVITE perguntas genéricas.]**
* **Exemplos VARIADOS (Adapte!):**
    * "Essa estrutura de roteiro te ajuda a visualizar o vídeo final, ${userName}?"
    * "Pronto(a) para transformar esse outline em vídeo, ${userName}?"
    * "Algum ponto desse roteiro que você gostaria de refinar antes de gravar, ${userName}?"
* **EVITE:** "Precisa de mais algo?".

# **Observações Adicionais para o Assistente:**
1.  **Vídeo Curto Otimizado:** Pense em Reels/TikTok/Shorts. Ritmo rápido, concisão máxima, **elementos de retenção**.
2.  **Visual e Tendências:** Sugira elementos visuais ou texto na tela alinhados com estéticas atuais.
3.  **Foco no Tema:** Crie um roteiro NOVO e MELHORADO, **ancorado no TEMA IDENTIFICADO** a partir da Descrição Exemplo. Use a Proposta/Contexto e seu conhecimento geral para **enriquecer** o roteiro sobre esse tema, não para criar um roteiro sobre o exemplo em si.
4.  **Histórico:** Se já fez roteiro sobre TEMA IDÊNTICO recentemente, **obrigatoriamente** aplique um ângulo ou formato **novo e atualizado para o mesmo tema**.
5.  **Direto ao Ponto:** Assuma que a solicitação e os dados fornecidos são claros e **gere o roteiro diretamente**, sem pedir confirmações desnecessárias sobre a tarefa.

# **Histórico Recente (Contexto da Conversa e Evitar Repetição Criativa):**
\`\`\`
${history}
\`\`\`
*Analise o histórico para **evitar gerar roteiros quase idênticos** e para entender o contexto da solicitação.*

# **SUA RESPOSTA PARA ${userName}:**
*(Siga **ESTRITAMENTE** a estrutura: Parte 1 (roteiro objetivo com formato/emojis otimizado para vídeo curto, focado no TEMA IDENTIFICADO da fonte e enriquecido com conhecimento atual) e Parte 2 (conversacional CONCISA e DIRETA com pergunta contextualizada).)*
`;
}


// =========================================================================
// <<< FIM DA FUNÇÃO MODIFICADA (generateScriptInstructions) >>>
// =========================================================================


// ====================================================
// FIM: promptService.ts - v3.Z.10 (Roteiro Sobre o Tema da Fonte)
// ====================================================
