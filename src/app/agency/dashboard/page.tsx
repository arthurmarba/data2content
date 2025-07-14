'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import React, { useState, useEffect, useCallback, useRef } from 'react';
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


const SkeletonBlock = ({ width = 'w-full', height = 'h-4', className = '' }) => (
  <div className={`bg-gray-200 animate-pulse rounded ${width} ${height} ${className}`}></div>
);

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

  const [inviteCode, setInviteCode] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);
  const [selectedUserPhotoUrl, setSelectedUserPhotoUrl] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const { timePeriod: globalTimePeriod, setTimePeriod: setGlobalTimePeriod } = useGlobalTimePeriod();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nameCache = useRef<Record<string, string>>({});
  const photoCache = useRef<Record<string, string | null>>({});

  useEffect(() => {
    fetch('/api/agency/invite-code')
      .then(res => res.json())
      .then(data => { if (data.inviteCode) setInviteCode(data.inviteCode); })
      .catch(() => {});
  }, []);

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
        <title>Dashboard da Agência - Data2Content</title>
      </Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
          <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4">
              <div className="flex-1 min-w-0 mb-2 sm:mb-0">
                <CreatorQuickSearch
                  apiPrefix="/api/agency"
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
              </div>
            </div>
            {inviteCode && (
              <div className="bg-white p-2 rounded shadow inline-flex items-center gap-2 mt-2">
                <span className="text-sm break-all">{inviteLink}</span>
                <button className="px-2 py-1 text-sm bg-brand-pink text-white rounded" onClick={copy}>Copiar</button>
              </div>
            )}
          </div>
        </header>

        <main className="max-w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <section id="platform-summary" className="mb-8">
            <PlatformSummaryKpis apiPrefix="/api/agency" startDate={startDate} endDate={endDate} />
          </section>

          <AnimatePresence>
            {!selectedUserId && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                <CreatorRankingSection apiPrefix="/api/agency" rankingDateRange={rankingDateRange} rankingDateLabel={rankingDateLabel} />
                <PlatformContentAnalysisSection startDate={startDate} endDate={endDate} />
                <PlatformOverviewSection apiPrefix="/api/agency" followerTrendTitle="Evolução de Seguidores da Agência" />
                <TopMoversSection apiPrefix="/api/agency" />
                <GlobalPostsExplorer apiPrefix="/api/agency" dateRangeFilter={{ startDate, endDate }} />
              </motion.div>
            )}
          </AnimatePresence>

          <div id="user-detail-view-container">
            {selectedUserId && (
              <UserDetailView
                userId={selectedUserId}
                userName={selectedUserName ?? undefined}
                userPhotoUrl={selectedUserPhotoUrl ?? undefined}
                onClear={handleClearSelection}
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
