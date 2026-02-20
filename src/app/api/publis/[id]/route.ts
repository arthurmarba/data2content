import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import Metric from '@/app/models/Metric';
import DailyMetricSnapshotModel from '@/app/models/DailyMetricSnapshot';
import { Types } from 'mongoose';

export const runtime = 'nodejs';
const PUBLI_DETAILS_CACHE_TTL_MS = (() => {
    const parsed = Number(process.env.PUBLI_DETAILS_CACHE_TTL_MS ?? 30_000);
    return Number.isFinite(parsed) && parsed >= 5_000 ? Math.floor(parsed) : 30_000;
})();
const PUBLI_DETAILS_CACHE_MAX_ENTRIES = (() => {
    const parsed = Number(process.env.PUBLI_DETAILS_CACHE_MAX_ENTRIES ?? 500);
    return Number.isFinite(parsed) && parsed >= 100 ? Math.floor(parsed) : 500;
})();
const publiDetailsCache = new Map<string, { expiresAt: number; payload: any }>();

function prunePubliDetailsCache(nowTs: number) {
    for (const [key, value] of publiDetailsCache.entries()) {
        if (value.expiresAt <= nowTs) publiDetailsCache.delete(key);
    }
    if (publiDetailsCache.size <= PUBLI_DETAILS_CACHE_MAX_ENTRIES) return;
    const overflow = publiDetailsCache.size - PUBLI_DETAILS_CACHE_MAX_ENTRIES;
    const keys = Array.from(publiDetailsCache.keys());
    for (let i = 0; i < overflow; i += 1) {
        const key = keys[i];
        if (!key) break;
        publiDetailsCache.delete(key);
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = (await getServerSession({ req: request, ...authOptions })) as any;
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    await connectToDatabase();
    const metricId = params.id;
    if (!Types.ObjectId.isValid(metricId)) {
        return NextResponse.json({ error: 'Publi inválida.' }, { status: 400 });
    }

    const cacheKey = `${session.user.id}|${metricId}`;
    const nowTs = Date.now();
    prunePubliDetailsCache(nowTs);
    const cached = publiDetailsCache.get(cacheKey);
    if (cached && cached.expiresAt > nowTs) {
        return NextResponse.json(cached.payload);
    }

    const [metric, snapshots] = await Promise.all([
        Metric.findOne({ _id: metricId, user: session.user.id })
            .select(
                '_id description postDate coverUrl theme classificationStatus format proposal context tone references stats postLink updatedAt'
            )
            .lean(),
        DailyMetricSnapshotModel.find({ metric: metricId })
            .select('date dayNumber dailyViews dailyReach dailyImpressions dailyLikes')
            .sort({ date: 1 })
            .lean(),
    ]);

    if (!metric) {
        return NextResponse.json({ error: 'Publi não encontrada.' }, { status: 404 });
    }

    const normalizedSnapshots = snapshots.map((snapshot) => {
        const date = snapshot.date ? new Date(snapshot.date) : null;
        const safeDate = date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;

        const dailyViews = snapshot.dailyViews ?? snapshot.dailyReach ?? snapshot.dailyImpressions ?? 0;
        const dailyLikes = snapshot.dailyLikes ?? 0;

        return {
            date: safeDate,
            dayNumber: snapshot.dayNumber ?? null,
            dailyViews: Number.isFinite(dailyViews) ? dailyViews : 0,
            dailyLikes: Number.isFinite(dailyLikes) ? dailyLikes : 0,
        };
    }).filter(s => s.date);

    const payload = {
        ...metric,
        dailySnapshots: normalizedSnapshots,
    };

    publiDetailsCache.set(cacheKey, {
        payload,
        expiresAt: nowTs + PUBLI_DETAILS_CACHE_TTL_MS,
    });

    return NextResponse.json(payload);
}
