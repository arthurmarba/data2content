import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CalculatorClient from './CalculatorClient';
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
      planStatus: 'inactive',
    },
  },
  status: 'authenticated',
} as const;

test('free user sees calculator lock and triggers upgrade tracking', () => {
  mockUseSession.mockReturnValue(defaultSession);
  mockUseBillingStatus.mockReturnValue({
    hasPremiumAccess: false,
    isLoading: false,
  });

  global.fetch = jest.fn();

  render(<CalculatorClient />);

  expect(
    screen.getByText('Calculadora de Publi liberada apenas para assinantes PRO')
  ).toBeInTheDocument();
  expect(track).toHaveBeenCalledWith('pro_feature_locked_viewed', {
    feature: 'calculator',
  });

  fireEvent.click(screen.getByRole('button', { name: /Desbloquear IA/i }));

  expect(track).toHaveBeenCalledWith('pro_feature_upgrade_clicked', {
    feature: 'calculator',
    source: 'banner',
  });
});

test('pro user can submit calculator and view results', async () => {
  mockUseSession.mockReturnValue({
    ...defaultSession,
    data: { ...defaultSession.data, user: { ...defaultSession.data.user, planStatus: 'active' } },
  });
  mockUseBillingStatus.mockReturnValue({
    hasPremiumAccess: true,
    isLoading: false,
  });

  const calculationResult = {
    estrategico: 350,
    justo: 500,
    premium: 700,
    cpm: 15,
    params: {
      format: 'reels',
      exclusivity: 'nenhuma',
      usageRights: 'organico',
      complexity: 'simples',
    },
    metrics: {
      reach: 25000,
      engagement: 5,
      profileSegment: 'default',
    },
    avgTicket: 400,
    totalDeals: 3,
    calculationId: 'calc-1',
    explanation: 'Dados simulados.',
    createdAt: new Date().toISOString(),
  };

  global.fetch = jest.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();

    if (url === '/api/calculator' && method === 'POST') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => calculationResult,
      } as Response);
    }

    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  });

  render(<CalculatorClient />);

  expect(
    screen.queryByText('Calculadora de Publi liberada apenas para assinantes PRO')
  ).toBeNull();

  fireEvent.submit(screen.getByRole('button', { name: /Calcular valores/i }).closest('form')!);

  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/calculator',
      expect.objectContaining({ method: 'POST' })
    )
  );

  expect(await screen.findByText('Faixa estratégica')).toBeInTheDocument();
  expect(screen.getByText('Faixa justa')).toBeInTheDocument();
  expect(screen.getByText('Faixa premium')).toBeInTheDocument();
  expect(track).not.toHaveBeenCalledWith('pro_feature_locked_viewed', expect.anything());
});
