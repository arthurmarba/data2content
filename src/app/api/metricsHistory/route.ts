// src/app/api/metricsHistory/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/authOptions";

import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { DailyMetric } from "@/app/models/DailyMetric";

/**
 * GET /api/metricsHistory?userId=...&days=30
 *
 * Agrupa por dia e calcula a média de métricas avançadas (ex.: taxaEngajamento).
 * Verifica se o userId do query param corresponde ao session.user.id (usuário logado).
 */
export async function GET(request: Request) {
  try {
    // 1) Verifica se há sessão
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 2) Extrai userId dos query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ history: null }, { status: 200 });
    }

    // 3) Força que session.user tenha a propriedade "id"
    // Se não tiver, retornamos erro ou algo similar
    const userWithId = session.user as {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      // ...caso queira mais chaves
    };

    if (!userWithId.id) {
      return NextResponse.json(
        { error: "Sessão sem ID de usuário" },
        { status: 400 }
      );
    }

    // Verifica se userId corresponde ao ID da sessão
    if (userId !== userWithId.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 4) Lê "days" ou usa 360 como padrão
    const daysParam = searchParams.get("days") || "360";
    const days = parseInt(daysParam, 10) || 360;

    // 5) Conecta ao banco
    await connectToDatabase();
    const objectId = new mongoose.Types.ObjectId(userId);

    // Data inicial: X dias atrás
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    // Pipeline de agregação
    const pipeline = [
      {
        $match: {
          user: objectId,
          postDate: { $gte: fromDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$postDate" },
            month: { $month: "$postDate" },
            day: { $dayOfMonth: "$postDate" },
          },
          avgTaxaEngajamento: { $avg: "$stats.taxaEngajamento" },
          avgIndicePropagacao: { $avg: "$stats.indicePropagacao" },
          avgRatioLikeComment: { $avg: "$stats.ratioLikeComment" },
          avgPctSalvamentos: { $avg: "$stats.pctSalvamentos" },
          avgTaxaConversaoSeguidores: { $avg: "$stats.taxaConversaoSeguidores" },
          avgTaxaRetencao: { $avg: "$stats.taxaRetencao" },
          avgEngajamentoProfundoAlcance: {
            $avg: "$stats.engajamentoProfundoAlcance",
          },
          avgEngajamentoRapidoAlcance: {
            $avg: "$stats.engajamentoRapidoAlcance",
          },
          avgCurtidas: { $avg: "$stats.curtidas" },
          avgComentarios: { $avg: "$stats.comentarios" },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.day": 1,
        },
      },
    ];

    // 6) Executa agregação
    const results = await DailyMetric.aggregate(pipeline);

    // 7) Monta arrays de dados para cada métrica
    const labels: string[] = [];
    const arrTaxaEngajamento: number[] = [];
    const arrIndicePropagacao: number[] = [];
    const arrRatioLikeComment: number[] = [];
    const arrPctSalvamentos: number[] = [];
    const arrTaxaConversaoSeguidores: number[] = [];
    const arrTaxaRetencao: number[] = [];
    const arrEngajProfundo: number[] = [];
    const arrEngajRapido: number[] = [];
    const arrCurtidas: number[] = [];
    const arrComentarios: number[] = [];

    // Preenche arrays
    results.forEach((doc) => {
      const { year, month, day } = doc._id;
      const label = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      labels.push(label);

      arrTaxaEngajamento.push(parseFloat(doc.avgTaxaEngajamento || 0));
      arrIndicePropagacao.push(parseFloat(doc.avgIndicePropagacao || 0));
      arrRatioLikeComment.push(parseFloat(doc.avgRatioLikeComment || 0));
      arrPctSalvamentos.push(parseFloat(doc.avgPctSalvamentos || 0));
      arrTaxaConversaoSeguidores.push(parseFloat(doc.avgTaxaConversaoSeguidores || 0));
      arrTaxaRetencao.push(parseFloat(doc.avgTaxaRetencao || 0));
      arrEngajProfundo.push(parseFloat(doc.avgEngajamentoProfundoAlcance || 0));
      arrEngajRapido.push(parseFloat(doc.avgEngajamentoRapidoAlcance || 0));
      arrCurtidas.push(parseFloat(doc.avgCurtidas || 0));
      arrComentarios.push(parseFloat(doc.avgComentarios || 0));
    });

    // 8) Retorna objeto "history" no formato esperado
    const history = {
      taxaEngajamento: {
        labels,
        datasets: [
          {
            label: "Taxa Engajamento (%)",
            data: arrTaxaEngajamento,
            borderColor: "rgba(75,192,192,1)",
            backgroundColor: "rgba(75,192,192,0.2)",
          },
        ],
      },
      indicePropagacao: {
        labels,
        datasets: [
          {
            label: "Índice de Propagação (%)",
            data: arrIndicePropagacao,
            borderColor: "rgba(153,102,255,1)",
            backgroundColor: "rgba(153,102,255,0.2)",
          },
        ],
      },
      ratioLikeComment: {
        labels,
        datasets: [
          {
            label: "Razão Like/Coment (%)",
            data: arrRatioLikeComment,
            borderColor: "rgba(255,159,64,1)",
            backgroundColor: "rgba(255,159,64,0.2)",
          },
        ],
      },
      pctSalvamentos: {
        labels,
        datasets: [
          {
            label: "Pct Salvamentos (%)",
            data: arrPctSalvamentos,
            borderColor: "rgba(54,162,235,1)",
            backgroundColor: "rgba(54,162,235,0.2)",
          },
        ],
      },
      taxaConversaoSeguidores: {
        labels,
        datasets: [
          {
            label: "Taxa Conversão Seg (%)",
            data: arrTaxaConversaoSeguidores,
            borderColor: "rgba(255,206,86,1)",
            backgroundColor: "rgba(255,206,86,0.2)",
          },
        ],
      },
      taxaRetencao: {
        labels,
        datasets: [
          {
            label: "Taxa Retenção (%)",
            data: arrTaxaRetencao,
            borderColor: "rgba(255,99,132,1)",
            backgroundColor: "rgba(255,99,132,0.2)",
          },
        ],
      },
      engajamentoProfundoAlcance: {
        labels,
        datasets: [
          {
            label: "Engaj. Profundo Alcance (%)",
            data: arrEngajProfundo,
            borderColor: "rgba(0,128,128,1)",
            backgroundColor: "rgba(0,128,128,0.2)",
          },
        ],
      },
      engajamentoRapidoAlcance: {
        labels,
        datasets: [
          {
            label: "Engaj. Rápido Alcance (%)",
            data: arrEngajRapido,
            borderColor: "rgba(128,0,128,1)",
            backgroundColor: "rgba(128,0,128,0.2)",
          },
        ],
      },
      curtidas: {
        labels,
        datasets: [
          {
            label: "Curtidas (média)",
            data: arrCurtidas,
            borderColor: "rgba(255,99,132,1)",
            backgroundColor: "rgba(255,99,132,0.2)",
          },
        ],
      },
      comentarios: {
        labels,
        datasets: [
          {
            label: "Comentários (média)",
            data: arrComentarios,
            borderColor: "rgba(75,192,192,1)",
            backgroundColor: "rgba(75,192,192,0.2)",
          },
        ],
      },
    };

    return NextResponse.json({ history }, { status: 200 });
  } catch (error: unknown) {
    console.error("/api/metricsHistory error:", error);

    let message = "Erro desconhecido.";
    if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
