import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getCreatorResearchAccess } from '@/app/lib/instagram/creatorResearchAccess';
import PublicResearch from '@/app/dashboard/creator-research/PublicResearch';
import MarketplaceAdmin from '@/app/dashboard/admin/creator-marketplace/MarketplaceAdmin';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login?review=1&callbackUrl=%2Fcreator-research');
  const access = await getCreatorResearchAccess(session.user.id);
  return <div className="min-h-screen bg-gray-50 text-gray-900">
    <PublicResearch />
    {access && <MarketplaceAdmin />}
  </div>;
}
