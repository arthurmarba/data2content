// src/app/dashboard/afiliados/page.tsx
import React from 'react';
import NextDynamic from 'next/dynamic';

const AffiliateCard = NextDynamic(() => import('@/components/affiliate/AffiliateCard'), { ssr: false });

export const dynamic = 'force-dynamic';

export default function AfiliadosPage() {
  return (
    <main className="w-full">
      <AffiliateCard />
    </main>
  );
}
