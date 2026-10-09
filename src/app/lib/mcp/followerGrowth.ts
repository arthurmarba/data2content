import { getDailyFollowerGrowth, type DailyFollowerGrowth } from "@/app/lib/followers/dailyFollowerGrowth";
import {
  loadInstagramReportedNewFollowers,
  type InstagramReportedNewFollowers,
} from "@/app/lib/followers/instagramReportedNewFollowers";
import { resolveMcpPeriodWindow } from "./periodAnalysis";

/** Um ano é o teto: a série diária é para leitura, não para exportação em massa. */
const MAX_PERIOD_DAYS = 366;

export interface McpFollowerGrowthInput {
  userId: string;
  startDate: string;
  endDate: string;
  timeZone: string;
}

/**
 * Ponte entre o contrato de período do MCP (dias civis + fuso, validados) e o
 * serviço que calcula o ganho diário de seguidores.
 */
export async function getMcpFollowerGrowth(
  params: McpFollowerGrowthInput,
): Promise<DailyFollowerGrowth & {
  instagramReportedNewFollowers: InstagramReportedNewFollowers;
  analysisContract: string[];
}> {
  const window = resolveMcpPeriodWindow({
    startDate: params.startDate,
    endDate: params.endDate,
    timeZone: params.timeZone,
    maxDays: MAX_PERIOD_DAYS,
  });

  const [growth, instagramReportedNewFollowers] = await Promise.all([
    getDailyFollowerGrowth({
      userId: params.userId,
      startInclusive: window.startInclusive,
      endExclusive: window.endExclusive,
      startDate: window.startDate,
      endDate: window.endDate,
      timeZone: window.timeZone,
    }),
    loadInstagramReportedNewFollowers({
      userId: params.userId,
      startDate: window.startDate,
      endDate: window.endDate,
    }),
  ]);

  return {
    ...growth,
    instagramReportedNewFollowers,
    analysisContract: [
      "Fale em saldo de seguidores, não em seguidores conquistados: o número já desconta quem deixou de seguir.",
      "Dia ausente da série não é dia de saldo zero; use daysCovered antes de atribuir um ganho a uma data.",
      "Não atribua o ganho de um dia a um conteúdo específico sem o dado por conteúdo; publicar no mesmo dia não prova causa.",
      "Variação de poucas unidades em conta grande pode ser arredondamento do próprio Instagram.",
      "Se coverage.warnings apontar lacuna, diga isso antes de comparar semanas.",
      "O dia com dayIsComplete=false ainda está correndo: não o chame de queda nem o compare com dias fechados.",
      "Antes da primeira leitura, use instagramReportedNewFollowers: é quem começou a seguir segundo o Instagram, sem descontar quem saiu. Diga isso ao usar e não some ao saldo.",
    ],
  };
}
