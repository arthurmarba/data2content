import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import CalculatorClient from './CalculatorClient';

export const dynamic = 'force-dynamic';

export default async function CalculatorPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/login');
  }

  return <CalculatorClient />;
}
