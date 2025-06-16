import { NextResponse } from 'next/server';
// import MetricModel, { FormatType } from '@/app/models/Metric'; // Descomente para implementação real
// import { getStartDateFromTimePeriod } from '@/utils/dateHelpers'; // Descomente para implementação real

// Tipos de dados para a resposta
interface PostDistributionDataPoint {
  name: string; // Nome do formato (ex: "Reel", "Imagem")
  value: number; // Número de posts para este formato
  percentage: number; // Percentual em relação ao total de posts
}

interface PlatformPostDistributionResponse {
  chartData: PostDistributionDataPoint[];
  insightSummary?: string;
}

// Períodos de tempo permitidos (pode ser compartilhado)
const ALLOWED_TIME_PERIODS: string[] = ["all_time", "last_7_days", "last_30_days", "last_90_days", "last_6_months", "last_12_months"];

// Exemplo de mapeamento de formato (pode vir de uma config ou ser mais elaborado)
// Supondo que FormatType seja um enum/objeto importado de MetricModel
enum MockFormatType {
    IMAGE = "IMAGE",
    VIDEO = "VIDEO",
    REEL = "REEL",
    CAROUSEL_ALBUM = "CAROUSEL_ALBUM",
    TEXT = "TEXT" // Exemplo
}
const DEFAULT_FORMAT_MAPPING: { [key: string]: string } = {
  [MockFormatType.IMAGE]: "Imagem",
  [MockFormatType.VIDEO]: "Vídeo",
  [MockFormatType.REEL]: "Reel",
  [MockFormatType.CAROUSEL_ALBUM]: "Carrossel",
  [MockFormatType.TEXT]: "Texto",
};
const DEFAULT_MAX_SLICES = 5;


export async function GET(
  request: Request
) {
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  const maxSlicesParam = searchParams.get('maxSlices');

  const timePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
    ? timePeriodParam
    : "last_90_days"; // Default

  let maxSlices = DEFAULT_MAX_SLICES;
  if (maxSlicesParam) {
    const parsedMaxSlices = parseInt(maxSlicesParam, 10);
    if (!isNaN(parsedMaxSlices) && parsedMaxSlices > 0) {
      maxSlices = parsedMaxSlices;
    } else {
      // Não retorna erro 400 por param opcional, apenas usa o default ou ignora se inválido
      console.warn(`Parâmetro maxSlices inválido: ${maxSlicesParam}. Usando default: ${DEFAULT_MAX_SLICES}`);
    }
  }

  // Validação explícita para timePeriod se foi fornecido mas é inválido
  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  // --- Simulação de Lógica de Backend para Dados Agregados da Plataforma ---
  // Em uma implementação real, aqui seria uma consulta ao MetricModel:
  // const today = new Date();
  // const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  // const startDate = getStartDateFromTimePeriod(today, timePeriod);
  // const queryConditions: any = {};
  // if (timePeriod !== "all_time") {
  //   queryConditions.postDate = { $gte: startDate, $lte: endDate };
  // }
  // const aggregationResult = await MetricModel.aggregate([
  //   { $match: queryConditions },
  //   { $group: { _id: "$format", count: { $sum: 1 } } },
  //   { $sort: { count: -1 } }
  // ]);
  // let grandTotalPosts = aggregationResult.reduce((sum, item) => sum + item.count, 0);
  // let tempChartData: PostDistributionDataPoint[] = aggregationResult.map(item => ({
  //    name: DEFAULT_FORMAT_MAPPING[item._id as string] || item._id as string,
  //    value: item.count,
  //    percentage: grandTotalPosts > 0 ? (item.count / grandTotalPosts) * 100 : 0,
  // }));
  // Aplicar lógica de "Outros" aqui se tempChartData.length > maxSlices

  // Por agora, dados hardcoded para demonstração:
  const hardcodedData = [
    { name: DEFAULT_FORMAT_MAPPING[MockFormatType.REEL] || "Reel", value: 1200, percentage: 0 },
    { name: DEFAULT_FORMAT_MAPPING[MockFormatType.IMAGE] || "Imagem", value: 800, percentage: 0 },
    { name: DEFAULT_FORMAT_MAPPING[MockFormatType.CAROUSEL_ALBUM] || "Carrossel", value: 600, percentage: 0 },
    { name: DEFAULT_FORMAT_MAPPING[MockFormatType.VIDEO] || "Vídeo", value: 300, percentage: 0 },
    { name: DEFAULT_FORMAT_MAPPING[MockFormatType.TEXT] || "Texto", value: 100, percentage: 0 },
  ];
  const grandTotalPosts = hardcodedData.reduce((sum, item) => sum + item.value, 0);
  hardcodedData.forEach(item => item.percentage = grandTotalPosts > 0 ? (item.value / grandTotalPosts) * 100 : 0);

  let finalChartData = hardcodedData;
  if (hardcodedData.length > maxSlices) {
      const visibleSlices = hardcodedData.slice(0, maxSlices - 1);
      const otherSlices = hardcodedData.slice(maxSlices - 1);
      const sumValueOthers = otherSlices.reduce((sum, slice) => sum + slice.value, 0);
      finalChartData = [
          ...visibleSlices,
          {
              name: "Outros",
              value: sumValueOthers,
              percentage: grandTotalPosts > 0 ? (sumValueOthers / grandTotalPosts) * 100 : 0,
          },
      ];
  }


  const response: PlatformPostDistributionResponse = {
    chartData: finalChartData,
    insightSummary: `Distribuição de ${grandTotalPosts.toLocaleString()} posts totais da plataforma por formato (${timePeriod.replace("_", " ")}).`
  };
  if (finalChartData.find(item => item.name === "Outros")){
      response.insightSummary += ` Os formatos menos frequentes foram agrupados em "Outros".`;
  }


  return NextResponse.json(response, { status: 200 });

  // Exemplo de tratamento de erro (se fosse uma busca real)
  // catch (error) {
  //   console.error("[API PLATFORM/PERFORMANCE/POST-DISTRO-FORMAT] Error:", error);
  //   const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
  //   return NextResponse.json({ error: "Erro ao processar sua solicitação.", details: errorMessage }, { status: 500 });
  // }
}
```
