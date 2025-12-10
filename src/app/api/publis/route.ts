import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { FilterQuery } from 'mongoose';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import Metric, { IMetric } from '@/app/models/Metric';
import { getCategoryById, getCategoryWithSubcategoryIds } from '@/app/lib/classification';
const normalizeValue = (value?: string | null) => {
    if (!value) return [];
    const trimmed = value.trim();
    const lower = trimmed.toLowerCase();
    const accentless = trimmed.normalize('NFD').replace(/\p{Diacritic}+/gu, '');
    const accentlessLower = lower.normalize('NFD').replace(/\p{Diacritic}+/gu, '');
    return Array.from(new Set([trimmed, lower, accentless, accentlessLower]));
};

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    const session = await getServerSession({ req: request, ...authOptions });
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Number.parseInt(searchParams.get('limit') ?? '20', 10));
    const skip = (page - 1) * limit;

    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') ?? 'date_desc';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const buildClassFilter = (value: string, type: 'proposal' | 'tone') => {
        const ids = getCategoryWithSubcategoryIds(value, type);
        const labels = ids
            .map(id => getCategoryById(id, type)?.label)
            .filter((l): l is string => Boolean(l));

        const variants = Array.from(
            new Set(
                [...ids, ...labels].flatMap(v => normalizeValue(v))
            )
        );

        const field = type;
        return { [field]: { $in: variants } } as FilterQuery<IMetric>;
    };

    const publiFilters: FilterQuery<IMetric>[] = [
        buildClassFilter('publi_divulgation', 'proposal'),
        buildClassFilter('promotional', 'tone'),
    ];

    const query: FilterQuery<IMetric> = {
        user: session.user.id,
        $and: [
            {
                // Posts de publi podem ser marcados tanto pela proposta quanto pelo tom promocional.
                $or: publiFilters,
            }
        ],
    };

    if (category) {
        query.theme = category;
    }

    if (status) {
        query.classificationStatus = status;
    }

    // Date Range Filter
    if (startDate || endDate) {
        query.postDate = {};
        if (startDate) query.postDate.$gte = new Date(startDate);
        if (endDate) query.postDate.$lte = new Date(endDate);
    }

    if (search) {
        query.description = { $regex: search, $options: 'i' };
    }

    let sortOptions: Record<string, 1 | -1> = { postDate: -1 };

    if (sort === 'date_asc') {
        sortOptions = { postDate: 1 };
    } else if (sort === 'performance_desc') {
        sortOptions = { 'stats.engagement': -1 };
    } else if (sort === 'performance_asc') {
        sortOptions = { 'stats.engagement': 1 };
    }

    const [items, total] = await Promise.all([
        Metric.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .lean()
            .exec(),
        Metric.countDocuments(query),
    ]);

    return NextResponse.json({
        items: items.map(item => ({
            id: item._id.toString(),
            description: item.description,
            postDate: item.postDate,
            coverUrl: item.coverUrl,
            theme: item.theme,
            classificationStatus: item.classificationStatus,
            stats: item.stats,
            instagramMediaId: item.instagramMediaId,
            postLink: item.postLink,
        })),
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        }
    });
}
