import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import MediaKitPackage from '@/app/models/MediaKitPackage';
import { logger } from '@/app/lib/logger';

// GET: Fetch all packages for the authenticated user
export async function GET() {
    const session = await getServerSession(authOptions as any);
    const userId = (session as any)?.user?.id;

    if (!userId) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    try {
        await connectToDatabase();
        const packages = await MediaKitPackage.find({ userId }).sort({ order: 1 }).lean();
        return NextResponse.json({ packages });
    } catch (error) {
        logger.error('[GET /api/mediakit/self/packages] Falha ao buscar pacotes', error);
        return NextResponse.json({ error: 'Erro ao buscar pacotes.' }, { status: 500 });
    }
}

// POST: Replace all packages or create new ones
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions as any);
    const userId = (session as any)?.user?.id;

    if (!userId) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { packages } = body;

        if (!Array.isArray(packages)) {
            return NextResponse.json({ error: 'Formato inválido. Esperado array de pacotes.' }, { status: 400 });
        }

        // Validate limit (e.g., max 10 packages)
        if (packages.length > 10) {
            return NextResponse.json({ error: 'Limite de 10 pacotes excedido.' }, { status: 400 });
        }

        await connectToDatabase();

        // Strategy: Delete existing and insert new (Overwrite)
        // This allows reordering and updates in a single atomic-like operation from the UI's perspective
        // Using a transaction would be ideal but simple delete-insert is sufficient for this scale

        // Start session for transaction if replica set is available, but assuming standalone for simplicity/risk
        // We will just do deleteMany then insertMany.

        await MediaKitPackage.deleteMany({ userId });

        const packagesToInsert = packages.map((pkg: any, index: number) => ({
            userId,
            name: pkg.name,
            price: pkg.price,
            currency: pkg.currency || 'BRL',
            deliverables: pkg.deliverables,
            description: pkg.description,
            type: pkg.type || 'manual',
            order: index, // Ensure order is preserved based on array index
        }));

        if (packagesToInsert.length > 0) {
            await MediaKitPackage.insertMany(packagesToInsert);
        }

        return NextResponse.json({ success: true, count: packagesToInsert.length });
    } catch (error) {
        logger.error('[POST /api/mediakit/self/packages] Falha ao salvar pacotes', error);
        return NextResponse.json({ error: 'Erro ao salvar pacotes.' }, { status: 500 });
    }
}

// DELETE: Remove all packages
export async function DELETE() {
    const session = await getServerSession(authOptions as any);
    const userId = (session as any)?.user?.id;

    if (!userId) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    try {
        await connectToDatabase();
        await MediaKitPackage.deleteMany({ userId });
        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('[DELETE /api/mediakit/self/packages] Falha ao remover pacotes', error);
        return NextResponse.json({ error: 'Erro ao remover pacotes.' }, { status: 500 });
    }
}
