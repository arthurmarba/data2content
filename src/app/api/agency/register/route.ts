import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import AgencyModel from '@/app/models/Agency';
import UserModel from '@/app/models/User';
export const dynamic = 'force-dynamic';


export const runtime = 'nodejs';

const createSchema = z.object({
  name: z.string(),
  contactEmail: z.string().email().optional(),
  managerEmail: z.string().email(),
  managerPassword: z.string().min(6),
});

async function hashPassword(pwd: string) {
  return bcrypt.hash(pwd, 10);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const val = createSchema.safeParse(body);
    if (!val.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const existingUser = await UserModel.findOne({ email: val.data.managerEmail });
    if (existingUser) {
      return NextResponse.json({ error: 'Este e-mail já está em uso por outro usuário.' }, { status: 409 });
    }

    const agencyQuery: any[] = [{ name: val.data.name }];
    if (val.data.contactEmail) {
      agencyQuery.push({ contactEmail: val.data.contactEmail });
    }
    const existingAgency = await AgencyModel.findOne({ $or: agencyQuery });
    if (existingAgency) {
      return NextResponse.json({ error: 'Já há parceiro registrada com esses dados.' }, { status: 409 });
    }

    const agency = await AgencyModel.create({ name: val.data.name, contactEmail: val.data.contactEmail });
    const hashedPassword = await hashPassword(val.data.managerPassword);
    await UserModel.create({ email: val.data.managerEmail, password: hashedPassword, role: 'agency', agency: agency._id });
    return NextResponse.json({ agency });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
