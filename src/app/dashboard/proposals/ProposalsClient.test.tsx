import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { track } from '@/lib/track';

import ProposalsClient from './ProposalsClient';

const toastMock = jest.fn();
jest.mock('@/app/components/ui/ToastA11yProvider', () => ({
  useToast: () => ({ toast: toastMock }),
}));

const mockUseBillingStatus = jest.fn();
jest.mock('@/app/hooks/useBillingStatus', () => ({
  __esModule: true,
  default: () => mockUseBillingStatus(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/track', () => ({
  track: jest.fn(),
}));

const originalFetch = global.fetch;

beforeEach(() => {
  toastMock.mockClear();
  (track as jest.Mock).mockClear();
  mockUseBillingStatus.mockReset();
});

afterEach(() => {
  if (global.fetch) {
    (global.fetch as jest.Mock).mockRestore?.();
  }
});

afterAll(() => {
  global.fetch = originalFetch;
});

function mockFetchFreeFlow() {
  const listPayload = {
    items: [
      {
        id: 'prop-1',
        brandName: 'Marca X',
        contactEmail: 'brand@example.com',
        contactWhatsapp: null,
        campaignTitle: 'Campanha XPTO',
        campaignDescription: null,
        deliverables: [],
        budget: null,
        budgetIntent: 'requested',
        currency: 'BRL',
        creatorProposedBudget: null,
        creatorProposedCurrency: null,
        creatorProposedAt: null,
        status: 'novo',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastResponseAt: null,
        lastResponseMessage: null,
      },
    ],
  };

  const detailPayload = {
    ...listPayload.items[0],
    originIp: null,
    userAgent: null,
    mediaKitSlug: 'creator-kit',
    latestAnalysis: null,
    analysisHistory: [],
  };

  const updatedDetail = {
    ...detailPayload,
    status: 'visto',
  };

  return jest
    .spyOn(global, 'fetch')
    .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method || 'GET').toUpperCase();

      if (url === '/api/users/media-kit-token' && method === 'GET') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ url: 'https://data2content.io/media-kit/creator' }),
        } as Response);
      }

      if (url.startsWith('/api/proposals') && !url.includes('/prop-1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => listPayload,
        } as Response);
      }

      if (url === '/api/proposals/prop-1' && method === 'GET') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => detailPayload,
        } as Response);
      }

      if (url === '/api/proposals/prop-1' && method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => updatedDetail,
        } as Response);
      }

      if (url === '/api/proposals/prop-1/notify-upgrade' && method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        } as Response);
      }

      throw new Error(`Unexpected fetch call: ${method} ${url}`);
    });
}

function mockFetchProFlow() {
  const listPayload = {
    items: [
      {
        id: 'prop-2',
        brandName: 'Marca Y',
        contactEmail: 'brand@example.com',
        contactWhatsapp: null,
        campaignTitle: 'Campanha Plano Pro',
        campaignDescription: 'Detalhes da campanha',
        deliverables: ['Reel'],
        budget: 1500,
        budgetIntent: 'provided',
        currency: 'BRL',
        creatorProposedBudget: null,
        creatorProposedCurrency: null,
        creatorProposedAt: null,
        status: 'visto',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastResponseAt: null,
        lastResponseMessage: '',
      },
    ],
  };

  const detailPayload = {
    ...listPayload.items[0],
    originIp: null,
    userAgent: null,
    mediaKitSlug: 'creator-kit',
    latestAnalysis: null,
    analysisHistory: [],
  };

  return jest
    .spyOn(global, 'fetch')
    .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method || 'GET').toUpperCase();

      if (url === '/api/users/media-kit-token' && method === 'GET') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ url: 'https://data2content.io/media-kit/creator' }),
        } as Response);
      }

      if (url.startsWith('/api/proposals') && !url.includes('/prop-2')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => listPayload,
        } as Response);
      }

      if (url === '/api/proposals/prop-2' && method === 'GET') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => detailPayload,
        } as Response);
      }

      if (url === '/api/proposals/prop-2/analyze' && method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            analysis: 'Diagnóstico pronto',
            replyDraft: 'Olá, marca!\n\nPodemos avançar com a campanha.',
            suggestionType: 'aceitar',
            suggestedValue: 1500,
            analysisV2: {
              verdict: 'aceitar',
              confidence: { score: 0.82, label: 'alta' },
              pricing: {
                currency: 'BRL',
                offered: 1500,
                target: 1500,
                anchor: 1800,
                floor: 1400,
                gapPercent: 0,
              },
              rationale: ['Investimento alinhado com o valor recomendado.'],
              playbook: ['Avance para fechamento com cronograma simples.'],
              cautions: [],
            },
            meta: {
              model: 'gpt-4o-mini',
              fallbackUsed: false,
              latencyMs: 120,
              contextSignals: ['has_budget'],
            },
          }),
        } as Response);
      }

      if (url === '/api/proposals/prop-2' && method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => detailPayload,
        } as Response);
      }

      throw new Error(`Unexpected fetch call: ${method} ${url}`);
    });
}

test('free user sees upgrade banner, tracking, and notify-upgrade flow', async () => {
  mockUseBillingStatus.mockReturnValue({
    hasPremiumAccess: false,
    isLoading: false,
  });

  const fetchMock = mockFetchFreeFlow();

  render(<ProposalsClient />);

  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/proposals', expect.anything())
  );

  await waitFor(() =>
    expect(screen.getByText('Desbloqueie a IA de negociação')).toBeInTheDocument()
  );

  expect(track).toHaveBeenCalledWith('pro_feature_locked_viewed', {
    feature: 'proposals_reply',
  });

  await waitFor(() =>
    expect(track).toHaveBeenCalledWith(
      'proposal_received_free_user',
      expect.objectContaining({ proposalId: 'prop-1' })
    )
  );

  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/proposals/prop-1/notify-upgrade',
      expect.objectContaining({ method: 'POST' })
    )
  );
});

test('pro user can generate analysis in summary mode and update reply draft', async () => {
  mockUseBillingStatus.mockReturnValue({
    hasPremiumAccess: true,
    isLoading: false,
  });

  const fetchMock = mockFetchProFlow();

  render(<ProposalsClient />);

  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/proposals', expect.anything())
  );

  fireEvent.click(await screen.findByText('Campanha Plano Pro'));
  fireEvent.click(await screen.findByRole('button', { name: /Ver assistente/i }));

  const analyzeButton = await screen.findByRole('button', {
    name: /Gerar análise/i,
  });

  expect(screen.queryByText('Desbloqueie a IA de negociação')).toBeNull();
  expect(track).not.toHaveBeenCalledWith('pro_feature_locked_viewed', expect.anything());

  fireEvent.click(analyzeButton);

  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/proposals/prop-2/analyze',
      expect.objectContaining({ method: 'POST' })
    )
  );

  expect(await screen.findByText(/Recomendação/i)).toBeInTheDocument();
  expect(await screen.findByText(/Pode fechar/i)).toBeInTheDocument();

  const textarea = await screen.findByPlaceholderText(/Escreva sua resposta aqui/i);
  expect((textarea as HTMLTextAreaElement).value).toContain('Olá, marca!');
  expect((textarea as HTMLTextAreaElement).value).toContain('métricas em tempo real');
});
