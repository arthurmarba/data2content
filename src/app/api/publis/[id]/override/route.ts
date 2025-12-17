import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { Types } from 'mongoose';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import Metric from '@/app/models/Metric';

export const runtime = 'nodejs';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession({ req: request, ...authOptions });
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    await connectToDatabase();
    const metricId = params.id;

    const body = await request.json();
    const isPubli = Boolean(body?.isPubli);

    const metric = await Metric.findOne({ _id: metricId, user: new Types.ObjectId(session.user.id) });
    if (!metric) {
        return NextResponse.json({ error: 'Publi não encontrada ou não pertence a você.' }, { status: 404 });
    }

    metric.isPubli = isPubli;
    // Opcionalmente, marca classificação como concluída para não ficar pendente.
    if (metric.classificationStatus === 'pending') {
        metric.classificationStatus = 'completed';
    }
    await metric.save();

    return NextResponse.json({
        id: metric._id.toString(),
        isPubli: metric.isPubli,
        classificationStatus: metric.classificationStatus,
    });
}
