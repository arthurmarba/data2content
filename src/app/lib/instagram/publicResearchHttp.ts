import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { z } from 'zod';
import { checkRateLimitStrict } from '@/utils/rateLimit';
import { comparePublicInstagramCreators, getPublicInstagramCreator, PublicInstagramResearchError,
  publicInstagramComparisonSchema, publicInstagramInputSchema } from '@/app/lib/mcp/publicInstagramResearch';
import { marketplaceOrigin } from './marketplace';
const input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('lookup'), username: z.string(), postLimit: z.number().optional() }).strict(),
  z.object({ action: z.literal('compare'), usernames: z.array(z.string()), postLimit: z.number().optional() }).strict(),
]);
const headers = { 'Cache-Control': 'no-store' };
export async function handlePublicResearchPost(request: NextRequest) {
  try {
    if (request.headers.get('origin') !== marketplaceOrigin()) return NextResponse.json({ message: 'Reabra a pesquisa na D2C.' }, { status: 403, headers });
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ message: 'Entre na sua conta D2C.' }, { status: 401, headers });
    const raw = await request.text();
    if (raw.length > 4096) return NextResponse.json({ message: 'Consulta muito extensa.' }, { status: 413, headers });
    const parsed = input.parse(JSON.parse(raw));
    const args = parsed.action === 'lookup' ? publicInstagramInputSchema.parse(parsed) : publicInstagramComparisonSchema.parse(parsed);
    const rate = await checkRateLimitStrict(`public-research:${session.user.id}`, 20, 60);
    if (!rate.available || !rate.allowed) return NextResponse.json({ message: 'Pesquisa temporariamente limitada. Tente novamente em um minuto.' }, { status: 429, headers });
    const result = parsed.action === 'lookup'
      ? await getPublicInstagramCreator(session.user.id, args as z.input<typeof publicInstagramInputSchema>)
      : await comparePublicInstagramCreators(session.user.id, args as z.input<typeof publicInstagramComparisonSchema>);
    return NextResponse.json(result, { headers });
  } catch (error) {
    const known = error instanceof PublicInstagramResearchError;
    return NextResponse.json({ error: known ? error.code : 'public_research_unavailable',
      message: known ? error.message : error instanceof z.ZodError || error instanceof SyntaxError ? 'Confira os @s e a quantidade de posts.' : 'Não foi possível pesquisar agora.' }, { status: 400, headers });
  }
}
