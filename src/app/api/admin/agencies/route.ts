import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { getAdminSession } from '@/lib/getAdminSession';
import AgencyModel from '@/app/models/Agency';
import UserModel from '@/app/models/User';
import { logger } from '@/app/lib/logger';

export const dynamic = 'force-dynamic';
const SERVICE_TAG = '[api/admin/agencies]';

async function hashPassword(pwd: string) {
  return bcrypt.hash(pwd, 10);
}

function apiError(message: string, status: number) {
  logger.error(`${SERVICE_TAG} ${message}`);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session || !session.user) return apiError('Unauthorized', 401);
  const agencies = await AgencyModel.find().lean();
  const managers = await UserModel.find({ role: 'agency', agency: { $in: agencies.map(a => a._id) } }).lean();
  const managerMap = new Map(managers.map(m => [m.agency?.toString(), m.email]));
  const agenciesWithManagers = agencies.map(a => ({
    ...a,
    managerEmail: managerMap.get(a._id.toString()) || '',
  }));
  return NextResponse.json({ agencies: agenciesWithManagers });
}

const createSchema = z.object({
  name: z.string(),
  contactEmail: z.string().email().optional(),
  managerEmail: z.string().email(),
  managerPassword: z.string().min(6),
});

const updateSchema = z.object({
  name: z.string().optional(),
  contactEmail: z.string().email().optional().nullable(),
  managerPassword: z.string().min(6).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session || !session.user) return apiError('Unauthorized', 401);

  const body = await req.json();
  const val = createSchema.safeParse(body);
  if (!val.success) return apiError('Invalid body', 400);

  const existingUser = await UserModel.findOne({ email: val.data.managerEmail });
  if (existingUser) {
    return NextResponse.json({ error: 'Este e-mail já está em uso por outro usuário.' }, { status: 409 });
  }

  const agency = await AgencyModel.create({ name: val.data.name, contactEmail: val.data.contactEmail });
  const hashedPassword = await hashPassword(val.data.managerPassword);
  await UserModel.create({ email: val.data.managerEmail, password: hashedPassword, role: 'agency', agency: agency._id });
  return NextResponse.json({ agency });
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session || !session.user) return apiError('Unauthorized', 401);
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return apiError('Missing id', 400);
  const body = await req.json();
  const val = updateSchema.safeParse(body);
  if (!val.success) return apiError('Invalid body', 400);
  await AgencyModel.findByIdAndUpdate(id, {
    name: val.data.name,
    contactEmail: val.data.contactEmail,
  });
  if (val.data.managerPassword) {
    const hashedPassword = await hashPassword(val.data.managerPassword);
    await UserModel.updateOne({ agency: id, role: 'agency' }, { $set: { password: hashedPassword } });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session || !session.user) return apiError('Unauthorized', 401);
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return apiError('Missing id', 400);
  await UserModel.updateMany({ agency: id }, { $set: { agency: null } });
  await UserModel.deleteOne({ agency: id, role: 'agency' });
  await AgencyModel.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
