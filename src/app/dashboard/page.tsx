// src/app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { MAIN_DASHBOARD_ROUTE } from '@/constants/routes';

export default function DashboardLegacyRedirect() {
  const flag = process.env.DISCOVER_AS_DEFAULT;
  if (typeof flag === 'string' && flag.trim() === '0') {
    redirect('/dashboard/chat');
  }
  redirect(MAIN_DASHBOARD_ROUTE);
}
