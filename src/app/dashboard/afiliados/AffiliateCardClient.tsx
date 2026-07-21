'use client';

import NextDynamic from 'next/dynamic';

export default NextDynamic(
  () => import('@/components/affiliate/AffiliateCard'),
  { ssr: false },
);
