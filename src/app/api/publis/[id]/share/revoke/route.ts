import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import SharedLink from '@/app/models/SharedLink';

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

    const sharedLink = await SharedLink.findOne({ metricId, userId: session.user.id });

    if (!sharedLink) {
        return NextResponse.json({ error: 'Link de compartilhamento não encontrado.' }, { status: 404 });
    }

    sharedLink.revokedAt = new Date();
    await sharedLink.save();

    return NextResponse.json({ success: true, message: 'Link revogado com sucesso.' });
}
