import { NextRequest, NextResponse } from 'next/server';

import { connectToDatabase } from '@/app/lib/mongoose';
import SharedLink from '@/app/models/SharedLink';
import Metric from '@/app/models/Metric';
import User from '@/app/models/User';
import DailyMetricSnapshotModel from '@/app/models/DailyMetricSnapshot';

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

    const metricData = metric.toObject ? metric.toObject() : metric;

    const snapshots = await DailyMetricSnapshotModel.find({ metric: metricData._id })
        .sort({ date: 1 })
        .lean();

    const normalizedSnapshots = snapshots
        .map((snapshot) => {
            const date = snapshot.date ? new Date(snapshot.date) : null;
            const safeDate = date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;

            const dailyViews = snapshot.dailyViews ?? snapshot.dailyReach ?? snapshot.dailyImpressions ?? 0;
            const dailyLikes = snapshot.dailyLikes ?? 0;

            return safeDate ? {
                date: safeDate,
                dayNumber: snapshot.dayNumber ?? null,
                dailyViews: Number.isFinite(dailyViews) ? dailyViews : 0,
                dailyLikes: Number.isFinite(dailyLikes) ? dailyLikes : 0,
            } : null;
        })
        .filter(Boolean);

    const creator = sharedLink.userId as any;

    return NextResponse.json({
        data: {
            description: metricData.description,
            postDate: metricData.postDate,
            type: metricData.type,
            theme: metricData.theme,
            stats: metricData.stats,
            coverUrl: metricData.coverUrl,
            postLink: metricData.postLink,
            updatedAt: metricData.updatedAt,
            // Enhanced data
            format: metricData.format,
            proposal: metricData.proposal,
            context: metricData.context,
            tone: metricData.tone,
            references: metricData.references,
            collab: metricData.collab,
            collabCreator: metricData.collabCreator,
            instagramMediaId: metricData.instagramMediaId,
            source: metricData.source,
            classificationStatus: metricData.classificationStatus,
            dailySnapshots: normalizedSnapshots,
        },
        creator: {
            name: creator.name || 'Criador',
        },
        meta: {
            lastUpdate: metricData.updatedAt,
            isLive: sharedLink.config.liveUpdate,
        }
    });
}
