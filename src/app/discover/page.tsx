// src/app/discover/page.tsx
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function DiscoverLegacyRedirect() {
  redirect('/dashboard/discover');
}
