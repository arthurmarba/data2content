import { NextRequest, NextResponse } from 'next/server';
import aggregatePlatformDemographics from '@/utils/aggregatePlatformDemographics';
import { getAgencySession } from '@/lib/getAgencySession';

export async function GET(request: NextRequest) {
  const session = await getAgencySession(request);
  if (!session || !session.user || !session.user.agencyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const data = await aggregatePlatformDemographics(session.user.agencyId);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro ao processar sua solicitação.', details: message }, { status: 500 });
  }
}
