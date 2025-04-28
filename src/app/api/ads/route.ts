// src/app/api/ads/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Ajuste o caminho se necessário
import { connectToDatabase } from '@/app/lib/mongoose';
import AdDeal, { IAdDeal } from '@/app/models/AdDeal'; // Importa o modelo e a interface AdDeal
import { logger } from '@/app/lib/logger';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

/**
 * POST /api/ads
 * Cria um novo registo de parceria publicitária (AdDeal) para o utilizador autenticado.
 */
export async function POST(request: NextRequest) {
  const TAG = '[POST /api/ads]';

  try {
    // 1. Autenticação e Obtenção do ID do Utilizador
    logger.debug(`${TAG} Verificando sessão...`);
    const session = await getServerSession({ req: request, ...authOptions });
    if (!session?.user?.id) {
      logger.warn(`${TAG} Tentativa de acesso não autenticada.`);
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const userId = session.user.id;
    logger.info(`${TAG} Requisição recebida do User ${userId}.`);

    // 2. Extrair e Validar Dados do Corpo da Requisição
    let adData: Partial<IAdDeal>; // Usa Partial para tipagem inicial
    try {
      adData = await request.json();
      logger.debug(`${TAG} Corpo da requisição recebido:`, adData);
      // Validação básica (campos obrigatórios já são verificados pelo Mongoose)
      if (!adData.brandName || !adData.dealDate || !adData.deliverables || !adData.compensationType) {
         logger.warn(`${TAG} Dados inválidos recebidos: Faltam campos obrigatórios.`);
         return NextResponse.json({ error: 'Dados inválidos: Faltam campos obrigatórios (brandName, dealDate, deliverables, compensationType).' }, { status: 400 });
      }
       // Validação específica para deliverables (não pode ser vazio)
       if (!Array.isArray(adData.deliverables) || adData.deliverables.length === 0) {
           logger.warn(`${TAG} Dados inválidos: 'deliverables' está vazio.`);
           return NextResponse.json({ error: "Dados inválidos: A lista de 'deliverables' não pode estar vazia." }, { status: 400 });
       }
       // Validação de Datas (simples)
       if (isNaN(new Date(adData.dealDate).getTime())) {
            logger.warn(`${TAG} Dados inválidos: 'dealDate' inválida.`);
            return NextResponse.json({ error: "Dados inválidos: 'dealDate' inválida." }, { status: 400 });
       }
       if (adData.campaignStartDate && isNaN(new Date(adData.campaignStartDate).getTime())) {
            logger.warn(`${TAG} Dados inválidos: 'campaignStartDate' inválida.`);
            return NextResponse.json({ error: "Dados inválidos: 'campaignStartDate' inválida." }, { status: 400 });
       }
        if (adData.campaignEndDate && isNaN(new Date(adData.campaignEndDate).getTime())) {
            logger.warn(`${TAG} Dados inválidos: 'campaignEndDate' inválida.`);
            return NextResponse.json({ error: "Dados inválidos: 'campaignEndDate' inválida." }, { status: 400 });
       }


    } catch (error) {
      logger.error(`${TAG} Erro ao fazer parse do corpo JSON:`, error);
      return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
    }

    // 3. Conectar ao Banco de Dados
    logger.debug(`${TAG} Conectando ao banco de dados...`);
    await connectToDatabase();
    logger.debug(`${TAG} Conectado ao banco de dados.`);

    // 4. Criar e Salvar o Novo Documento AdDeal
    logger.debug(`${TAG} Criando novo documento AdDeal para User ${userId}...`);
    const newAdDeal = new AdDeal({
      ...adData, // Espalha os dados recebidos
      userId: userId, // Garante que o userId correto está associado
      // Garante que campos opcionais não enviados sejam undefined
      brandSegment: adData.brandSegment || undefined,
      campaignStartDate: adData.campaignStartDate ? new Date(adData.campaignStartDate) : undefined,
      campaignEndDate: adData.campaignEndDate ? new Date(adData.campaignEndDate) : undefined,
      compensationValue: adData.compensationValue ?? undefined,
      productValue: adData.productValue ?? undefined,
      notes: adData.notes || undefined,
      relatedPostId: adData.relatedPostId || undefined, // Permite relacionar post se ID for enviado
    });

    // Tenta salvar e trata erros de validação do Mongoose
    const savedAdDeal = await newAdDeal.save();
    logger.info(`${TAG} Novo AdDeal salvo com sucesso para User ${userId}. ID: ${savedAdDeal._id}`);

    // 5. Retornar Sucesso
    return NextResponse.json(savedAdDeal, { status: 201 }); // 201 Created

  } catch (error: unknown) {
    logger.error(`${TAG} Erro GERAL no processamento:`, error);

    // Trata erros de validação do Mongoose especificamente
    if (error instanceof mongoose.Error.ValidationError) {
      logger.warn(`${TAG} Erro de validação Mongoose:`, error.errors);
      // Extrai mensagens de erro para retornar ao cliente
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return NextResponse.json({ error: "Erro de validação.", details: validationErrors }, { status: 400 });
    }

    // Outros erros
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Erro interno do servidor", details: errorMessage }, { status: 500 });
  }
}

// --- GET /api/ads (Exemplo Básico) ---
/**
 * GET /api/ads
 * Retorna todos os registos de AdDeal para o utilizador autenticado.
 */
export async function GET(request: NextRequest) {
    const TAG = '[GET /api/ads]';
     try {
        // 1. Autenticação
        logger.debug(`${TAG} Verificando sessão...`);
        const session = await getServerSession({ req: request, ...authOptions });
        if (!session?.user?.id) {
            logger.warn(`${TAG} Tentativa de acesso não autenticada.`);
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }
        const userId = session.user.id;
        logger.info(`${TAG} Requisição recebida do User ${userId}.`);

        // 2. Conectar ao BD
        await connectToDatabase();
        logger.debug(`${TAG} Conectado ao banco de dados.`);

        // 3. Buscar AdDeals
        logger.debug(`${TAG} Buscando AdDeals para User ${userId}...`);
        const deals = await AdDeal.find({ userId: userId }).sort({ dealDate: -1 }); // Ordena pelos mais recentes
        logger.info(`${TAG} Encontrados ${deals.length} AdDeals para User ${userId}.`);

        // 4. Retornar Dados
        return NextResponse.json(deals, { status: 200 });

    } catch (error: unknown) {
        logger.error(`${TAG} Erro GERAL no processamento:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: "Erro interno do servidor", details: errorMessage }, { status: 500 });
    }
}

// --- TODO: Implementar PUT /api/ads/:id e DELETE /api/ads/:id se necessário ---
