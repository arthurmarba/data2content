import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import Metric from '@/app/models/Metric';

export const runtime = 'nodejs';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession({ req: request, ...authOptions });
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    await connectToDatabase();
    const metricId = params.id;

    const metric = await Metric.findOne({ _id: metricId, user: session.user.id });

    if (!metric) {
        return NextResponse.json({ error: 'Publi não encontrada.' }, { status: 404 });
    }

    return NextResponse.json(metric);
}
