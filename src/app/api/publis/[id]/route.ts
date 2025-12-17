import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import Metric from '@/app/models/Metric';
import DailyMetricSnapshotModel from '@/app/models/DailyMetricSnapshot';

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

    const metric = await Metric.findOne({ _id: metricId, user: session.user.id }).lean();

    if (!metric) {
        return NextResponse.json({ error: 'Publi não encontrada.' }, { status: 404 });
    }

    const snapshots = await DailyMetricSnapshotModel.find({ metric: metric._id })
        .sort({ date: 1 })
        .lean();

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

    return NextResponse.json({
        ...metric,
        dailySnapshots: normalizedSnapshots,
    });
}
