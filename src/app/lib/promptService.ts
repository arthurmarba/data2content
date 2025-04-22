// @/app/lib/promptService.ts - v3.Z.12 (corrigido)
// (Exporta Formatadores + integra as 3 Regras da Metodologia)

// ===========================
// IMPORTS
// ===========================
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { logger } from "@/app/lib/logger";
import { Types } from "mongoose";

// ===========================
// TIPOS E INTERFACES CENTRAIS
// ===========================
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
  avgComentarios?: number;
}

export interface DurationStat {
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
  _id: object;
  avgCompartilhamentos: number;
  avgSalvamentos: number;
  avgCurtidas: number;
  avgAlcance: number;
  avgComentarios: number;
  count: number;
  shareDiffPercentage?: number | null;
  saveDiffPercentage?: number | null;
  reachDiffPercentage?: number | null;
  commentDiffPercentage?: number | null;
  likeDiffPercentage?: number | null;
  bestPostInGroup?: Pick<IMetricMinimal, "_id" | "description" | "postLink">;
  avgVisualizacoes?: number;
  taxaRetencao?: number;
  taxaEngajamento?: number;
}

export interface DetailedContentStat extends BaseStat {
  _id: { format: string; proposal: string; context: string };
  topExamplesInGroup?: {
    _id: Types.ObjectId;
    description?: string;
    postLink?: string;
  }[];
}

export interface ProposalStat extends BaseStat {
  _id: { proposal: string };
}

export interface ContextStat extends BaseStat {
  _id: { context: string };
}

export interface IEnrichedReport {
  overallStats?: OverallStats;
  profileSegment?: string;
  multimediaSuggestion?: string;
  top3Posts?: Pick<IMetricMinimal, "_id" | "description" | "postLink">[];
  bottom3Posts?: Pick<IMetricMinimal, "_id" | "description" | "postLink">[];
  durationStats?: DurationStat[];
  detailedContentStats?: DetailedContentStat[];
  proposalStats?: ProposalStat[];
  contextStats?: ContextStat[];
  historicalComparisons?: object;
  longTermComparisons?: object;
}

// ===========================
// CONSTANTES INTERNAS
// ===========================
const METRICS_FETCH_DAYS_LIMIT = 180;
const DETAILED_STATS_LIMIT_FOR_PROMPT = 7;
const RANKING_LIMIT = 5;
const TOP_EXAMPLES_PER_GROUP_LIMIT = 3;

// helper para pegar campo de diff relevante dado foco default “Shares”
const DEFAULT_DIFF_FIELD: keyof DetailedContentStat = "shareDiffPercentage";

// ===========================
// FUNÇÕES AUXILIARES DE FORMATAÇÃO (exportadas)
// ===========================
export const formatNumericMetric = (
  value: number | undefined | null,
  precision = 1,
  suffix = ""
): string => {
  if (value !== undefined && value !== null && isFinite(value)) {
    return value.toFixed(precision) + suffix;
  }
  return "N/A";
};

export const formatPercentageDiff = (
  diff: number | undefined | null,
  label = ""
): string => {
  if (diff === undefined || diff === null || !isFinite(diff)) return "";
  const sign = diff >= 0 ? "+" : "";
  const labelPart = label ? ` ${label}` : "";
  return ` (${sign}${diff.toFixed(0)}%${labelPart})`;
};

const createSafeMarkdownLink = (
  text: string,
  url: string | undefined | null
): string => {
  if (url && /^https?:\/\//.test(url)) {
    return `[${text}](${url})`;
  }
  return "";
};

function formatFPCLabel(statId: StatId | undefined | null): string {
  if (!statId) return "Geral";
  const f =
    statId.format && statId.format !== "Desconhecido"
      ? `F:${statId.format}`
      : "";
  const p =
    statId.proposal && statId.proposal !== "Outro"
      ? `P:${statId.proposal}`
      : "";
  const c =
    statId.context && statId.context !== "Geral" ? `C:${statId.context}` : "";
  return [f, p, c].filter(Boolean).join("/") || "Geral";
}

