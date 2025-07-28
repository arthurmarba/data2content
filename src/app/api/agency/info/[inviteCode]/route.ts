import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongoose';
import AgencyModel from '@/app/models/Agency';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { inviteCode: string } }
) {
  try {
    const { inviteCode } = params;
    await connectToDatabase();
    const agency = await AgencyModel.findOne({ inviteCode })
      .select('name planStatus')
      .lean();
    if (!agency || agency.planStatus !== 'active') {
      return NextResponse.json({ error: 'Código inválido' }, { status: 404 });
    }
    return NextResponse.json({ name: agency.name });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
