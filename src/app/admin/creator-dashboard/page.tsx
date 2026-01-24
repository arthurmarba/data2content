'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';

import GlobalTimePeriodFilter from './components/filters/GlobalTimePeriodFilter';
import { GlobalTimePeriodProvider, useGlobalTimePeriod } from './components/filters/GlobalTimePeriodContext';
import PlatformSummaryKpis from './components/kpis/PlatformSummaryKpis';
import CreatorRankingSection from './components/views/CreatorRankingSection';
import CreatorQuickSearch from './components/CreatorQuickSearch';
import ScrollToTopButton from '@/app/components/ScrollToTopButton';
import DeferredSection from './components/DeferredSection';
import { Category, contextCategories } from '@/app/lib/classification';

// --- Tipos e Funções Auxiliares ---
type TimePeriod = 'last_7_days' | 'last_30_days' | 'last_90_days';
const getStartDateFromTimePeriod = (endDate: Date, timePeriod: TimePeriod): Date => {
  const startDate = new Date(endDate);
  switch (timePeriod) {
    case 'last_7_days': startDate.setDate(startDate.getDate() - 7); break;
    case 'last_30_days': startDate.setMonth(startDate.getMonth() - 1); break;
    case 'last_90_days': startDate.setMonth(startDate.getMonth() - 3); break;
  }
  return startDate;
};
const SkeletonBlock = ({ width = 'w-full', height = 'h-4', className = '' }) => (
  <div className={`bg-gray-200 animate-pulse rounded ${width} ${height} ${className}`}></div>
);

const SectionPlaceholder = () => (
  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <div className="space-y-2">
        <SkeletonBlock width="w-48" height="h-4" />
        <SkeletonBlock width="w-64" height="h-3" />
      </div>
      <SkeletonBlock width="w-24" height="h-6" />
    </div>
    <SkeletonBlock height="h-32" />
  </div>
);

const buildContextOptions = (categories: Category[]) => {
  const options: { id: string; label: string }[] = [];
  const traverse = (cats: Category[], prefix = '') => {
    cats.forEach((cat) => {
      const label = prefix ? `${prefix} > ${cat.label}` : cat.label;
      options.push({ id: cat.id, label });
      if (cat.subcategories?.length) {
        traverse(cat.subcategories, label);
      }
    });
  };

  traverse(categories);
  return options;
};

const PlatformOverviewSection = dynamic(() => import('./components/views/PlatformOverviewSection'));
const PlatformContentAnalysisSection = dynamic(() => import('./components/views/PlatformContentAnalysisSection'));
const CategoryRankingsSection = dynamic(() => import('./components/CategoryRankingsSection'));
const CreatorHighlightsSection = dynamic(() => import('./components/views/CreatorHighlightsSection'));
const TopMoversSection = dynamic(() => import('./components/views/TopMoversSection'));
const GlobalPostsExplorer = dynamic(() => import('./GlobalPostsExplorer'));
const UserDetailView = dynamic(() => import('./components/views/UserDetailView'));

