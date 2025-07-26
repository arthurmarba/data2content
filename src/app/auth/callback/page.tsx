'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const FullPageLoader = () => (
  <div className="flex items-center justify-center h-screen">
    <p>Redirecionando...</p>
  </div>
);

export default function AuthCallbackPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const userRole = session.user.role;
      if (userRole === 'admin') {
        router.replace('/admin/creator-dashboard');
      } else if (userRole === 'agency') {
        if (session.user.agencyPlanStatus === 'active') {
          router.replace('/agency/dashboard');
        } else {
          router.replace('/agency/subscription');
        }
      } else {
        router.replace('/dashboard');
      }
    } else if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, session, router]);

  return <FullPageLoader />;
}
