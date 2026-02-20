import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { FilterQuery, PipelineStage, Types } from 'mongoose';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import Metric, { IMetric } from '@/app/models/Metric';
import { PUBLI_CAPTION_INDICATOR_REGEX } from '@/app/lib/publisCaptionDetector';
const normalizeValue = (value?: string | null) => {
    if (!value) return [];
    const trimmed = value.trim();
    const lower = trimmed.toLowerCase();
    const accentless = trimmed.normalize('NFD').replace(/\p{Diacritic}+/gu, '');
    const accentlessLower = lower.normalize('NFD').replace(/\p{Diacritic}+/gu, '');
    return Array.from(new Set([trimmed, lower, accentless, accentlessLower]));
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildAccentInsensitiveRegex = (value: string) => {
    const accentMap: Record<string, string> = {
        a: 'aàáâãäå',
        e: 'eèéêë',
        i: 'iìíîï',
        o: 'oòóôõö',
        u: 'uùúûü',
        c: 'cç',
        n: 'nñ',
    };

    const escaped = escapeRegex(value);
    return escaped.replace(/[aeiounc]/gi, (char) => {
        const lower = char.toLowerCase();
        const accentedChars = accentMap[lower];
        if (!accentedChars) return char;
        const characters = `${accentedChars}${accentedChars.toUpperCase()}`;
        return `[${characters}]`;
    });
};

export const runtime = 'nodejs';
const PUBLI_ROUTE_CACHE_TTL_MS = (() => {
    const parsed = Number(process.env.PUBLIS_ROUTE_CACHE_TTL_MS ?? 20_000);
    return Number.isFinite(parsed) && parsed >= 5_000 ? Math.floor(parsed) : 20_000;
})();
const PUBLI_ROUTE_CACHE_MAX_ENTRIES = (() => {
    const parsed = Number(process.env.PUBLIS_ROUTE_CACHE_MAX_ENTRIES ?? 200);
    return Number.isFinite(parsed) && parsed >= 50 ? Math.floor(parsed) : 200;
})();

const publisResponseCache = new Map<string, { expiresAt: number; payload: any }>();

const PUBLI_SELECT_FIELDS =
    '_id description postDate coverUrl theme classificationStatus stats isPubli instagramMediaId postLink';

const PUBLI_PROJECT_STAGE: PipelineStage.Project = {
    $project: {
        _id: 1,
        description: 1,
        postDate: 1,
        coverUrl: 1,
        theme: 1,
        classificationStatus: 1,
        stats: 1,
        isPubli: 1,
        instagramMediaId: 1,
        postLink: 1,
    },
};

function prunePublisResponseCache(nowTs: number) {
    for (const [key, value] of publisResponseCache.entries()) {
        if (value.expiresAt <= nowTs) publisResponseCache.delete(key);
    }
    if (publisResponseCache.size <= PUBLI_ROUTE_CACHE_MAX_ENTRIES) return;
    const overflow = publisResponseCache.size - PUBLI_ROUTE_CACHE_MAX_ENTRIES;
    const keys = Array.from(publisResponseCache.keys());
    for (let i = 0; i < overflow; i += 1) {
        const key = keys[i];
        if (!key) break;
        publisResponseCache.delete(key);
    }
}

const formatDateParam = (date: Date) => date.toISOString().split('T')[0];

const parseDateParam = (value?: string | null) => {
    if (!value) return null;
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return { date: parsed, isDateOnly };
};

const resolveRangeDates = (range: string | null) => {
    if (!range) return {};

    const end = new Date();

    if (range === '30d') {
        const start = new Date(end);
        start.setDate(end.getDate() - 30);
        return { startDate: formatDateParam(start), endDate: formatDateParam(end) };
    }

    if (range === '90d') {
        const start = new Date(end);
        start.setDate(end.getDate() - 90);
        return { startDate: formatDateParam(start), endDate: formatDateParam(end) };
    }

    if (range === 'year') {
        const start = new Date(end.getFullYear(), 0, 1);
        return { startDate: formatDateParam(start), endDate: formatDateParam(end) };
    }

    if (range === 'all') {
        return {};
    }

    return {};
};

export async function GET(request: NextRequest) {
    const session = (await getServerSession({ req: request, ...authOptions })) as any;
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
    const range = searchParams.get('range');

    const { startDate: rangeStart, endDate: rangeEnd } = resolveRangeDates(range);
    const parsedStart = parseDateParam(rangeStart ?? searchParams.get('startDate'));
    const parsedEnd = parseDateParam(rangeEnd ?? searchParams.get('endDate'));
    const trimmedSearch = search?.trim();

    const userId = new Types.ObjectId(session.user.id);
    const cacheKey = [
        session.user.id,
        page,
        limit,
        category ?? '',
        status ?? '',
        trimmedSearch ?? '',
        sort,
        range ?? '',
        parsedStart?.date?.toISOString() ?? '',
        parsedEnd?.date?.toISOString() ?? '',
    ].join('|');
    const nowTs = Date.now();
    prunePublisResponseCache(nowTs);
    const cached = publisResponseCache.get(cacheKey);
    if (cached && cached.expiresAt > nowTs) {
        return NextResponse.json(cached.payload);
    }

    const query: FilterQuery<IMetric> = {
        user: userId,
        $and: [
            {
                // Identificação exclusiva via indicador "publi" (e variações) na legenda.
                description: { $regex: PUBLI_CAPTION_INDICATOR_REGEX },
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
    if (parsedStart?.date || parsedEnd?.date) {
        query.postDate = {};
        if (parsedStart?.date) query.postDate.$gte = parsedStart.date;
        if (parsedEnd?.date) {
            if (parsedEnd.isDateOnly) {
                const endExclusive = new Date(parsedEnd.date);
                endExclusive.setDate(endExclusive.getDate() + 1);
                query.postDate.$lt = endExclusive;
            } else {
                query.postDate.$lte = parsedEnd.date;
            }
        }
    }

    if (trimmedSearch) {
        const variants = normalizeValue(trimmedSearch);
        const searchFilters = variants.map(value => ({
            description: { $regex: buildAccentInsensitiveRegex(value), $options: 'i' }
        }));

        if (Array.isArray(query.$and)) {
            query.$and.push({ $or: searchFilters });
        } else {
            query.$and = [{ $or: searchFilters }];
        }
    }

    let sortOptions: Record<string, 1 | -1> = { postDate: -1 };

    if (sort === 'date_asc') {
        sortOptions = { postDate: 1 };
    }

    const isPerformanceSort = sort === 'performance_desc' || sort === 'performance_asc';
    const performanceSortDirection: 1 | -1 = sort === 'performance_asc' ? 1 : -1;

    const performancePipeline: PipelineStage[] = [
        { $match: query },
        { $addFields: { sortEngagement: { $ifNull: ['$stats.total_interactions', 0] } } },
        { $sort: { sortEngagement: performanceSortDirection, _id: 1 } },
        { $skip: skip },
        { $limit: limit },
        PUBLI_PROJECT_STAGE,
    ];

    const [items, total] = await Promise.all([
        isPerformanceSort
            ? Metric.aggregate(performancePipeline).exec()
            : Metric.find(query)
                .select(PUBLI_SELECT_FIELDS)
                .sort(sortOptions)
                .skip(skip)
                .limit(limit)
                .lean()
                .exec(),
        Metric.countDocuments(query),
    ]);

    const payload = {
        items: items.map(item => ({
            id: item._id.toString(),
            description: item.description,
            postDate: item.postDate,
            coverUrl: item.coverUrl,
            theme: item.theme,
            classificationStatus: item.classificationStatus,
            stats: item.stats,
            isPubli: item.isPubli,
            instagramMediaId: item.instagramMediaId,
            postLink: item.postLink,
        })),
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        }
    };

    publisResponseCache.set(cacheKey, {
        payload,
        expiresAt: nowTs + PUBLI_ROUTE_CACHE_TTL_MS,
    });

    return NextResponse.json(payload);
}
