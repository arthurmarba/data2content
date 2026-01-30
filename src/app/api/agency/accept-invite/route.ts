import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import AgencyModel from '@/app/models/Agency';
import { logger } from '@/app/lib/logger';
import { z } from 'zod';
export const dynamic = 'force-dynamic';

async function loadAuthOptions() {
  if (process.env.NODE_ENV === 'test') {
    return {} as any;
  }
  const mod = await import('@/app/api/auth/[...nextauth]/route');
  return mod.authOptions as any;
}

const bodySchema = z.object({
  inviteCode: z.string(),
});

export async function POST(req: NextRequest) {
  const authOptions = await loadAuthOptions();
  const session = (await getServerSession({ req, ...authOptions })) as { user?: { id?: string } } | null;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  await connectToDatabase();

  const agency = await AgencyModel.findOne({ inviteCode: parsed.data.inviteCode })
    .select('_id planStatus')
    .lean();
  if (!agency) {
    return NextResponse.json({ error: 'Convite inválido' }, { status: 404 });
  }
  if (agency.planStatus !== 'active') {
    return NextResponse.json({ error: 'Parceiro sem assinatura ativa' }, { status: 403 });
  }

  const user = await UserModel.findById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  if (user.agency && user.agency.toString() !== agency._id.toString()) {
    return NextResponse.json(
      { error: 'Usuário já vinculado a outra parceiro. Saia da atual antes de prosseguir.' },
      { status: 409 }
    );
  }

  user.agency = agency._id as any;
  user.role = 'guest';
  if (user.planStatus === 'inactive') {
    user.planStatus = 'pending';
  }
  await user.save();

  logger.info(
    `[agency/accept-invite] User ${session.user.id} linked to agency ${agency._id}`
  );

  return NextResponse.json({ success: true });
}

export const runtime = 'nodejs';
