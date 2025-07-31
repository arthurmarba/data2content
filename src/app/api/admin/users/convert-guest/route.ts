import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/getAdminSession';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import { PLAN_STATUSES } from '@/types/enums';
import { logger } from '@/app/lib/logger';

const bodySchema = z.object({
  userId: z.string(),
  planStatus: z.enum(PLAN_STATUSES),
});

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json(
      { error: 'Acesso não autorizado.' },
      { status: 401 }
    );
  }

  const json = await req.json().catch(() => null);
  const validation = bodySchema.safeParse(json);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Dados inválidos.' },
      { status: 400 }
    );
  }

  const { userId, planStatus } = validation.data;

  await connectToDatabase();
  const user = await UserModel.findById(userId);
  if (!user) {
    return NextResponse.json(
      { error: 'Usuário não encontrado.' },
      { status: 404 }
    );
  }

  user.role = 'user';
  user.agency = null;
  user.planStatus = planStatus;
  await user.save();

  logger.info(
    `[admin/convert-guest] User ${userId} convertido para role 'user' com plano ${planStatus}`
  );

  return NextResponse.json({ success: true });
}

export const runtime = 'nodejs';
