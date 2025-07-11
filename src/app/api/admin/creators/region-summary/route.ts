import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { getAdminSession } from '@/lib/getAdminSession';
import aggregateCreatorsByRegion from '@/utils/aggregateCreatorsByRegion';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  gender: z.enum(['male', 'female', 'other']).optional(),
  minAge: z.coerce.number().int().positive().optional(),
  maxAge: z.coerce.number().int().positive().optional(),
  region: z.enum(['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']).optional(),
});

export async function GET(req: NextRequest) {
  const TAG = '[api/admin/creators/region-summary]';
  const session = await getAdminSession(req);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const params = Object.fromEntries(searchParams.entries());
  const validated = querySchema.safeParse(params);
  if (!validated.success) {
    const message = validated.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return NextResponse.json({ error: `Parâmetros inválidos: ${message}` }, { status: 400 });
  }

  try {
    // --- LOG DE DEBUG 1: VERIFIQUE OS FILTROS VALIDADOS ---
    console.log(`${TAG} Filtros validados para agregação:`, validated.data);

    const data = await aggregateCreatorsByRegion(validated.data);

    // --- LOG DE DEBUG 2: VERIFIQUE O RESULTADO DO BANCO ---
    console.log(`${TAG} Resultado da agregação do banco:`, JSON.stringify(data, null, 2));

    return NextResponse.json({ states: data }, { status: 200 });
  } catch (err) {
    logger.error(`${TAG} erro inesperado`, err);
    return NextResponse.json({ error: 'Erro ao processar sua solicitação.' }, { status: 500 });
  }
}