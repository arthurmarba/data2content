// src/app/dashboard/page.tsx
import { redirect } from 'next/navigation';

export default function DashboardLegacyRedirect() {
  redirect('/dashboard/chat');
}

