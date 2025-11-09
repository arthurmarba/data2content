import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ProposalsClient from './ProposalsClient';
import { track } from '@/lib/track';

const toastMock = jest.fn();
jest.mock('@/app/components/ui/ToastA11yProvider', () => ({
  useToast: () => ({ toast: toastMock }),
}));

const mockUseBillingStatus = jest.fn();
jest.mock('@/app/hooks/useBillingStatus', () => ({
  __esModule: true,
  default: () => mockUseBillingStatus(),
}));

const mockUseSession = jest.fn();
jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/track', () => ({
  track: jest.fn(),
}));

const originalFetch = global.fetch;
const originalDispatch = window.dispatchEvent;

beforeEach(() => {
  toastMock.mockClear();
  (track as jest.Mock).mockClear();
  mockUseBillingStatus.mockReset();
  mockUseSession.mockReset();
  window.dispatchEvent = jest.fn();
});

afterEach(() => {
  if (global.fetch) {
    (global.fetch as jest.Mock).mockRestore?.();
  }
  window.dispatchEvent = originalDispatch;
});

afterAll(() => {
  global.fetch = originalFetch;
});

const defaultSession = {
  data: {
    user: {
      id: 'user-1',
      email: 'creator@example.com',
      name: 'Creator',
      planStatus: 'inactive',
    },
  },
  status: 'authenticated',
} as const;

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
        currency: 'BRL',
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
        campaignTitle: 'Campanha Plano Agência',
        campaignDescription: 'Detalhes da campanha',
        deliverables: ['Reel'],
        budget: 1500,
        currency: 'BRL',
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
  };

  return jest
    .spyOn(global, 'fetch')
    .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method || 'GET').toUpperCase();

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
            replyDraft: 'Olá, marca!',
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
  mockUseSession.mockReturnValue(defaultSession);
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
    expect(
      screen.getByText('Responda e negocie direto pela plataforma')
    ).toBeInTheDocument()
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

test('pro user can analyze proposal without seeing upgrade gates', async () => {
  mockUseSession.mockReturnValue({
    ...defaultSession,
    data: {
      ...defaultSession.data,
      user: { ...defaultSession.data.user, planStatus: 'active' },
    },
  });
  mockUseBillingStatus.mockReturnValue({
    hasPremiumAccess: true,
    isLoading: false,
  });

  const fetchMock = mockFetchProFlow();

  render(<ProposalsClient />);

  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/proposals', expect.anything())
  );

  const analyzeButton = await screen.findByRole('button', {
    name: /Analisar com Mobi/i,
  });

  expect(screen.queryByText('Responda e negocie direto pela plataforma')).toBeNull();
  expect(track).not.toHaveBeenCalledWith('pro_feature_locked_viewed', expect.anything());

  fireEvent.click(analyzeButton);

  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/proposals/prop-2/analyze',
      expect.objectContaining({ method: 'POST' })
    )
  );

  expect(await screen.findByText('Diagnóstico do Mobi')).toBeInTheDocument();
  expect(await screen.findByDisplayValue('Olá, marca!')).toBeInTheDocument();
});
