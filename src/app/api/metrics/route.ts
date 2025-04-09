// src/app/api/metrics/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric from "@/app/models/Metric"; // Seu modelo Metric
import { DailyMetric } from "@/app/models/DailyMetric"; // Seu modelo DailyMetric
import { processMultipleImages } from "@/app/lib/parseMetrics"; // Sua função de processamento
import mongoose from "mongoose"; // Importar mongoose para tratamento de erro
import { parse } from 'date-fns'; // Para parsing robusto de data

// <<< NOVO: Importar a função de classificação >>>
import { classifyContent } from '@/app/lib/classification'; // <-- AJUSTE O CAMINHO SE NECESSÁRIO

export const runtime = "nodejs";

// Função auxiliar para parsear data DD/MM/YYYY (mantida)
function parseBrazilianDate(dateStr: string): Date | null {
    try {
        const parsed = parse(dateStr, 'dd/MM/yyyy', new Date());
        if (!isNaN(parsed.getTime())) {
            return parsed;
        }
        const directParsed = new Date(dateStr);
         if (!isNaN(directParsed.getTime())) {
             console.warn(`[parseBrazilianDate] Usando fallback de new Date() para: ${dateStr}`);
             return directParsed;
         }
        return null;
    } catch (e) {
        console.error(`[parseBrazilianDate] Erro ao parsear data ${dateStr}:`, e);
        return null;
    }
}


export async function POST(request: NextRequest) {
  try {
    // 1) Verifica autenticação
    const session = await getServerSession({ req: request, ...authOptions });
    if (!session?.user?.id) {
      console.error("[API Metrics POST] Erro: Usuário não autenticado.");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const userId = session.user.id;

    // 2) Extrai dados da requisição
    const { images, postLink, description } = await request.json();
    // Usando console.log/debug/info/warn/error para manter consistência com o arquivo original
    console.log(`[API Metrics POST] Recebido para User ${userId}: ${images?.length} imagens, link: ${postLink}, desc: ${description?.substring(0,50)}...`);

    // 3) Valida campos
    if (!images || !Array.isArray(images) || images.length === 0) {
      console.error("[API Metrics POST] Erro: Nenhuma imagem enviada.");
      return NextResponse.json({ error: "Nenhuma imagem enviada" }, { status: 400 });
    }
    // Descrição é essencial para a classificação agora
    if (!postLink || !description) {
       console.error("[API Metrics POST] Erro: Post link e descrição obrigatórios.");
      return NextResponse.json({ error: "Post link e descrição são obrigatórios" }, { status: 400 });
    }

    // 4) Conecta ao BD
    await connectToDatabase();
    console.log("[API Metrics POST] Conectado ao BD.");

    // 5) Processa imagens via parseMetrics (Document AI)
    console.log("[API Metrics POST] Processando imagens...");
    const { rawDataArray, stats } = await processMultipleImages(images);
    console.log("[API Metrics POST] Imagens processadas. Stats:", stats ? "OK" : "Falhou");
    if (!stats) {
        console.error("[API Metrics POST] Erro: Falha ao processar imagens/extrair stats.");
        return NextResponse.json({ error: "Falha ao processar imagens e extrair estatísticas." }, { status: 500 });
    }

    // 6) Determina postDate
    let postDate: Date | null = null;
    if (rawDataArray && rawDataArray.length > 0 && rawDataArray[0] && typeof rawDataArray[0]["Data de Publicação"] === "string") {
      const dateStr = rawDataArray[0]["Data de Publicação"] as string;
      console.log(`[API Metrics POST] Tentando parsear data da imagem: ${dateStr}`);
      postDate = parseBrazilianDate(dateStr);
    }
    if (!postDate) {
      postDate = new Date();
      console.warn(`[API Metrics POST] Não foi possível determinar postDate da imagem, usando data atual: ${postDate.toISOString()}`);
    } else {
         console.log(`[API Metrics POST] PostDate determinada: ${postDate.toISOString()}`);
    }

    // ---------------------------------------------------------------
    // 6.1 <<< NOVO: Classificar Conteúdo usando a Descrição >>>
    // ---------------------------------------------------------------
    let classification = { proposal: "Outro", context: "Geral" }; // Valores padrão
    // Verifica se a descrição existe antes de classificar
    if (description && description.trim()) {
        try {
            console.debug(`[API Metrics POST] Iniciando classificação para User ${userId}...`);
            classification = await classifyContent(description); // Chama a função importada
            console.info(`[API Metrics POST] Conteúdo classificado para User ${userId}: P=${classification.proposal}, C=${classification.context}`);
        } catch (classError) {
            console.error(`[API Metrics POST] Erro durante a classificação do conteúdo para User ${userId}. Usando defaults.`, classError);
            // classification já tem os valores padrão definidos acima
        }
    } else {
        // Se a descrição estiver vazia (embora tenhamos validado antes, é uma segurança extra)
        console.warn(`[API Metrics POST] Descrição vazia para User ${userId}. Usando defaults para classificação.`);
    }
    // ---------------------------------------------------------------
    // <<< FIM DA CLASSIFICAÇÃO >>>
    // ---------------------------------------------------------------


    // 7) <<< ALTERADO: Cria e salva o Metric com postDate, proposal e context >>>
    console.log("[API Metrics POST] Criando documento Metric...");
    const newMetric = new Metric({
      user: userId,
      postLink,
      description,
      rawData: rawDataArray,
      stats: stats, // Avalie se este campo é necessário aqui ou apenas no DailyMetric
      postDate: postDate,
      proposal: classification.proposal, // <<< ADICIONADO
      context: classification.context,   // <<< ADICIONADO
      createdAt: new Date(), // Mantido se você não usa timestamps: true no schema Metric
    });
    const savedMetric = await newMetric.save();
    console.log("[API Metrics POST] Documento Metric salvo:", savedMetric._id);

    // 8) Cria e salva o DailyMetric
    console.log("[API Metrics POST] Criando documento DailyMetric...");
    const newDailyMetric = new DailyMetric({
      user: userId,
      postId: savedMetric._id,
      postDate: postDate,
      stats: stats,
    });
    const savedDailyMetric = await newDailyMetric.save();
    console.log("[API Metrics POST] Documento DailyMetric salvo:", savedDailyMetric._id);

    // 9) Retorna sucesso
    console.log("[API Metrics POST] Processo concluído com sucesso.");
    return NextResponse.json(
      { metric: savedMetric, dailyMetric: savedDailyMetric },
      { status: 200 }
    );

  } catch (error: unknown) {
    // Tratamento de erro geral (mantido)
    console.error("[API Metrics POST] Erro GERAL no processamento:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (error instanceof mongoose.Error.ValidationError) {
        console.error("[API Metrics POST] Erro de Validação Mongoose:", error.errors);
        return NextResponse.json({ error: "Erro de validação: " + errorMessage, details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno do servidor: " + errorMessage }, { status: 500 });
  }
}