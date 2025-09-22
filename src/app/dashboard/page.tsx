// src/app/dashboard/page.tsx
import { redirect } from 'next/navigation';

export default function DashboardLegacyRedirect() {
  const flag = process.env.DISCOVER_AS_DEFAULT;
  if (typeof flag === 'string' && flag.trim() === '0') {
    redirect('/dashboard/chat');
  }
  redirect('/dashboard/discover');
}