function formatPostListForObjectiveResponse(
  posts: Pick<IMetricMinimal, "_id" | "description" | "postLink">[] | undefined
): string {
  if (!posts || posts.length === 0) return "(Nenhum)";
  return posts
    .map((p) => {
      const desc = p.description
        ? `${p.description.substring(0, 40)}...`
        : "Post sem descrição";
      const link = createSafeMarkdownLink("ver", p.postLink);
      return `${desc}${link ? ` (${link})` : ""}`;
    })
    .join("\n");
}

// ===========================
// FORMATADORES DE DADOS PARA PROMPT
// ===========================
function formatGeneralReportDataForPrompt(
  report: IEnrichedReport,
  maxDetailedStats = DETAILED_STATS_LIMIT_FOR_PROMPT
): string {
  let dataString = "";

  /* ---------- RESUMO GERAL ---------- */
  dataString += `\n## **Resumo Geral (Médias ${METRICS_FETCH_DAYS_LIMIT}d):**\n`;
  if (report.overallStats) {
    dataString += `• Alcance Médio: ${formatNumericMetric(
      report.overallStats.avgAlcance,
      0
    )}\n`;
    dataString += `• Compartilhamentos Médios: ${formatNumericMetric(
      report.overallStats.avgCompartilhamentos
    )}\n`;
    dataString += `• Salvamentos Médios: ${formatNumericMetric(
      report.overallStats.avgSalvamentos
    )}\n`;
    dataString += `• Comentários Médios: ${formatNumericMetric(
      report.overallStats.avgComentarios
    )}\n`;
    dataString += `• Curtidas Médias: ${formatNumericMetric(
      report.overallStats.avgCurtidas
    )}\n`;
  } else {
    dataString += "• Dados gerais indisponíveis\n";
  }

  /* ---------- TOP COMBINAÇÕES F/P/C ---------- */
  dataString += `\n## **Top ${maxDetailedStats} Combinações F/P/C (ordenadas por Compartilhamentos Relativos):**\n`;
  const detailed = report.detailedContentStats ?? [];
  if (detailed.length === 0) {
    dataString += "• Não há dados de combinações.\n";
  } else {
    const sorted = [...detailed].sort((a, b) => {
      const diffB = (b[DEFAULT_DIFF_FIELD] ?? -Infinity) as number;
      const diffA = (a[DEFAULT_DIFF_FIELD] ?? -Infinity) as number;
      return diffB - diffA;
    });
    sorted.slice(0, maxDetailedStats).forEach((stat, idx) => {
      const labels = formatFPCLabel(stat._id);
      dataString += `${idx + 1}. **${labels}** (${stat.count}p): Comp=${formatNumericMetric(
        stat.avgCompartilhamentos
      )}${formatPercentageDiff(stat.shareDiffPercentage)}, Salv=${formatNumericMetric(
        stat.avgSalvamentos
      )}${formatPercentageDiff(stat.saveDiffPercentage)}\n`;
    });
    if (detailed.length > maxDetailedStats) {
      dataString += `• ... (${detailed.length - maxDetailedStats} combinações omitidas)\n`;
    }
  }

  /* ---------- DURAÇÃO ---------- */
  dataString += "\n## **Desempenho por Duração (Vídeos):**\n";
  (report.durationStats ?? []).forEach((d) => {
    dataString += `• ${d.range} (${d.contentCount}p): Comp.Médio=${formatNumericMetric(
      d.averageShares,
      2
    )}, Salv.Médio=${formatNumericMetric(d.averageSaves, 2)}\n`;
  });
  if (!report.durationStats || report.durationStats.length === 0) {
    dataString += "• Não há dados de duração\n";
  }

  return dataString.trim();
}

