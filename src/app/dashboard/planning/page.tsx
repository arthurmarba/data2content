"use client";

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ContentPlannerSection from '@/app/mediakit/components/ContentPlannerSection';
import { useHeaderSetup } from '../context/HeaderContext';

export default function PlanningPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const instagramConnected = Boolean((session?.user as any)?.instagramConnected);
  const userId = (session?.user as any)?.id as string | undefined;

  useHeaderSetup(
    {
      variant: 'compact',
      showSidebarToggle: true,
      showUserMenu: true,
      sticky: true,
      contentTopPadding: 8,
      title: undefined,
      subtitle: undefined,
      condensedOnScroll: false,
    },
    []
  );

  if (status === 'loading') {
    return (
      <main className="w-full max-w-none pb-12">
        <div className="max-w-[800px] lg:max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <p className="text-sm text-gray-500">Carregando…</p>
        </div>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="w-full max-w-none pb-12">
        <div className="max-w-[800px] lg:max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <p className="text-sm text-gray-500">Você precisa estar autenticado para acessar o planejamento.</p>
        </div>
      </main>
    );
  }

  if (status === 'authenticated' && !instagramConnected) {
    return (
      <main className="w-full max-w-none pb-12">
        <div className="max-w-[800px] lg:max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-amber-900">
            <h2 className="text-lg font-semibold">Conecte seu Instagram para liberar o Planner</h2>
            <p className="mt-2 text-sm">
              Precisamos sincronizar a sua conta para gerar recomendações de conteúdo e horários personalizados.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => router.push('/dashboard/onboarding')}
                className="inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                Ir para o onboarding
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full max-w-none pb-12">
      <div className="max-w-[800px] lg:max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <ContentPlannerSection
          userId={userId}
          publicMode={false}
          description="Explore as recomendações personalizadas do Planner IA para organizar seus conteúdos da semana, acompanhar os melhores horários de publicação e receber sugestões geradas automaticamente com base na sua performance recente."
        />
      </div>
    </main>
  );
}
