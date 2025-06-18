// src/app/api/metricsHistory/route.ts - v1.2 (Corrigido e Forçado Dinâmico)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Ajuste o caminho
import mongoose, { PipelineStage } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose"; // Ajuste o caminho
import Metric from "@/app/models/Metric"; // <<< USA MetricModel >>>
import type { Session } from "next-auth";
import { logger } from '@/app/lib/logger'; // Ajuste o caminho
import { camelizeKeys } from '@/utils/camelizeKeys';

// <<< ADICIONADO: Força a rota a ser dinâmica >>>
export const dynamic = 'force-dynamic';
// Garante que essa rota use Node.js em vez de Edge (mantido)
export const runtime = "nodejs";


/**
 * Interface auxiliar para o usuário na sessão.
 */
interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

/**
 * GET /api/metricsHistory?userId=...&days=30
 *
 * Agrupa por dia e calcula a média de métricas avançadas.
 * ATUALIZADO v1.2: Consulta MetricModel, usa chaves canônicas e força renderização dinâmica.
 */
export async function GET(request: NextRequest) { // Usa NextRequest
  const TAG = '[API metricsHistory GET v1.2]'; // Atualiza tag
  try {
    // 1) Obtém a sessão (esta chamada usa headers implicitamente)
    const session = (await getServerSession({ req: request, ...authOptions })) as Session | null;
    if (!session?.user) {
      logger.warn(`${TAG} Tentativa de acesso não autenticada.`);
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 2) Extrai userId dos query params
    const { searchParams } = request.nextUrl; // Usa nextUrl
    const userId = searchParams.get("userId");
    if (!userId) {
      logger.warn(`${TAG} userId não fornecido nos query params.`);
      return NextResponse.json({ error: "userId é obrigatório" }, { status: 400 });
    }

    // 3) Verifica se session.user tem 'id'
    const userWithId = session.user as SessionUser;
    if (!userWithId.id) {
      logger.error(`${TAG} Sessão encontrada, mas sem ID de usuário.`);
      return NextResponse.json({ error: "Sessão inválida (sem ID)" }, { status: 500 });
    }

    // Compara userId do query param com session.user.id
    if (userId !== userWithId.id) {
      logger.warn(`${TAG} Tentativa de acesso não autorizada. User ${userWithId.id} tentando acessar dados de ${userId}.`);
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 4) Lê "days" ou usa 360 como padrão
    const daysParam = searchParams.get("days") || "360";
    let days = parseInt(daysParam, 10);
    if (isNaN(days) || days <= 0) {
        logger.warn(`${TAG} Parâmetro 'days' inválido: ${daysParam}. Usando 360.`);
        days = 360; // Usa default se inválido
    }
    logger.info(`${TAG} Buscando histórico para User ${userId}, últimos ${days} dias.`);


    // 5) Conecta ao banco
    await connectToDatabase();
    const objectId = new mongoose.Types.ObjectId(userId);

    // Data inicial: X dias atrás
    const fromDate = new Date();
    fromDate.setHours(0, 0, 0, 0); // Zera a hora para pegar desde o início do dia
    fromDate.setDate(fromDate.getDate() - days);
    logger.debug(`${TAG} Data inicial da busca: ${fromDate.toISOString()}`);

    // 6) Define o pipeline de agregação (Consultando MetricModel e usando chaves canônicas)
    const sortSpec: Record<string, 1 | -1> = {
      "_id.year": 1, "_id.month": 1, "_id.day": 1,
    };

    const pipeline: PipelineStage[] = [
      { $match: { user: objectId, postDate: { $gte: fromDate } } }, // Filtra por postDate no MetricModel
      {
        $group: {
          _id: { year: { $year: "$postDate" }, month: { $month: "$postDate" }, day: { $dayOfMonth: "$postDate" } },
          // <<< USA CHAVES CANÔNICAS/DESCRITIVAS DE Metric.stats >>>
          avgEngagementRate: { $avg: "$stats.engagement_rate" }, // Taxa de engajamento sobre alcance
          avgPropagationIndex: { $avg: "$stats.propagation_index" },
          avgLikeCommentRatio: { $avg: "$stats.like_comment_ratio" },
          avgSaveRateOnReach: { $avg: "$stats.save_rate_on_reach" },
          avgFollowerConversionRate: { $avg: "$stats.follower_conversion_rate" },
          avgRetentionRate: { $avg: "$stats.retention_rate" },
          avgEngagementDeepVsReach: { $avg: "$stats.engagement_deep_vs_reach" },
          avgEngagementFastVsReach: { $avg: "$stats.engagement_fast_vs_reach" },
          avgLikes: { $avg: "$stats.likes" }, // Média de likes
          avgComments: { $avg: "$stats.comments" }, // Média de comentários
          // Adicionar outras médias se necessário para os gráficos
          // avgShares: { $avg: "$stats.shares" },
          // avgSaved: { $avg: "$stats.saved" },
          // avgReach: { $avg: "$stats.reach" },
          // avgViews: { $avg: "$stats.views" },
          count: { $sum: 1 } // Conta quantos posts por dia
        },
      },
      { $sort: sortSpec },
    ];

    // 7) Executa agregação no MetricModel
    logger.debug(`${TAG} Executando agregação no MetricModel...`);
    const results = await Metric.aggregate(pipeline); // <<< USA Metric.aggregate >>>
    logger.info(`${TAG} Agregação concluída. ${results.length} dias com dados encontrados.`);

    // 8) Monta arrays de dados para cada métrica (usando novas chaves de resultado)
    const labels: string[] = [];
    const arrEngagementRate: number[] = []; const arrPropagationIndex: number[] = [];
    const arrLikeCommentRatio: number[] = []; const arrSaveRate: number[] = [];
    const arrFollowerConversion: number[] = []; const arrRetentionRate: number[] = [];
    const arrEngajDeep: number[] = []; const arrEngajFast: number[] = [];
    const arrLikes: number[] = []; const arrComments: number[] = [];

    // Função auxiliar para parsear e tratar nulos/NaN da agregação
    const parseAvg = (value: any): number => {
        // Tenta converter para string antes de parseFloat para lidar com tipos inesperados
        const num = parseFloat(String(value ?? "0").replace(",",".")); // Garante ponto decimal
        return isNaN(num) || !isFinite(num) ? 0 : num;
    };

    results.forEach((doc) => {
      const { year, month, day } = doc._id;
      // Formata a data consistentemente como YYYY-MM-DD
      const label = `${String(year).padStart(4, '0')}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      labels.push(label);

      // Usa as novas chaves do $group e a função parseAvg
      arrEngagementRate.push(parseAvg(doc.avgEngagementRate));
      arrPropagationIndex.push(parseAvg(doc.avgPropagationIndex));
      arrLikeCommentRatio.push(parseAvg(doc.avgLikeCommentRatio));
      arrSaveRate.push(parseAvg(doc.avgSaveRateOnReach));
      arrFollowerConversion.push(parseAvg(doc.avgFollowerConversionRate));
      arrRetentionRate.push(parseAvg(doc.avgRetentionRate));
      arrEngajDeep.push(parseAvg(doc.avgEngagementDeepVsReach));
      arrEngajFast.push(parseAvg(doc.avgEngagementFastVsReach));
      arrLikes.push(parseAvg(doc.avgLikes));
      arrComments.push(parseAvg(doc.avgComments));
    });

    // 9) Retorna objeto "history" com dados para os gráficos (nomes das métricas atualizados)
    const history = {
      engagementRate: { // Renomeado para refletir a métrica
        labels,
        datasets: [ { label: "Taxa Engajamento / Alcance (%)", data: arrEngagementRate.map(v => v * 100), /* ... cores ... */ } ],
      },
      propagationIndex: { // Renomeado
        labels,
        datasets: [ { label: "Índice de Propagação (%)", data: arrPropagationIndex.map(v => v * 100), /* ... cores ... */ } ],
      },
      likeCommentRatio: { // Renomeado
        labels,
        datasets: [ { label: "Razão Like/Comentário", data: arrLikeCommentRatio, /* ... cores ... */ } ], // Não multiplica por 100
      },
      saveRateOnReach: { // Renomeado
        labels,
        datasets: [ { label: "Taxa Salvamento / Alcance (%)", data: arrSaveRate.map(v => v * 100), /* ... cores ... */ } ],
      },
      followerConversionRate: { // Renomeado
        labels,
        datasets: [ { label: "Taxa Conversão Seg. (%)", data: arrFollowerConversion.map(v => v * 100), /* ... cores ... */ } ],
      },
      retentionRate: { // Renomeado
        labels,
        datasets: [ { label: "Taxa Retenção Média (%)", data: arrRetentionRate.map(v => v * 100), /* ... cores ... */ } ],
      },
      engagementDeepVsReach: { // Renomeado
        labels,
        datasets: [ { label: "Engaj. Profundo / Alcance (%)", data: arrEngajDeep.map(v => v * 100), /* ... cores ... */ } ],
      },
      engagementFastVsReach: { // Renomeado
        labels,
        datasets: [ { label: "Engaj. Rápido / Alcance (%)", data: arrEngajFast.map(v => v * 100), /* ... cores ... */ } ],
      },
      likes: { // Renomeado
        labels,
        datasets: [ { label: "Curtidas (média diária)", data: arrLikes, /* ... cores ... */ } ],
      },
      comments: { // Renomeado
        labels,
        datasets: [ { label: "Comentários (média diária)", data: arrComments, /* ... cores ... */ } ],
      },
    };
    // Adicionar cores aos datasets se necessário para os gráficos
    // Ex: borderColor: "rgba(75,192,192,1)", backgroundColor: "rgba(75,192,192,0.2)"

    logger.info(`${TAG} Histórico de métricas preparado para User ${userId}.`);
    const camelHistory = camelizeKeys(history);
    return NextResponse.json({ history: camelHistory }, { status: 200 });

  } catch (error: unknown) {
    logger.error(`${TAG} Erro:`, error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    if (error instanceof Error && error.message.includes("Argument passed in must be a single String")) {
        return NextResponse.json({ error: "Formato de userId inválido." }, { status: 400 });
    }
    // Verifica se é o erro de DynamicServerError para dar uma mensagem mais específica
    if (error instanceof Error && (error as any).digest === 'DYNAMIC_SERVER_USAGE') {
        logger.error(`${TAG} Erro de Geração Estática: A rota usou uma função dinâmica (headers, cookies, etc.). Certifique-se que 'export const dynamic = \"force-dynamic\";' está no topo do arquivo.`);
        return NextResponse.json({ error: "Erro interno do servidor durante a geração da página." }, { status: 500 });
    }
    return NextResponse.json({ error: `Erro ao buscar histórico: ${message}` }, { status: 500 });
  }
}
