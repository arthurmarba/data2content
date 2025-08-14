import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/getAdminSession';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import { USER_ROLES, PLAN_STATUSES } from '@/types/enums';
import { logger } from '@/app/lib/logger';
export const dynamic = 'force-dynamic';


const bodySchema = z.object({
  role: z.enum(USER_ROLES),
  planStatus: z.enum(PLAN_STATUSES),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const validation = bodySchema.safeParse(json);
  if (!validation.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const { role, planStatus } = validation.data;
  const { userId } = params;

  await connectToDatabase();
  const user = await UserModel.findById(userId);
  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  user.role = role;
  user.planStatus = planStatus;
  if (role !== 'guest') {
    user.agency = null;
  }
  await user.save();

  logger.info(
    `[admin/user-role] Admin ${session.user?.email || session.user?.id} mudou role para '${role}' e planStatus para '${planStatus}' do usuário ${userId}`
  );

  return NextResponse.json({ success: true });
}

export const runtime = 'nodejs';
