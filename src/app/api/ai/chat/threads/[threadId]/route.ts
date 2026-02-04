import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import * as stateService from '@/app/lib/stateService';
import ChatMessageLogModel from "@/app/models/ChatMessageLog";
import MessageModel from '@/app/models/Message';
import { connectToDatabase } from "@/app/lib/mongoose";

export async function GET(
    request: NextRequest,
    { params }: { params: { threadId: string } }
) {
    try {
        const session = (await getServerSession(authOptions)) as any;
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

        const messageIds = messages
            .map((msg: any) => msg?._id?.toString?.())
            .filter(Boolean);
        const sessionByMessageId = new Map<string, string>();
        if (messageIds.length) {
            const logs = await ChatMessageLogModel.find(
                { messageId: { $in: messageIds } },
                { messageId: 1, sessionId: 1 }
            ).lean();
            logs.forEach((log: any) => {
                if (log?.messageId && log?.sessionId) {
                    sessionByMessageId.set(String(log.messageId), String(log.sessionId));
                }
            });
        }

        const hydratedMessages = messages.map((msg: any) => {
            const messageId = msg?._id?.toString?.() ?? null;
            return {
                ...msg,
                messageId,
                sessionId: messageId ? sessionByMessageId.get(messageId) ?? null : null,
            };
        });

        return NextResponse.json({ thread, messages: hydratedMessages });
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
        const session = (await getServerSession(authOptions)) as any;
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
        const session = (await getServerSession(authOptions)) as any;
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
