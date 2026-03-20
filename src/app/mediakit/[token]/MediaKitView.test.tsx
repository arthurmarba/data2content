import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import MediaKitView from './MediaKitView';
import { useSession } from 'next-auth/react';

jest.mock('next-auth/react', () => ({ useSession: jest.fn() }));

jest.mock('framer-motion', () => {
  const React = require('react');
  const createMotionValue = (initial: any) => {
    let current = initial;
    return {
      get: () => current,
      set: (next: any) => {
        current = next;
      },
    };
  };
  return {
    motion: new Proxy({}, {
      get: (_, prop) => {
        const MockMotionComponent = React.forwardRef(function MockMotionComponent(props: any, ref) {
          return React.createElement(prop as any, { ...props, ref }, props.children);
        });
        MockMotionComponent.displayName = `MockMotion(${String(prop)})`;
        return MockMotionComponent;
      },
    }),
    useMotionValue: (initial: any) => createMotionValue(initial),
    useSpring: (value: any) => value,
    useMotionTemplate: (strings: TemplateStringsArray, ...values: any[]) =>
      strings.reduce((acc, part, index) => acc + part + (values[index] ?? ''), ''),
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
    engagementTrend: null,
  } as any;

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    global.fetch = jest.fn(() => new Promise(() => {})) as any;
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

  it('shows owner-only elements but not affiliate card', () => {
    (useSession as jest.Mock).mockReturnValue({ data: { user: { _id: 'user1' } } });
    render(<MediaKitView {...baseProps} />);
    expect(screen.getByTestId('subscribe-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('affiliate-card')).not.toBeInTheDocument();
  });

  it('hides locked premium teasers for public viewers', () => {
    (useSession as jest.Mock).mockReturnValue({ data: null });
    render(
      <MediaKitView
        {...baseProps}
        premiumAccess={{ canViewCategories: false, visibilityMode: 'lock' } as any}
        showOwnerCtas={false}
      />
    );
    expect(screen.queryByText(/Destaques de performance disponíveis no modo Pro/i)).not.toBeInTheDocument();
  });

  it('shows locked premium teasers for owners without access', () => {
    (useSession as jest.Mock).mockReturnValue({ data: { user: { _id: 'user1' } } });
    render(
      <MediaKitView
        {...baseProps}
        premiumAccess={{ canViewCategories: false, visibilityMode: 'lock' } as any}
        showOwnerCtas={true}
      />
    );
    expect(screen.getByText(/Ative o modo Pro para ver formato, contexto, intenção, narrativa, prova e modo comercial que mais puxam crescimento/i)).toBeInTheDocument();
  });

  it('renders V2 and V2.5 performance signals in the media kit view', () => {
    (useSession as jest.Mock).mockReturnValue({ data: { user: { _id: 'user1' } } });
    render(
      <MediaKitView
        {...baseProps}
        showOwnerCtas={true}
        summary={{
          topPerformingFormat: {
            name: 'reel',
            metricName: 'Interações (média por post)',
            value: 1200,
            valueFormatted: '1.2K',
          },
          topPerformingContext: {
            name: 'fashion_style',
            metricName: 'Interações (média por post)',
            value: 980,
            valueFormatted: '980',
          },
          topPerformingContentIntent: {
            name: 'convert',
            metricName: 'Interações (média por post)',
            value: 1100,
            valueFormatted: '1.1K',
          },
          topPerformingNarrativeForm: {
            name: 'review',
            metricName: 'Interações (média por post)',
            value: 930,
            valueFormatted: '930',
          },
          topPerformingStance: {
            name: 'endorsing',
            metricName: 'Interações (média por post)',
            value: 880,
            valueFormatted: '880',
          },
          topPerformingProofStyle: {
            name: 'demonstration',
            metricName: 'Interações (média por post)',
            value: 840,
            valueFormatted: '840',
          },
          topPerformingCommercialMode: {
            name: 'paid_partnership',
            metricName: 'Interações (média por post)',
            value: 790,
            valueFormatted: '790',
          },
          bestDay: { dayOfWeek: 3, average: 721.4 },
        }}
        videos={[
          {
            _id: 'video-1',
            format: ['reel'],
            context: ['fashion_style'],
            contentIntent: ['convert'],
            narrativeForm: ['review'],
            stance: ['endorsing'],
            proofStyle: ['demonstration'],
            commercialMode: ['paid_partnership'],
            contentSignals: ['promo_offer'],
            stats: { views: 1000, likes: 120, comments: 14, shares: 8, saves: 12 },
          },
        ]}
      />
    );

    expect(screen.queryByText('Destaques de Performance')).not.toBeInTheDocument();
    expect(screen.getByText('Destaques Estratégicos')).toBeInTheDocument();
    expect(screen.getAllByText('Intenção dominante').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Converter').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Postura forte').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Endossando').length).toBeGreaterThan(0);
    expect(screen.getByText('Leitura estratégica')).toBeInTheDocument();
    expect(screen.getByText('Narrativa')).toBeInTheDocument();
    expect(screen.getAllByText('Review').length).toBeGreaterThan(0);
    expect(screen.getByText('Melhor dia')).toBeInTheDocument();
  });
});
