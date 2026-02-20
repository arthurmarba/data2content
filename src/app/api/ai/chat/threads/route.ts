import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import * as stateService from '@/app/lib/stateService';

export const dynamic = 'force-dynamic';
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parseLimit(rawValue: string | null): number {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
    return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function parseOffset(rawValue: string | null): number {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.floor(parsed);
}

export async function GET(request: NextRequest) {
    try {
        const session = (await getServerSession(authOptions)) as any;
        const userId = (session?.user as any)?.id;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const limit = parseLimit(searchParams.get('limit'));
        const offset = parseOffset(searchParams.get('offset'));

        const threads = await stateService.getUserThreads(userId, limit, offset);
        return NextResponse.json({ threads });
    } catch (error) {
        console.error('Failed to list threads:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = (await getServerSession(authOptions)) as any;
        const userId = (session?.user as any)?.id;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const title = body.title;

        const newThread = await stateService.createThread(userId, title);
        return NextResponse.json(newThread, { status: 201 });
    } catch (error) {
        console.error('Failed to create thread:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
