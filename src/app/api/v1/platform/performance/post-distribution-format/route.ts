import { NextResponse } from 'next/server';
import MetricModel from '@/app/models/Metric'; // Descomente para implementação real
// Defina FormatType localmente se o módulo não existir
export enum FormatType {
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  REEL = "REEL",
  CAROUSEL_ALBUM = "CAROUSEL_ALBUM",
  // Adicione outros tipos conforme necessário
}
// import { FormatType } from '@/app/models/FormatType'; // Corrija o caminho e a forma de importação conforme sua definição real
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers'; // Descomente para implementação real

// Tipos de dados para a resposta
interface PostDistributionDataPoint {
  name: string;
  value: number; // Número de posts para este formato
  percentage: number;
}

interface PlatformPostDistributionResponse {
  chartData: PostDistributionDataPoint[];
  insightSummary?: string;
}

const ALLOWED_TIME_PERIODS: string[] = ["all_time", "last_7_days", "last_30_days", "last_90_days", "last_6_months", "last_12_months"];

// Mapeamento de formato (pode vir de uma config ou ser mais elaborado)
const DEFAULT_FORMAT_MAPPING: { [key: string]: string } = {
  [FormatType.IMAGE]: "Imagem",
  [FormatType.VIDEO]: "Vídeo",
  [FormatType.REEL]: "Reel",
  [FormatType.CAROUSEL_ALBUM]: "Carrossel",
  // Adicionar outros FormatType aqui se existirem
  "TEXT": "Texto", // Exemplo se houver um formato 'TEXT'
  "UNKNOWN": "Desconhecido"
};
const DEFAULT_MAX_SLICES = 7; // Default para o gráfico de pizza/donut


export async function GET(
  request: Request
) {
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  const maxSlicesParam = searchParams.get('maxSlices');

  const timePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
    ? timePeriodParam
    : "last_90_days";

  let maxSlices = DEFAULT_MAX_SLICES;
  if (maxSlicesParam) {
    const parsedMaxSlices = parseInt(maxSlicesParam, 10);
    if (!isNaN(parsedMaxSlices) && parsedMaxSlices > 0) {
      maxSlices = parsedMaxSlices;
    } else {
      console.warn(`Parâmetro maxSlices inválido: ${maxSlicesParam}. Usando default: ${DEFAULT_MAX_SLICES}`);
    }
  }

  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  try {
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const startDate = getStartDateFromTimePeriod(today, timePeriod);

    const queryConditions: any = {
        // TODO: Adicionar filtro para apenas usuários ativos da plataforma, se necessário
    };
    if (timePeriod !== "all_time") {
      queryConditions.postDate = { $gte: startDate, $lte: endDate };
    }

    // Agregação real no banco de dados para contar posts por formato
    const aggregationResult = await MetricModel.aggregate([
      { $match: queryConditions },
      { $group: { _id: "$format", count: { $sum: 1 } } },
      { $sort: { count: -1 } } // Ordenar por contagem descendente
    ]);

    if (!aggregationResult || aggregationResult.length === 0) {
        return NextResponse.json({
            chartData: [],
            insightSummary: "Nenhum post encontrado na plataforma para o período."
        }, { status: 200 });
    }

    const grandTotalPosts = aggregationResult.reduce((sum, item) => sum + item.count, 0);

    let tempChartData: PostDistributionDataPoint[] = aggregationResult.map(item => {
      const formatKey = item._id as string || "UNKNOWN"; // Lidar com formatos nulos/undefined do DB
      const formatName = DEFAULT_FORMAT_MAPPING[formatKey] || formatKey.toString().replace(/_/g, ' ').toLocaleLowerCase().replace(/\b\w/g, l => l.toUpperCase());
      return {
        name: formatName,
        value: item.count,
        percentage: grandTotalPosts > 0 ? (item.count / grandTotalPosts) * 100 : 0,
      };
    });

    let finalChartData = tempChartData;
    if (tempChartData.length > maxSlices) {
        const visibleSlices = tempChartData.slice(0, maxSlices - 1);
        const otherSlices = tempChartData.slice(maxSlices - 1);
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
    } else if (finalChartData.length > 0 && finalChartData[0]) {
        response.insightSummary += ` O formato mais comum é ${finalChartData[0].name} (${finalChartData[0].percentage.toFixed(1)}%).`;
    }


    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error("[API PLATFORM/PERFORMANCE/POST-DISTRO-FORMAT] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação.", details: errorMessage }, { status: 500 });
  }
}

