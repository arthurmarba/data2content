// src/app/api/ads/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { connectToDatabase } from '@/app/lib/mongoose';
import AdDeal, { IAdDeal } from '@/app/models/AdDeal'; // Importa o modelo e a interface AdDeal
import PubliCalculation from '@/app/models/PubliCalculation';
import { logger } from '@/app/lib/logger';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

type PricingLinkMethod = 'manual' | 'auto' | 'none';

type PricingLinkSnapshot = {
  sourceCalculationId?: mongoose.Types.ObjectId;
  pricingLinkMethod: PricingLinkMethod;
  pricingLinkConfidence: number;
  linkedCalculationJusto?: number;
  linkedCalculationReach?: number;
  linkedCalculationSegment?: string;
};

const DELIVERY_INFERENCE_WINDOW_DAYS = 21;

async function resolveAuthOptions() {
  if (process.env.NODE_ENV === 'test') return {};
  const mod = await import('@/app/api/auth/[...nextauth]/route');
  return (mod as any)?.authOptions ?? {};
}

function inferDeliveryTypeFromDeliverables(deliverables: string[]): 'conteudo' | 'evento' {
  const normalized = deliverables.join(' ').toLowerCase();
  if (
    normalized.includes('evento') ||
    normalized.includes('presença') ||
    normalized.includes('presenca') ||
    normalized.includes('palestra') ||
    normalized.includes('host')
  ) {
    return 'evento';
  }
  return 'conteudo';
}

function buildPricingLinkFromCalculation(
  calculation: any,
  method: PricingLinkMethod,
  confidence: number
): PricingLinkSnapshot {
  return {
    sourceCalculationId: calculation?._id ? new mongoose.Types.ObjectId(calculation._id) : undefined,
    pricingLinkMethod: method,
    pricingLinkConfidence: confidence,
    linkedCalculationJusto:
      typeof calculation?.result?.justo === 'number' && Number.isFinite(calculation.result.justo)
        ? calculation.result.justo
        : undefined,
    linkedCalculationReach:
      typeof calculation?.metrics?.reach === 'number' && Number.isFinite(calculation.metrics.reach)
        ? calculation.metrics.reach
        : undefined,
    linkedCalculationSegment:
      typeof calculation?.metrics?.profileSegment === 'string' && calculation.metrics.profileSegment.trim()
        ? calculation.metrics.profileSegment.trim().toLowerCase()
        : undefined,
  };
}

async function resolvePricingLinkSnapshot(input: {
  userId: string;
  sourceCalculationId?: string;
  deliverables: string[];
}): Promise<PricingLinkSnapshot> {
  const fallback: PricingLinkSnapshot = {
    pricingLinkMethod: 'none',
    pricingLinkConfidence: 0,
  };

  const normalizedUserId =
    mongoose.isValidObjectId(input.userId) ? new mongoose.Types.ObjectId(input.userId) : null;
  if (!normalizedUserId) return fallback;

  if (input.sourceCalculationId) {
    if (!mongoose.isValidObjectId(input.sourceCalculationId)) {
      const invalidError = new Error('Cálculo de origem inválido.');
      (invalidError as any).status = 400;
      throw invalidError;
    }

    const manualCalculation = await PubliCalculation.findOne({
      _id: input.sourceCalculationId,
      userId: normalizedUserId,
    })
      .select({ _id: 1, params: 1, result: 1, metrics: 1, createdAt: 1 })
      .lean()
      .exec();

    if (!manualCalculation) {
      const notFoundError = new Error('Cálculo de origem não encontrado para este usuário.');
      (notFoundError as any).status = 400;
      throw notFoundError;
    }

    return buildPricingLinkFromCalculation(manualCalculation, 'manual', 1.0);
  }

  const inferredDeliveryType = inferDeliveryTypeFromDeliverables(input.deliverables);
  const since = new Date();
  since.setDate(since.getDate() - DELIVERY_INFERENCE_WINDOW_DAYS);

  const autoCalculation = await PubliCalculation.findOne({
    userId: normalizedUserId,
    createdAt: { $gte: since },
    $or:
      inferredDeliveryType === 'evento'
        ? [{ 'params.deliveryType': 'evento' }, { 'params.format': 'evento' }]
        : [{ 'params.deliveryType': 'conteudo' }, { 'params.deliveryType': { $exists: false } }, { 'params.format': { $ne: 'evento' } }],
  })
    .sort({ createdAt: -1 })
    .select({ _id: 1, params: 1, result: 1, metrics: 1, createdAt: 1 })
    .lean()
    .exec();

  if (!autoCalculation) return fallback;
  return buildPricingLinkFromCalculation(autoCalculation, 'auto', 0.7);
}

/**
 * POST /api/ads
 * Cria um novo registo de parceria publicitária (AdDeal) para o utilizador autenticado.
 */
export async function POST(request: NextRequest) {
  const TAG = '[POST /api/ads]';

  try {
    // 1. Autenticação e Obtenção do ID do Utilizador
    logger.debug(`${TAG} Verificando sessão...`);
    const authOptions = await resolveAuthOptions();
    const session = (await getServerSession({ req: request, ...authOptions })) as any;
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

    const normalizedSourceCalculationId =
      typeof (adData as any).sourceCalculationId === 'string' && (adData as any).sourceCalculationId.trim()
        ? (adData as any).sourceCalculationId.trim()
        : undefined;

    const pricingLink = await resolvePricingLinkSnapshot({
      userId,
      sourceCalculationId: normalizedSourceCalculationId,
      deliverables: adData.deliverables as string[],
    });

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
      sourceCalculationId: pricingLink.sourceCalculationId ?? undefined,
      pricingLinkMethod: pricingLink.pricingLinkMethod,
      pricingLinkConfidence: pricingLink.pricingLinkConfidence,
      linkedCalculationJusto: pricingLink.linkedCalculationJusto,
      linkedCalculationReach: pricingLink.linkedCalculationReach,
      linkedCalculationSegment: pricingLink.linkedCalculationSegment,
    });

    // Tenta salvar e trata erros de validação do Mongoose
    const savedAdDeal = await newAdDeal.save();
    logger.info(`${TAG} Novo AdDeal salvo com sucesso para User ${userId}. ID: ${savedAdDeal._id}`);
    logger.info(`${TAG} ad_deal_pricing_linked`, {
      linkMethod: pricingLink.pricingLinkMethod,
      linkConfidence: pricingLink.pricingLinkConfidence,
      hasSourceCalculation: Boolean(normalizedSourceCalculationId),
    });

    // 5. Retornar Sucesso
    return NextResponse.json(savedAdDeal, { status: 201 }); // 201 Created

  } catch (error: unknown) {
    logger.error(`${TAG} Erro GERAL no processamento:`, error);

    const status = (error as any)?.status;
    if (status === 400) {
      const message = error instanceof Error ? error.message : 'Dados inválidos.';
      return NextResponse.json({ error: message }, { status: 400 });
    }

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
        const authOptions = await resolveAuthOptions();
        const session = (await getServerSession({ req: request, ...authOptions })) as any;
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
