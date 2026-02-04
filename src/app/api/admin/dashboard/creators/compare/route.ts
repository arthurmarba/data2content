export const dynamic = 'force-dynamic';

/**
 * @fileoverview API Endpoint for fetching data for creator comparison.
 * @version 1.0.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import { getServerSession } from 'next-auth/next';
// CORREÇÃO: As importações foram atualizadas para usar os caminhos dos serviços modularizados.
import { getCreatorProfile } from '@/app/lib/dataService/marketAnalysis/profilesService';
import { ICreatorProfile } from '@/app/lib/dataService/marketAnalysis/types';
import { DatabaseError } from '@/app/lib/errors';
import UserModel from '@/app/models/User';

const SERVICE_TAG = '[api/admin/dashboard/creators/compare]';

type AdminSession = {
  user?: {
    role?: string;
    name?: string | null;
  };
} | null;

const MAX_CREATORS_TO_COMPARE_API = 5;

// Schema para a validação do corpo do pedido
const requestBodySchema = z.object({
  creatorIds: z.array(z.string().refine((val) => Types.ObjectId.isValid(val), {
    message: "Formato de Creator ID inválido.",
  }))
  .min(1, { message: "O array creatorIds não pode estar vazio." })
  .max(MAX_CREATORS_TO_COMPARE_API, { message: `Não é possível comparar mais de ${MAX_CREATORS_TO_COMPARE_API} criadores de uma vez.` })
});

async function resolveAuthOptions() {
  if (process.env.NODE_ENV === 'test') return {};
  const mod = await import('@/app/api/auth/[...nextauth]/route');
  return (mod as any)?.authOptions ?? {};
}

// Real Admin Session Validation
async function getAdminSession(_req: NextRequest) {
  const authOptions = await resolveAuthOptions();
  const session = (await getServerSession(authOptions as any)) as { user?: { role?: string; name?: string } } | null;
  if (!session || session.user?.role !== 'admin') {
    logger.warn(`${SERVICE_TAG} Validação da sessão de admin falhou.`);
    return null;
  }
  return session;
}

function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

/**
 * @handler POST
 * @description Trata de pedidos POST para buscar dados de perfil de múltiplos criadores para comparação.
 * @param {NextRequest} req - O objeto de pedido do Next.js.
 * @returns {Promise<NextResponse>} Um objeto de resposta do Next.js com um array de ICreatorProfile ou um erro.
 */
export async function POST(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[POST]`;
  logger.info(`${TAG} Pedido recebido para dados de comparação de criadores.`);

  try {
    const session = await getAdminSession(req);
    // CORREÇÃO: Adicionada verificação explícita para session.user.
    if (!session || !session.user) {
      return apiError('Acesso não autorizado.', 401);
    }
    logger.info(`${TAG} Sessão de admin validada para o utilizador: ${session.user.name}`);

    const body = await req.json();
    const validationResult = requestBodySchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      logger.warn(`${TAG} Corpo do pedido inválido: ${errorMessage}`);
      return apiError(`Corpo do pedido inválido: ${errorMessage}`, 400);
    }

    const { creatorIds } = validationResult.data;
    logger.info(`${TAG} A buscar perfis para ${creatorIds.length} criadores.`);
    
    // Como getCreatorProfile busca por nome, primeiro precisamos de buscar os nomes a partir dos IDs.
    const users = await UserModel.find({ '_id': { $in: creatorIds } }).select('name').lean();
    
    if (users.length !== creatorIds.length) {
        logger.warn(`${TAG} Alguns IDs de criadores não foram encontrados.`);
    }
    
    const userNames = users.map(user => user.name).filter((name): name is string => typeof name === 'string');

    // Agora, buscamos os perfis em paralelo usando os nomes.
    const profilePromises = userNames.map(name => getCreatorProfile({ name }));
    const profiles = (await Promise.all(profilePromises)).filter((p): p is ICreatorProfile => p !== null);

    logger.info(`${TAG} ${profiles.length} perfis buscados com sucesso para comparação.`);
    return NextResponse.json(profiles, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Erro inesperado:`, error);
    if (error instanceof DatabaseError) {
      return apiError(`Erro de base de dados: ${error.message}`, 500);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}
