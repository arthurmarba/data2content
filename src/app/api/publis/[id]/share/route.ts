import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { v4 as uuidv4 } from 'uuid';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import SharedLink from '@/app/models/SharedLink';
import Metric from '@/app/models/Metric';

export const runtime = 'nodejs';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = (await getServerSession({ req: request, ...authOptions })) as any;
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    await connectToDatabase();
    const metricId = params.id;

    // Validate ownership
    const metric = await Metric.findOne({ _id: metricId, user: session.user.id });
    if (!metric) {
        return NextResponse.json({ error: 'Publi não encontrada ou não pertence a você.' }, { status: 404 });
    }

    const body = await request.json();
    const { expiresAt, liveUpdate } = body;

    let sharedLink = await SharedLink.findOne({ metricId });

    if (sharedLink) {
        // Update existing
        sharedLink.config.expiresAt = expiresAt ? new Date(expiresAt) : undefined;
        sharedLink.config.liveUpdate = !!liveUpdate;
        sharedLink.revokedAt = undefined; // Un-revoke if it was revoked
        await sharedLink.save();
    } else {
        // Create new
        sharedLink = await SharedLink.create({
            token: uuidv4(),
            metricId,
            userId: session.user.id,
            config: {
                expiresAt: expiresAt ? new Date(expiresAt) : undefined,
                liveUpdate: !!liveUpdate,
            },
        });
    }

    // Construct URL
    // Use request origin to ensure the link works in the current environment (local, preview, prod)
    const baseUrl = request.nextUrl.origin;
    const link = `${baseUrl}/publi-share/${sharedLink.token}`;

    return NextResponse.json({
        link,
        token: sharedLink.token,
        expiresAt: sharedLink.config.expiresAt,
        liveUpdate: sharedLink.config.liveUpdate,
    });
}
