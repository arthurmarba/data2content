import { NextResponse } from 'next/server';
import aggregatePlatformDemographics from '@/utils/aggregatePlatformDemographics';

export async function GET(request: Request) {
  try {
    const data = await aggregatePlatformDemographics();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro ao processar sua solicitação.', details: message }, { status: 500 });
  }
}
