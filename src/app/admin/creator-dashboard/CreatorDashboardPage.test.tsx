import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), refresh: jest.fn(), back: jest.fn() }),
  usePathname: () => '/admin/creator-dashboard',
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('./components/kpis/PlatformSummaryKpis', () => {
  const Mock = () => <div data-testid="platform-summary-mock" />;
  Mock.displayName = 'PlatformSummaryKpisMock';
  return Mock;
});
jest.mock('./components/views/PlatformOverviewSection', () => {
  const Mock = () => <div data-testid="platform-overview-mock" />;
  Mock.displayName = 'PlatformOverviewSectionMock';
  return Mock;
});
jest.mock('./components/views/PlatformContentAnalysisSection', () => {
  const Mock = () => <div data-testid="platform-content-mock" />;
  Mock.displayName = 'PlatformContentAnalysisSectionMock';
  return Mock;
});
jest.mock('./components/CategoryRankingsSection', () => {
  const Mock = () => <div data-testid="category-rankings-mock" />;
  Mock.displayName = 'CategoryRankingsSectionMock';
  return Mock;
});
jest.mock('./components/views/CreatorRankingSection', () => {
  const Mock = () => <div data-testid="creator-ranking-mock" />;
  Mock.displayName = 'CreatorRankingSectionMock';
  return Mock;
});
jest.mock('./components/views/TopMoversSection', () => {
  const Mock = () => <div data-testid="top-movers-mock" />;
  Mock.displayName = 'TopMoversSectionMock';
  return Mock;
});
jest.mock('./components/views/UserDetailView', () => {
  const Mock = () => <div data-testid="user-detail-mock" />;
  Mock.displayName = 'UserDetailViewMock';
  return Mock;
});
jest.mock('./components/CreatorQuickSearch', () => {
  const Mock = () => <div data-testid="creator-search-mock" />;
  Mock.displayName = 'CreatorQuickSearchMock';
  return Mock;
});
jest.mock('./components/views/CreatorHighlightsSection', () => {
  const Mock = () => <div data-testid="creator-highlights-mock" />;
  Mock.displayName = 'CreatorHighlightsSectionMock';
  return Mock;
});
jest.mock('@/app/components/ScrollToTopButton', () => {
  const Mock = () => <div data-testid="scroll-top-mock" />;
  Mock.displayName = 'ScrollToTopButtonMock';
  return Mock;
});
import CreatorDashboardPage from './page';

// Mocks for child components - simplified to not return JSX directly from factory
jest.mock('./CreatorTable', () => jest.fn(() => <div data-testid="creator-table-mock">CreatorTable</div>));
jest.mock('./ContentStatsWidgets', () => jest.fn(() => <div data-testid="content-stats-mock">ContentStatsWidgets</div>));
jest.mock('./GlobalPostsExplorer', () => jest.fn(() => <div data-testid="global-posts-mock">GlobalPostsExplorer</div>));
jest.mock('./StandaloneChatInterface', () => jest.fn(() => <div data-testid="chat-interface-mock">StandaloneChatInterface</div>));
jest.mock('./ProposalRankingCard', () => jest.fn(() => <div data-testid="proposal-ranking-mock">ProposalRankingCard</div>));
jest.mock('./CreatorRankingCard', () => jest.fn(() => <div data-testid="creator-ranking-mock">CreatorRankingCard</div>));

// Mock Heroicons
jest.mock('@heroicons/react/24/solid', () => ({
  XMarkIcon: jest.fn(() => <div data-testid="x-mark-icon" />),
}));


describe('CreatorDashboardPage Component', () => {
  const CreatorTableMock = require('./CreatorTable') as jest.Mock;
  // const ContentStatsWidgetsMock = require('./ContentStatsWidgets').default;

  beforeEach(() => {
    // Avoid scroll errors in jsdom
    (window as any).scrollTo = jest.fn();
    CreatorTableMock.mockClear();
    // ContentStatsWidgetsMock.mockClear();
  });

  test('renders search and filter controls', () => {
    render(<CreatorDashboardPage />);
    expect(screen.getByText('Buscar criador')).toBeInTheDocument();
    expect(screen.getByLabelText('Nicho (Contexto)')).toBeInTheDocument();
    expect(screen.getByLabelText('Nicho do criador')).toBeInTheDocument();
    const activeCheckbox = screen.getByLabelText('Apenas assinantes ativos') as HTMLInputElement;
    expect(activeCheckbox.checked).toBe(false);
  });

  test('toggles OnlyActiveSubscribers checkbox', () => {
    render(<CreatorDashboardPage />);
    const activeCheckbox = screen.getByLabelText('Apenas assinantes ativos') as HTMLInputElement;
    fireEvent.click(activeCheckbox);
    expect(activeCheckbox.checked).toBe(true);
  });

});
