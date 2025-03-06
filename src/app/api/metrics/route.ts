import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/authOptions";

import { connectToDatabase } from "@/app/lib/mongoose";
import { Metric } from "@/app/models/Metric";
import { DailyMetric } from "@/app/models/DailyMetric";
import { processMultipleImages } from "@/app/lib/documentAI";

/**
 * GET /api/metrics?userId=...
 * Lista as métricas de um usuário (coleção "Metric"), 
 * mas verifica se o userId é o mesmo da session (usuário logado).
 */
export async function GET(request: Request) {
  try {
    // 1) Verifica se há sessão
    const session = await getServerSession(request, authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 2) Lê o userId dos query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      // Se não passar userId, retorna vazio
      return NextResponse.json({ metrics: [] }, { status: 200 });
    }

    // 3) Compara userId com o session.user.id
    if (userId !== session.user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 4) Conecta ao banco e busca métricas
    await connectToDatabase();
    const objectId = new mongoose.Types.ObjectId(userId);
    const metrics = await Metric.find({ user: objectId }).sort({ createdAt: -1 });

    return NextResponse.json({ metrics }, { status: 200 });

  } catch (err: any) {
    console.error("GET /api/metrics error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/metrics
 * Recebe { images: [{base64File, mimeType}, ...], postLink, description }
 * (Removemos userId do body ou ignoramos se vier, pois usaremos session.user.id)
 *
 * - Verifica se usuário está logado.
 * - Usa session.user.id para salvar as métricas no banco.
 * - Chama Document AI e salva "Metric" + "DailyMetric".
 */
export async function POST(request: Request) {
  try {
    console.log("DOC_AI_ENDPOINT:", process.env.DOC_AI_ENDPOINT);

    // 1) Verifica sessão
    const session = await getServerSession(request, authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 2) Lê body
    await connectToDatabase();
    const body = await request.json();
    const { images, postLink, description } = body;

    // Validações básicas
    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "Nenhuma imagem enviada" }, { status: 400 });
    }

    // 3) ID do usuário vem da session, não do body
    const userId = session.user.id; 
    const objectId = new mongoose.Types.ObjectId(userId);

    // 4) Chama Document AI
    const { rawDataArray, stats } = await processMultipleImages(images);

    // 5) Cria registro na coleção "Metric"
    const newMetric = await Metric.create({
      user: objectId,
      postLink,
      description,
      rawData: rawDataArray,
      stats,
    });

    // 6) Também salva em "DailyMetric", usando stats.dataPublicacao (se válido) como postDate
    let postDate: Date;
    if (stats.dataPublicacao) {
      const parsed = new Date(stats.dataPublicacao);
      postDate = isNaN(parsed.getTime()) ? new Date() : parsed;
    } else {
      postDate = new Date();
    }

    await DailyMetric.create({
      user: objectId,
      postDate,
      stats,
    });

    return NextResponse.json({ metric: newMetric }, { status: 201 });

  } catch (err: any) {
    console.error("POST /api/metrics error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
