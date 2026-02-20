'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import useSWR from 'swr';
import Head from 'next/head';
import { AnimatePresence, motion } from 'framer-motion';

import AgencyAuthGuard from '../components/AgencyAuthGuard';
import GlobalTimePeriodFilter from '@/app/admin/creator-dashboard/components/filters/GlobalTimePeriodFilter';
import { GlobalTimePeriodProvider, useGlobalTimePeriod } from '@/app/admin/creator-dashboard/components/filters/GlobalTimePeriodContext';
import PlatformSummaryKpis from '@/app/admin/creator-dashboard/components/kpis/PlatformSummaryKpis';
import PlatformOverviewSection from '@/app/admin/creator-dashboard/components/views/PlatformOverviewSection';
import PlatformContentAnalysisSection from '@/app/admin/creator-dashboard/components/views/PlatformContentAnalysisSection';
import CreatorRankingSection from '@/app/admin/creator-dashboard/components/views/CreatorRankingSection';
import TopMoversSection from '@/app/admin/creator-dashboard/components/views/TopMoversSection';
import UserDetailView from '@/app/admin/creator-dashboard/components/views/UserDetailView';
import CreatorQuickSearch from '@/app/admin/creator-dashboard/components/CreatorQuickSearch';
import ScrollToTopButton from '@/app/components/ScrollToTopButton';
import GlobalPostsExplorer from '@/app/admin/creator-dashboard/GlobalPostsExplorer';
import { contextCategories } from '@/app/lib/classification';


const SkeletonBlock = ({ width = 'w-full', height = 'h-4', className = '' }) => (
  <div className={`bg-gray-200 animate-pulse rounded ${width} ${height} ${className}`}></div>
);

const DASHBOARD_SWR_OPTIONS = {
  revalidateOnFocus: false,
  dedupingInterval: 60 * 1000,
};

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

