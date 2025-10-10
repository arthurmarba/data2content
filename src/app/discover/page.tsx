// src/app/discover/page.tsx
import { redirect } from 'next/navigation';
import { MAIN_DASHBOARD_ROUTE } from '@/constants/routes';

export const dynamic = 'force-dynamic';

export default function DiscoverLegacyRedirect() {
  redirect(MAIN_DASHBOARD_ROUTE);
}
