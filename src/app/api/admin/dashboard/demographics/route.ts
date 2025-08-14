import { NextRequest, NextResponse } from 'next/server';
import aggregatePlatformDemographics from '@/utils/aggregatePlatformDemographics';
import { getAdminSession } from '@/lib/getAdminSession';
export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  const session = await getAdminSession(request);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const data = await aggregatePlatformDemographics();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro ao processar sua solicitação.', details: message }, { status: 500 });
  }
}
