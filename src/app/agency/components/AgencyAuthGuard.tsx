'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';

interface AgencyUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
  isAgency?: boolean;
  agencyPlanStatus?: string | null;
}

interface ExtendedSession {
  user?: AgencyUser;
  expires: string;
}

export default function AgencyAuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession() as { data: ExtendedSession | null, status: 'loading' | 'authenticated' | 'unauthenticated' };
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.replace('/login?error=SessionRequired&callbackUrl=/agency/creator-dashboard');
      return;
    }

    const userIsAgency = session?.user?.role === 'agency' || session?.user?.isAgency === true;
    const planActive = session?.user?.agencyPlanStatus === 'active';
    if (!userIsAgency) {
      router.replace('/unauthorized?error=AgencyAccessRequired');
    } else if (!planActive) {
      router.replace('/agency/subscription');
    }
  }, [status, session, router]);

  if (
    status === 'loading' ||
    status === 'unauthenticated' ||
    (status === 'authenticated' && (
      !(session?.user?.role === 'agency' || session?.user?.isAgency === true) ||
      session?.user?.agencyPlanStatus !== 'active'
    ))
  ) {
    return (
      <div className="flex items-center justify-center h-screen bg-brand-light">
        <p className="text-lg text-gray-700">Verificando autorização...</p>
      </div>
    );
  }

  return <>{children}</>;
}
