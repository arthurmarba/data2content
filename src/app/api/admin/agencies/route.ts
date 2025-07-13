import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/getAdminSession';
import AgencyModel from '@/app/models/Agency';
import UserModel from '@/app/models/User';
import { logger } from '@/app/lib/logger';

export const dynamic = 'force-dynamic';
const SERVICE_TAG = '[api/admin/agencies]';

function apiError(message: string, status: number) {
  logger.error(`${SERVICE_TAG} ${message}`);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session || !session.user) return apiError('Unauthorized', 401);
  const agencies = await AgencyModel.find().lean();
  return NextResponse.json({ agencies });
}

const createSchema = z.object({
  name: z.string(),
  contactEmail: z.string().email().optional(),
  managerEmail: z.string().email(),
  managerPassword: z.string().min(6),
});

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session || !session.user) return apiError('Unauthorized', 401);

  const body = await req.json();
  const val = createSchema.safeParse(body);
  if (!val.success) return apiError('Invalid body', 400);

  const agency = await AgencyModel.create({ name: val.data.name, contactEmail: val.data.contactEmail });
  await UserModel.create({ email: val.data.managerEmail, password: val.data.managerPassword, role: 'agency', agency: agency._id });
  return NextResponse.json({ agency });
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session || !session.user) return apiError('Unauthorized', 401);
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return apiError('Missing id', 400);
  const body = await req.json();
  await AgencyModel.findByIdAndUpdate(id, body);
  return NextResponse.json({ success: true });
}