const AdminCreatorDashboardContent: React.FC = () => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);
  const [selectedUserPhotoUrl, setSelectedUserPhotoUrl] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [onlyActiveSubscribers, setOnlyActiveSubscribers] = useState(false);
  const [selectedContext, setSelectedContext] = useState<string>('');
  const [selectedCreatorContext, setSelectedCreatorContext] = useState<string>('');
  const { timePeriod: globalTimePeriod, setTimePeriod: setGlobalTimePeriod } = useGlobalTimePeriod();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nameCache = useRef<Record<string, string>>({});
  const photoCache = useRef<Record<string, string | null>>({});
  const contextOptions = useMemo(() => buildContextOptions(contextCategories), []);

  // ===== CORREÇÃO APLICADA: useEffect segue a recomendação do desenvolvedor =====
  useEffect(() => {
    const userIdFromUrl = searchParams.get('userId');

    if (userIdFromUrl) {
      const knownName = nameCache.current[userIdFromUrl];
      const knownPhoto = photoCache.current[userIdFromUrl];
      const finalName = knownName || `Criador ID: ...${userIdFromUrl.slice(-4)}`;

      setSelectedUserId(userIdFromUrl);
      setSelectedUserName(finalName);
      setSelectedUserPhotoUrl(knownPhoto ?? null);
    } else {
      setSelectedUserId(null);
      setSelectedUserName(null);
      setSelectedUserPhotoUrl(null);
    }
    setIsInitializing(false);
  }, [searchParams]); // A dependência agora é APENAS a URL, como recomendado.

  const { startDate, endDate, rankingDateRange, rankingDateLabel } = useMemo(() => {
    const now = new Date();
    const startDateObj = getStartDateFromTimePeriod(now, globalTimePeriod as TimePeriod);
    const startDate = startDateObj.toISOString();
    const endDate = now.toISOString();
    return {
      startDate,
      endDate,
      rankingDateRange: { startDate, endDate },
      rankingDateLabel: `${startDateObj.toLocaleDateString("pt-BR")} - ${now.toLocaleDateString("pt-BR")}`,
    };
  }, [globalTimePeriod]);

  // ===== CORREÇÃO APLICADA: Handlers apenas modificam a URL =====
  const handleUserSelect = useCallback((creator: { id: string; name: string; profilePictureUrl?: string | null }) => {
    nameCache.current[creator.id] = creator.name; // Salva o nome no cache para UX
    photoCache.current[creator.id] = creator.profilePictureUrl ?? null;
    router.push(`${pathname}?userId=${creator.id}`, { scroll: false });
    setSelectedUserPhotoUrl(creator.profilePictureUrl ?? null);
  }, [pathname, router]);

  const handleClearSelection = useCallback(() => {
    router.push(pathname, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname, router]);

  if (isInitializing) {
    return <div className="flex justify-center items-center h-screen"><SkeletonBlock height="h-12" width="w-12" /></div>;
  }

  return (
    <>
      <Head>
        <title>Dashboard de Criadores - Data2Content</title>
      </Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-4 py-3 flex flex-col gap-3">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1">Buscar criador</p>
                  <CreatorQuickSearch
                    onSelect={handleUserSelect}
                    selectedCreatorName={selectedUserName}
                    selectedCreatorPhotoUrl={selectedUserPhotoUrl}
                    onClear={handleClearSelection}
                  />
                </div>
                <div className="flex items-center gap-3 lg:gap-4">
                  <GlobalTimePeriodFilter
                    selectedTimePeriod={globalTimePeriod}
                    onTimePeriodChange={setGlobalTimePeriod}
                    options={[
                      { value: "last_7_days", label: "Últimos 7 dias" },
                      { value: "last_30_days", label: "Últimos 30 dias" },
                      { value: "last_90_days", label: "Últimos 90 dias" },
                    ]}
                  />
                  <label className="flex items-center gap-2 text-sm text-gray-700 whitespace-nowrap bg-gray-50 border border-gray-200 px-3 py-2 rounded-md">
                    <input
                      type="checkbox"
                      checked={onlyActiveSubscribers}
                      onChange={(e) => setOnlyActiveSubscribers(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Apenas assinantes ativos
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="global-context" className="block text-xs font-semibold text-gray-600 mb-1">
                    Nicho (Contexto)
                  </label>
                  <select
                    id="global-context"
                    value={selectedContext}
                    onChange={(e) => setSelectedContext(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white shadow-sm"
                  >
                    <option value="">Todos os nichos</option>
                    {contextOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="creator-context" className="block text-xs font-semibold text-gray-600 mb-1">
                    Nicho do criador
                  </label>
                  <select
                    id="creator-context"
                    value={selectedCreatorContext}
                    onChange={(e) => setSelectedCreatorContext(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white shadow-sm"
                  >
                    <option value="">Todos os nichos</option>
                    {contextOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="self-end text-xs text-gray-500">
                  <p className="mb-1 font-semibold text-gray-600">Dica rápida</p>
                  <p>Combine busca + nicho para acelerar o carregamento e focar nos criadores certos.</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <section id="platform-summary" className="mb-8">
            <PlatformSummaryKpis
              startDate={startDate}
              endDate={endDate}
              onlyActiveSubscribers={onlyActiveSubscribers}
              contextFilter={selectedContext || undefined}
              creatorContextFilter={selectedCreatorContext || undefined}
            />
          </section>

          <AnimatePresence>
            {!selectedUserId && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                <CreatorRankingSection
                  rankingDateRange={rankingDateRange}
                  rankingDateLabel={rankingDateLabel}
                  onlyActiveSubscribers={onlyActiveSubscribers}
                  contextFilter={selectedContext || undefined}
                  creatorContextFilter={selectedCreatorContext || undefined}
                />
                <DeferredSection minHeight="420px" placeholder={<SectionPlaceholder />}>
                  <PlatformContentAnalysisSection
                    startDate={startDate}
                    endDate={endDate}
                    onlyActiveSubscribers={onlyActiveSubscribers}
                    contextFilter={selectedContext || undefined}
                    creatorContextFilter={selectedCreatorContext || undefined}
                  />
                </DeferredSection>
                <DeferredSection minHeight="520px" placeholder={<SectionPlaceholder />}>
                  <CategoryRankingsSection
                    startDate={startDate}
                    endDate={endDate}
                    selectedUserId={selectedUserId}
                    onlyActiveSubscribers={onlyActiveSubscribers}
                    contextFilter={selectedContext || undefined}
                    creatorContextFilter={selectedCreatorContext || undefined}
                  />
                </DeferredSection>
                <DeferredSection minHeight="360px" placeholder={<SectionPlaceholder />}>
                  <CreatorHighlightsSection creatorContextFilter={selectedCreatorContext || undefined} />
                </DeferredSection>
                <DeferredSection minHeight="520px" placeholder={<SectionPlaceholder />}>
                  <PlatformOverviewSection
                    onlyActiveSubscribers={onlyActiveSubscribers}
                    contextFilter={selectedContext || undefined}
                    creatorContextFilter={selectedCreatorContext || undefined}
                  />
                </DeferredSection>
                <DeferredSection minHeight="420px" placeholder={<SectionPlaceholder />}>
                  <TopMoversSection
                    onlyActiveSubscribers={onlyActiveSubscribers}
                    contextFilter={selectedContext || undefined}
                    creatorContextFilter={selectedCreatorContext || undefined}
                  />
                </DeferredSection>
                <DeferredSection minHeight="640px" placeholder={<SectionPlaceholder />}>
                  <GlobalPostsExplorer
                    dateRangeFilter={{ startDate, endDate }}
                    forceOnlyActiveSubscribers={onlyActiveSubscribers}
                    forceContext={selectedContext ? [selectedContext] : undefined}
                    creatorContextFilter={selectedCreatorContext || undefined}
                  />
                </DeferredSection>
              </motion.div>
            )}
          </AnimatePresence>

          <div id="user-detail-view-container">
            {selectedUserId && (
              <UserDetailView
                userId={selectedUserId}
                userName={selectedUserName ?? `Criador ID: ${selectedUserId.slice(0, 8)}...`}
                userPhotoUrl={selectedUserPhotoUrl}
                onBack={handleClearSelection}
              />
            )}
          </div>
          <ScrollToTopButton />
        </main>
      </div>
    </>
  );
};

const AdminCreatorDashboardPage: React.FC = () => (
  <GlobalTimePeriodProvider>
    <AdminCreatorDashboardContent />
  </GlobalTimePeriodProvider>
);
export default AdminCreatorDashboardPage;