// ===========================
// FUNÇÕES generate* (metodologia)
// ===========================
export function generateAIInstructions(
  userName: string,
  report: IEnrichedReport,
  history: string,
  tone: string,
  userQuery: string
): string {
  const today = format(new Date(), "PPP", { locale: ptBR });
  const perfBlock = formatGeneralReportDataForPrompt(report);

  // encontra melhor F/P/C
  const best = (report.detailedContentStats ?? [])
    .filter((s) => s.count > 0)
    .sort((a, b) => {
      const db = (b[DEFAULT_DIFF_FIELD] ?? -Infinity) as number;
      const da = (a[DEFAULT_DIFF_FIELD] ?? -Infinity) as number;
      return db - da;
    })[0];
  const mainIdea = best
    ? `${best._id.proposal} sobre ${best._id.context}`
    : "Ideia Principal";

  return `
# CONTEXTO
• Usuário: ${userName} | Segmento: ${report.profileSegment ?? "Geral"}
• Data: ${today}
• Pergunta: "${userQuery}"
• Histórico: ${history}

# DADOS
${perfBlock}

# TAREFA
Responda objetivamente: siga o formato **Destaque | Melhoria | Ideias**.

**Destaque**
• Combinação: ${formatFPCLabel(best?._id)}
• Comp=${formatNumericMetric(best?.avgCompartilhamentos)}${formatPercentageDiff(best?.shareDiffPercentage)}
• Ação: [sugestão curta]

**Melhoria**
• [item com pior diff]  
• Ação: [sugestão curta]

**Ideias de Conteúdo** (se solicitado)
• Ideia1 baseada em "${mainIdea}"  
• Ideia2 …

---
Referências:
Top3 → ${formatPostListForObjectiveResponse(report.top3Posts)}
Bottom3 → ${formatPostListForObjectiveResponse(report.bottom3Posts)}
`;
}

export function generateContentPlanInstructions(
  userName: string,
  report: IEnrichedReport,
  history: string,
  tone: string,
  userMsg: string,
  targetField: keyof DetailedContentStat | null,
  targetFriendly: string | null
): string {
  // versão simplificada, pode detalhar conforme sua lógica
  const block = formatGeneralReportDataForPrompt(report);
  const today = format(new Date(), "PPP", { locale: ptBR });
  return `
# PLANO SEMANAL
Usuário: ${userName} | Data: ${today}
Pedido: "${userMsg}"

${block}

Crie plano de 3-5 posts focando em ${targetFriendly ?? "Compartilhamentos Relativos"}.
`;
}

export function generateGroupedContentPlanInstructions(
  userName: string,
  combo: { proposal: string; context: string; stat: DetailedContentStat },
  report: IEnrichedReport,
  history: string,
  tone: string,
  userMsg: string,
  targetField: keyof DetailedContentStat | null,
  targetFriendly: string | null
): string {
  const today = format(new Date(), "PPP", { locale: ptBR });
  return `
# PLANO FOCO
Usuário: ${userName} | ${combo.proposal}/${combo.context} | Data: ${today}
Pedido: "${userMsg}"

Stat: ${formatNumericMetric(combo.stat.avgCompartilhamentos)} shares.
`;
}

export function generateScriptInstructions(
  userName: string,
  srcDescription: string,
  srcProposal: string | undefined,
  srcContext: string | undefined,
  history: string,
  tone: string,
  userMsg: string
): string {
  const today = format(new Date(), "PPP", { locale: ptBR });
  return `
# ROTEIRO
Usuário: ${userName} | Data: ${today}
Exemplo: "${srcDescription}"

Crie roteiro gancho → desenvolvimento → CTA.
`;
}

export function generateRankingInstructions(
  userName: string,
  report: IEnrichedReport,
  history: string,
  tone: string,
  userMsg: string
): string {
  const today = format(new Date(), "PPP", { locale: ptBR });
  const block = formatGeneralReportDataForPrompt(report);
  return `
# RANKING
Usuário: ${userName} | Data: ${today}
${block}

Liste os Top ${RANKING_LIMIT}.
`;
}

// ===========================
// EXPORTAÇÕES DE CONVENIÊNCIA
// ===========================
export const promptService = {
  formatNumericMetric,
  formatPercentageDiff,
  generateAIInstructions,
  generateContentPlanInstructions,
  generateGroupedContentPlanInstructions,
  generateScriptInstructions,
  generateRankingInstructions
};