const AgencyDashboardContent: React.FC = () => {

  const apiPrefix = '/api/agency';
  const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(res => res.json());

  const { data: summary, mutate: mutateSummary } = useSWR('/api/agency/summary', fetcher, DASHBOARD_SWR_OPTIONS);
  const { data: guestsData, mutate: mutateGuests } = useSWR('/api/agency/guests', fetcher, DASHBOARD_SWR_OPTIONS);

  const inviteCode = summary?.inviteCode ?? '';
  const agencyName = summary?.name ?? '';
  const guests: Array<{ id: string; name: string; email: string; planStatus: string }> = guestsData?.guests || [];
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);
  const [selectedUserPhotoUrl, setSelectedUserPhotoUrl] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [selectedCreatorContext, setSelectedCreatorContext] = useState<string>('');
  const { timePeriod: globalTimePeriod, setTimePeriod: setGlobalTimePeriod } = useGlobalTimePeriod();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nameCache = useRef<Record<string, string>>({});
  const photoCache = useRef<Record<string, string | null>>({});

  const handleRefresh = useCallback(() => {
    mutateSummary();
    mutateGuests();
  }, [mutateSummary, mutateGuests]);

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
  }, [searchParams]);

  const today = new Date();
  const startDateObj = getStartDateFromTimePeriod(today, globalTimePeriod as TimePeriod);
  const startDate = startDateObj.toISOString();
  const endDate = today.toISOString();
  const rankingDateRange = { startDate, endDate };
  const rankingDateLabel = `${startDateObj.toLocaleDateString('pt-BR')} - ${today.toLocaleDateString('pt-BR')}`;

  const handleUserSelect = useCallback((creator: { id: string; name: string; profilePictureUrl?: string | null }) => {
    nameCache.current[creator.id] = creator.name;
    photoCache.current[creator.id] = creator.profilePictureUrl ?? null;
    router.push(`${pathname}?userId=${creator.id}`, { scroll: false });
    setSelectedUserPhotoUrl(creator.profilePictureUrl ?? null);
  }, [pathname, router]);

  const handleClearSelection = useCallback(() => {
    router.push(pathname, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname, router]);

  const inviteLink = inviteCode ? `${typeof window !== 'undefined' ? window.location.origin : ''}/assinar?codigo_agencia=${inviteCode}` : '';

  const copy = () => { if (inviteLink) navigator.clipboard.writeText(inviteLink); };

  if (isInitializing) {
    return <div className="flex justify-center items-center h-screen"><SkeletonBlock height="h-12" width="w-12" /></div>;
  }

  return (
    <>
      <Head>
        <title>Dashboard do Parceiro - Data2Content</title>
      </Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
          <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
            {agencyName && (
              <h1 className="text-xl font-semibold text-gray-800 text-center py-2">
                {agencyName}
              </h1>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4">
              <div className="flex-1 min-w-0 mb-2 sm:mb-0">
                <CreatorQuickSearch
                  apiPrefix={apiPrefix}
                  onSelect={handleUserSelect}
                  selectedCreatorName={selectedUserName}
                  selectedCreatorPhotoUrl={selectedUserPhotoUrl}
                  onClear={handleClearSelection}
                />
              </div>
              <div className="flex items-center gap-4 ml-0 sm:ml-4">
                <GlobalTimePeriodFilter
                  selectedTimePeriod={globalTimePeriod}
                  onTimePeriodChange={setGlobalTimePeriod}
                  options={[
                    { value: 'last_7_days', label: 'Últimos 7 dias' },
                    { value: 'last_30_days', label: 'Últimos 30 dias' },
                    { value: 'last_90_days', label: 'Últimos 90 dias' },
                  ]}
                />
                <div className="min-w-[200px]">
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
                    {contextCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleRefresh}
                  className="px-3 py-1 text-sm bg-brand-pink text-white rounded"
                >
                  Atualizar
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <section id="my-guests" className="mb-8">
            <h2 className="text-lg font-semibold mb-2">Meus Convidados ({guests.length})</h2>
            {guests.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Nome</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">E-mail</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guests.map((g) => (
                      <tr key={g.id} className="border-t">
                        <td className="px-4 py-2 text-sm">{g.name || '-'}</td>
                        <td className="px-4 py-2 text-sm">{g.email}</td>
                        <td className="px-4 py-2 text-sm">{g.planStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Nenhum convidado registrado ainda.</p>
            )}
            {inviteLink && (
              <div className="mt-4">
                <p className="text-sm mb-2">Convide novos criadores com o link:</p>
                <div className="flex">
                  <input
                    type="text"
                    readOnly
                    value={inviteLink}
                    className="flex-1 border border-gray-300 rounded-l px-2 py-1 text-sm bg-white break-all"
                  />
                  <button
                    className="px-3 py-1 text-sm bg-brand-pink text-white rounded-r"
                    onClick={copy}
                  >
                    Copiar
                  </button>
                </div>
              </div>
            )}
          </section>
          <section id="platform-summary" className="mb-8">
            <PlatformSummaryKpis
              apiPrefix={apiPrefix}
              startDate={startDate}
              endDate={endDate}
              creatorContextFilter={selectedCreatorContext || undefined}
            />
          </section>

          <AnimatePresence>
            {!selectedUserId && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                <CreatorRankingSection
                  apiPrefix={apiPrefix}
                  rankingDateRange={rankingDateRange}
                  rankingDateLabel={rankingDateLabel}
                  creatorContextFilter={selectedCreatorContext || undefined}
                />
                <PlatformContentAnalysisSection
                  apiPrefix={apiPrefix}
                  startDate={startDate}
                  endDate={endDate}
                  creatorContextFilter={selectedCreatorContext || undefined}
                />
                <PlatformOverviewSection
                  apiPrefix={apiPrefix}
                  followerTrendTitle="Evolução de Seguidores do Parceiro"
                  creatorContextFilter={selectedCreatorContext || undefined}
                />
                <TopMoversSection
                  apiPrefix={apiPrefix}
                  creatorContextFilter={selectedCreatorContext || undefined}
                />
                <GlobalPostsExplorer
                  apiPrefix={apiPrefix}
                  dateRangeFilter={{ startDate, endDate }}
                  creatorContextFilter={selectedCreatorContext || undefined}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div id="user-detail-view-container">
              {selectedUserId && (
                <UserDetailView
                  userId={selectedUserId}
                  userName={selectedUserName ?? `Criador ID: ${selectedUserId.slice(0, 8)}...`}
                  userPhotoUrl={selectedUserPhotoUrl ?? undefined}
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

const AgencyDashboardPage: React.FC = () => (
  <AgencyAuthGuard>
    <GlobalTimePeriodProvider>
      <AgencyDashboardContent />
    </GlobalTimePeriodProvider>
  </AgencyAuthGuard>
);

export default AgencyDashboardPage;
