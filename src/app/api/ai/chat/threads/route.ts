import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import * as stateService from '@/app/lib/stateService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = (await getServerSession(authOptions)) as any;
        const userId = (session?.user as any)?.id;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const offset = parseInt(searchParams.get('offset') || '0', 10);

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
