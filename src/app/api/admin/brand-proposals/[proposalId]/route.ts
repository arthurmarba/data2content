import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';

import { logger } from '@/app/lib/logger';
import { getAdminSession } from '@/lib/getAdminSession';
import { fetchBrandProposalById } from '@/lib/services/adminCreatorService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/admin/brand-proposals/:proposalId]';

function apiError(message: string, status: number) {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { proposalId: string } }
) {
  const TAG = `${SERVICE_TAG}[GET]`;
  try {
    const session = await getAdminSession(req);
    if (!session?.user || session.user.role !== 'admin') {
      return apiError('Acesso não autorizado.', 401);
    }

    const proposalId = params.proposalId;
    if (!Types.ObjectId.isValid(proposalId)) {
      return apiError('Identificador inválido.', 400);
    }

    const proposal = await fetchBrandProposalById(proposalId);
    if (!proposal) {
      return apiError('Proposta não encontrada.', 404);
    }

    return NextResponse.json(proposal, { status: 200 });
  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    return apiError(error.message || 'Ocorreu um erro interno no servidor.', 500);
  }
}
