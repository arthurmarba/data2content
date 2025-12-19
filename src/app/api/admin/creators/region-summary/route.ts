import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { getAdminSession } from '@/lib/getAdminSession';
// Importa a função de agregação de audiência
import aggregateAudienceByRegion from '@/utils/aggregateAudienceByRegion';

export const dynamic = 'force-dynamic';

// --- PASSO 1: Atualizar o schema de validação ---
// Adicionamos os novos filtros opcionais para gênero e faixa etária.
const querySchema = z.object({
  region: z.enum(['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']).optional(),
  gender: z.enum(['F', 'M', 'U']).optional(),
  ageRange: z.enum(['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+']).optional(),
});

export async function GET(req: NextRequest) {
  const TAG = '[api/admin/audience/region-summary]';
  const session = (await getAdminSession(req)) as { user?: { name?: string } } | null;
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const params = Object.fromEntries(searchParams.entries());
  
  // Valida os novos parâmetros (região, gênero e idade)
  const validated = querySchema.safeParse(params);
  if (!validated.success) {
    const message = validated.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return NextResponse.json({ error: `Parâmetros inválidos: ${message}` }, { status: 400 });
  }

  try {
    logger.info(`${TAG} Filtros validados para agregação de audiência:`, validated.data);

    // --- PASSO 2: Passar os filtros validados para a função ---
    // A função aggregateAudienceByRegion agora receberá os filtros de gênero e idade.
    const data = await aggregateAudienceByRegion(validated.data);

    logger.info(`${TAG} Resultado da agregação de audiência: ${data.length} estados.`);

    return NextResponse.json({ states: data }, { status: 200 });
  } catch (err) {
    logger.error(`${TAG} erro inesperado`, err);
    return NextResponse.json({ error: 'Erro ao processar sua solicitação.' }, { status: 500 });
  }
}
