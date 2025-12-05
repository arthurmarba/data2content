import { NextRequest, NextResponse } from 'next/server';

import { connectToDatabase } from '@/app/lib/mongoose';
import SharedLink from '@/app/models/SharedLink';
import Metric from '@/app/models/Metric';
import User from '@/app/models/User';

export const runtime = 'nodejs';

export async function GET(
    request: NextRequest,
    { params }: { params: { token: string } }
) {
    await connectToDatabase();
    const token = params.token;

    // 1. Find the link
    const sharedLink = await SharedLink.findOne({ token }).populate('userId', 'name email avatarUrl');

    if (!sharedLink) {
        return NextResponse.json({ error: 'Link inválido.' }, { status: 404 });
    }

    // 2. Check revocation
    if (sharedLink.revokedAt) {
        return NextResponse.json({ error: 'Este link foi revogado pelo criador.' }, { status: 410 });
    }

    // 3. Check expiration
    if (sharedLink.config.expiresAt && new Date() > sharedLink.config.expiresAt) {
        return NextResponse.json({ error: 'Este link expirou.' }, { status: 410 });
    }

    // 4. Update clicks (async, don't await)
    SharedLink.updateOne({ _id: sharedLink._id }, { $inc: { clicks: 1 } }).exec();

    // 5. Fetch Metric data
    // 5. Fetch Metric data
    let metric = await Metric.findById(sharedLink.metricId);

    if (!metric) {
        return NextResponse.json({ error: 'Conteúdo original não encontrado.' }, { status: 404 });
    }

    // Live Update Logic
    if (sharedLink.config.liveUpdate) {
        const lastUpdate = metric.updatedAt ? new Date(metric.updatedAt).getTime() : 0;
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        if (now - lastUpdate > oneHour && metric.instagramMediaId) {
            try {
                // Import dynamically to avoid circular deps if any (though structured well)
                const { refreshSinglePubliMetric } = await import('@/app/lib/instagram/sync/singleMetricSync');

                // Attempt refresh
                const result = await refreshSinglePubliMetric(sharedLink.userId.toString(), metric.instagramMediaId);

                if (result.success) {
                    // Refetch updated metric
                    const updatedMetric = await Metric.findById(sharedLink.metricId);
                    if (updatedMetric) {
                        metric = updatedMetric;
                    }
                }
            } catch (err) {
                console.error('Failed to live update metric:', err);
                // Continue with existing data
            }
        }
    }

    // 6. Sanitize response (Public View)
    const creator = sharedLink.userId as any;

    return NextResponse.json({
        data: {
            description: metric.description,
            postDate: metric.postDate,
            type: metric.type,
            theme: metric.theme,
            stats: metric.stats,
            coverUrl: metric.coverUrl,
            postLink: metric.postLink,
            updatedAt: metric.updatedAt,
            // Enhanced data
            format: metric.format,
            proposal: metric.proposal,
            context: metric.context,
            tone: metric.tone,
            references: metric.references,
            collab: metric.collab,
            collabCreator: metric.collabCreator,
            instagramMediaId: metric.instagramMediaId,
            source: metric.source,
            classificationStatus: metric.classificationStatus,
            dailySnapshots: metric.dailySnapshots,
        },
        creator: {
            name: creator.name || 'Criador',
        },
        meta: {
            lastUpdate: metric.updatedAt,
            isLive: sharedLink.config.liveUpdate,
        }
    });
}
