import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getCreatorResearchAccess } from '@/app/lib/instagram/creatorResearchAccess';
import PublicResearch from '@/app/dashboard/creator-research/PublicResearch';
import ResearchLanguage from '@/app/dashboard/creator-research/ResearchLanguage';
import { RESEARCH_LANG_COOKIE, type ResearchLang } from '@/app/dashboard/creator-research/researchLang';
import MarketplaceAdmin from '@/app/dashboard/admin/creator-marketplace/MarketplaceAdmin';
export const dynamic = 'force-dynamic';
// Inglês existe para a análise da Meta, que pede a interface nesse idioma; o cookie mantém a escolha na volta do login.
export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login?review=1&callbackUrl=%2Fcreator-research');
  const { lang: asked } = await searchParams;
  const saved = (await cookies()).get(RESEARCH_LANG_COOKIE)?.value;
  const lang: ResearchLang = asked === 'en' || asked === 'pt' ? asked : saved === 'en' ? 'en' : 'pt';
  const access = await getCreatorResearchAccess(session.user.id);
  return <div className="min-h-screen bg-gray-50 text-gray-900">
    <ResearchLanguage lang={lang} marketplace={!!access} />
    <PublicResearch lang={lang} />
    {access && <MarketplaceAdmin lang={lang} />}
  </div>;
}
