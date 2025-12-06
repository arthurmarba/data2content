import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import * as stateService from '@/app/lib/stateService';
import MessageModel from '@/app/models/Message';
import { connectToDatabase } from "@/app/lib/mongoose";

export async function GET(
    request: NextRequest,
    { params }: { params: { threadId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        const userId = (session?.user as any)?.id;
        const threadId = params.threadId;

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const thread = await stateService.getThread(threadId);
        if (!thread || String(thread.userId) !== userId) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        await connectToDatabase();
        const messages = await MessageModel.find({ threadId })
            .sort({ createdAt: 1 })
            .limit(100) // Reasonable limit for history loading
            .lean();

        return NextResponse.json({ thread, messages });
    } catch (error) {
        console.error('Failed to get thread:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { threadId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        const userId = (session?.user as any)?.id;
        const threadId = params.threadId;

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const allowedUpdates = ['title', 'isFavorite'];
        const updates: any = {};

        for (const key of allowedUpdates) {
            if (key in body) updates[key] = body[key];
        }

        // Verify ownership
        const thread = await stateService.getThread(threadId);
        if (!thread || String(thread.userId) !== userId) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const updated = await stateService.updateThread(threadId, updates);
        return NextResponse.json(updated);

    } catch (error) {
        console.error('Failed to update thread:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { threadId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        const userId = (session?.user as any)?.id;
        const threadId = params.threadId;

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Verify ownership
        const thread = await stateService.getThread(threadId);
        if (!thread || String(thread.userId) !== userId) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        await stateService.deleteThread(threadId);
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Failed to delete thread:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
