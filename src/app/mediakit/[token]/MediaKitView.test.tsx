import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import MediaKitView from './MediaKitView';
import { useSession } from 'next-auth/react';

jest.mock('next-auth/react', () => ({ useSession: jest.fn() }));

jest.mock('framer-motion', () => {
  const React = require('react');
  return {
    motion: new Proxy({}, {
      get: (_, prop) => (props: any) => React.createElement(prop as any, props, props.children),
    }),
  };
});

jest.mock('@/app/admin/creator-dashboard/components/filters/GlobalTimePeriodContext', () => {
  const React = require('react');
  return {
    GlobalTimePeriodProvider: ({ children }: any) => <div>{children}</div>,
    useGlobalTimePeriod: () => ({ timePeriod: 'last_90_days', setTimePeriod: jest.fn() }),
  };
});

jest.mock('@/hooks/usePlannerData', () => ({ usePlannerData: () => ({ slots: null, heatmap: null, loading: false }) }));

jest.mock('@/app/admin/creator-dashboard/components/VideosTable', () => ({ __esModule: true, default: () => <div data-testid="VideosTable" /> }));
jest.mock('@/app/dashboard/components/AverageMetricRow', () => ({ __esModule: true, default: () => <div data-testid="AverageMetricRow" /> }));
jest.mock('@/app/admin/creator-dashboard/PostDetailModal', () => ({ __esModule: true, default: () => <div data-testid="PostDetailModal" /> }));
jest.mock('@/app/mediakit/components/PlannerSlotModal', () => ({ __esModule: true, default: () => <div data-testid="PlannerSlotModal" /> }));
jest.mock('@/app/components/UserAvatar', () => ({ UserAvatar: ({ name }: any) => <div data-testid="UserAvatar">{name}</div> }));

jest.mock('@/components/affiliate/AffiliateCard', () => ({ __esModule: true, default: () => <div data-testid="affiliate-card">AffiliateCard</div> }));
jest.mock('@/app/mediakit/components/SubscribeCtaBanner', () => ({ __esModule: true, default: () => <div data-testid="subscribe-banner">SubscribeCtaBanner</div> }));

describe('MediaKitView ownership visibility', () => {
  const baseProps = {
    user: { _id: 'user1', name: 'Owner', profile_picture_url: '', email: 'owner@example.com' },
    summary: null,
    videos: [],
    kpis: null,
    demographics: null,
  } as any;

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('hides cards for visitors', () => {
    (useSession as jest.Mock).mockReturnValue({ data: null });
    render(<MediaKitView {...baseProps} />);
    expect(screen.queryByTestId('subscribe-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('affiliate-card')).not.toBeInTheDocument();
  });

  it('hides cards for non-owners', () => {
    (useSession as jest.Mock).mockReturnValue({ data: { user: { _id: 'other' } } });
    render(<MediaKitView {...baseProps} />);
    expect(screen.queryByTestId('subscribe-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('affiliate-card')).not.toBeInTheDocument();
  });

  it('shows cards for owner', () => {
    (useSession as jest.Mock).mockReturnValue({ data: { user: { _id: 'user1' } } });
    render(<MediaKitView {...baseProps} />);
    expect(screen.getByTestId('subscribe-banner')).toBeInTheDocument();
    expect(screen.getByTestId('affiliate-card')).toBeInTheDocument();
  });
});
