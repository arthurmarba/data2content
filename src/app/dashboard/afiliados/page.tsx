// src/app/dashboard/afiliados/page.tsx
import React from 'react';
import NextDynamic from 'next/dynamic';

const AffiliateCard = NextDynamic(() => import('@/components/affiliate/AffiliateCard'), { ssr: false });

export const dynamic = 'force-dynamic';

export default function AfiliadosPage() {
  return (
    <main className="w-full max-w-none pt-2 sm:pt-3 lg:pt-4 pb-10">
      <div className="max-w-[800px] lg:max-w-4xl mx-auto px-3 sm:px-4 lg:px-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Afiliados</h1>

        <div className="mb-4">
          <AffiliateCard />
        </div>
      </div>
    </main>
  );
}

