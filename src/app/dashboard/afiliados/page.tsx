// src/app/dashboard/afiliados/page.tsx
import React from 'react';
import AffiliateCard from './AffiliateCardClient';

export const dynamic = 'force-dynamic';

export default function AfiliadosPage() {
  return (
    <main className="w-full">
      <AffiliateCard />
    </main>
  );
}
