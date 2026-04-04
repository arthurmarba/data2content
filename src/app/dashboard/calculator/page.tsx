import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import CalculatorClient from './CalculatorClient';

export const dynamic = 'force-dynamic';

export default async function CalculatorPage() {
  const session = await getServerSession(authOptions);

  return (
    <CalculatorClient
      viewer={
        session?.user
          ? {
              id: session.user.id,
              role: session.user.role ?? null,
              name: session.user.name ?? null,
              planStatus: (session.user as { planStatus?: string | null }).planStatus ?? null,
            }
          : undefined
      }
    />
  );
}
