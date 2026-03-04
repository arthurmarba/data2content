import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import MediaKitPackage from '@/app/models/MediaKitPackage';
import { logger } from '@/app/lib/logger';
import { z } from 'zod';

const PACKAGE_LIMIT = 10;

const packageSchema = z.object({
    name: z.string().trim().min(1, 'Nome do pacote é obrigatório.').max(100, 'Nome do pacote excede 100 caracteres.'),
    price: z.coerce.number().finite('Preço inválido.').min(0, 'Preço não pode ser negativo.'),
    currency: z.enum(['BRL', 'USD', 'EUR']).default('BRL'),
    deliverables: z
        .array(z.string().trim().min(1, 'Entregável não pode estar vazio.'))
        .min(1, 'Informe pelo menos um entregável.'),
    description: z
        .string()
        .max(500, 'Descrição excede 500 caracteres.')
        .optional()
        .transform((value) => value?.trim() || undefined),
    type: z.enum(['manual', 'ai_generated']).default('manual'),
});

const savePackagesSchema = z.object({
    packages: z.array(packageSchema).max(PACKAGE_LIMIT, `Limite de ${PACKAGE_LIMIT} pacotes excedido.`),
});

async function getAuthenticatedUserId() {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        const userId = session?.user?.id;
        return typeof userId === 'string' && userId.trim() ? userId : null;
    } catch (error) {
        logger.warn('[mediakit/self/packages] Sessão inválida ao autenticar usuário.', {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

// GET: Fetch all packages for the authenticated user
export async function GET() {
    const userId = await getAuthenticatedUserId();

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
    const userId = await getAuthenticatedUserId();

    if (!userId) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const parsed = savePackagesSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Dados de pacotes inválidos.',
                    code: 'INVALID_PACKAGES_PAYLOAD',
                    details: parsed.error.issues.map((issue) => ({
                        field: issue.path.join('.') || 'packages',
                        message: issue.message,
                    })),
                },
                { status: 400 },
            );
        }

        await connectToDatabase();
        await MediaKitPackage.deleteMany({ userId });

        const packagesToInsert = parsed.data.packages.map((pkg, index) => ({
            userId,
            name: pkg.name,
            price: pkg.price,
            currency: pkg.currency,
            deliverables: pkg.deliverables,
            description: pkg.description,
            type: pkg.type,
            order: index,
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
    const userId = await getAuthenticatedUserId();

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
