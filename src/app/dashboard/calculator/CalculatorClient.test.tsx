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
const originalScrollIntoView = Element.prototype.scrollIntoView;

beforeEach(() => {
  toastMock.mockClear();
  (track as jest.Mock).mockClear();
  mockUseBillingStatus.mockReset();
  mockUseSession.mockReset();
  window.dispatchEvent = jest.fn();
  Element.prototype.scrollIntoView = jest.fn();
});

afterEach(() => {
  if (global.fetch) {
    (global.fetch as jest.Mock).mockRestore?.();
  }
  window.dispatchEvent = originalDispatch;
  Element.prototype.scrollIntoView = originalScrollIntoView;
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

const buildCalculationResponse = (overrides?: Record<string, unknown>) => ({
  estrategico: 350,
  justo: 500,
  premium: 700,
  cpm: 15,
  breakdown: {
    contentUnits: 1.4,
    contentJusto: 500,
    eventPresenceJusto: 0,
    coverageUnits: 0,
    coverageJusto: 0,
    travelCost: 0,
    hotelCost: 0,
    logisticsSuggested: 0,
    logisticsIncludedInCache: false,
  },
  params: {
    format: 'reels',
    deliveryType: 'conteudo',
    formatQuantities: { reels: 1, post: 0, stories: 0 },
    eventDetails: { durationHours: 4, travelTier: 'local', hotelNights: 0 },
    eventCoverageQuantities: { reels: 0, post: 0, stories: 0 },
    exclusivity: 'nenhuma',
    usageRights: 'organico',
    complexity: 'simples',
    authority: 'padrao',
    seasonality: 'normal',
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
  ...overrides,
});

const setupProUser = () => {
  mockUseSession.mockReturnValue({
    ...defaultSession,
    data: { ...defaultSession.data, user: { ...defaultSession.data.user, planStatus: 'active' } },
  });
  mockUseBillingStatus.mockReturnValue({
    hasPremiumAccess: true,
    isLoading: false,
  });
};

test('free user sees calculator lock and triggers upgrade tracking', () => {
  mockUseSession.mockReturnValue(defaultSession);
  mockUseBillingStatus.mockReturnValue({
    hasPremiumAccess: false,
    isLoading: false,
  });

  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();

    if (url === '/api/mediakit/self/packages' && method === 'GET') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ packages: [] }),
      } as Response);
    }

    return Promise.reject(new Error(`Unexpected fetch call: ${method} ${url}`));
  });

  render(<CalculatorClient />);

  expect(
    screen.getByText('Desbloqueie o poder da precificação inteligente')
  ).toBeInTheDocument();
  expect(track).toHaveBeenCalledWith('pro_feature_locked_viewed', {
    feature: 'calculator',
  });

  fireEvent.click(screen.getByRole('button', { name: /Quero Acesso Agora/i }));

  expect(track).toHaveBeenCalledWith('pro_feature_upgrade_clicked', {
    feature: 'calculator',
    source: 'banner',
  });
});

test('pro user can submit calculator and view results', async () => {
  setupProUser();

  const calculationResult = buildCalculationResponse();
  global.fetch = jest.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();

    if (url === '/api/mediakit/self/packages' && method === 'GET') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ packages: [] }),
      } as Response);
    }

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

  fireEvent.click(screen.getByRole('button', { name: /Calcular Valor da Publi/i }));

  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/calculator',
      expect.objectContaining({ method: 'POST' })
    )
  );

  expect(await screen.findByText('Estratégico (Mínimo)')).toBeInTheDocument();
  expect(screen.getByText('Valor Justo (Sugerido)')).toBeInTheDocument();
  expect(screen.getByText('Premium (Alto Valor)')).toBeInTheDocument();
  expect(track).not.toHaveBeenCalledWith('pro_feature_locked_viewed', expect.anything());
});

test('submits multi-delivery payload with reels + stories', async () => {
  setupProUser();

  const fetchMock = jest.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();

    if (url === '/api/mediakit/self/packages' && method === 'GET') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ packages: [] }),
      } as Response);
    }

    if (url === '/api/calculator' && method === 'POST') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () =>
          buildCalculationResponse({
            params: {
              format: 'pacote',
              deliveryType: 'conteudo',
              formatQuantities: { reels: 1, post: 0, stories: 1 },
              eventDetails: { durationHours: 4, travelTier: 'local', hotelNights: 0 },
              eventCoverageQuantities: { reels: 0, post: 0, stories: 0 },
              exclusivity: 'nenhuma',
              usageRights: 'organico',
              complexity: 'simples',
              authority: 'padrao',
              seasonality: 'normal',
            },
          }),
      } as Response);
    }

    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  });

  global.fetch = fetchMock as any;

  render(<CalculatorClient />);

  fireEvent.click(screen.getByLabelText('Aumentar Stories'));
  fireEvent.click(screen.getByRole('button', { name: /Calcular Valor da Publi/i }));

  await waitFor(() => {
    const postCall = fetchMock.mock.calls.find((call) => call[0] === '/api/calculator');
    expect(postCall).toBeTruthy();
    const body = JSON.parse((postCall?.[1] as RequestInit).body as string);
    expect(body.deliveryType).toBe('conteudo');
    expect(body.format).toBe('pacote');
    expect(body.formatQuantities).toEqual({ reels: 1, post: 0, stories: 1 });
  });
});

test('submits event payload in event tab', async () => {
  setupProUser();

  const fetchMock = jest.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();

    if (url === '/api/mediakit/self/packages' && method === 'GET') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ packages: [] }),
      } as Response);
    }

    if (url === '/api/calculator' && method === 'POST') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () =>
          buildCalculationResponse({
            params: {
              format: 'evento',
              deliveryType: 'evento',
              formatQuantities: { reels: 0, post: 0, stories: 0 },
              eventDetails: { durationHours: 4, travelTier: 'local', hotelNights: 0 },
              eventCoverageQuantities: { reels: 0, post: 0, stories: 0 },
              exclusivity: 'nenhuma',
              usageRights: 'organico',
              complexity: 'simples',
              authority: 'padrao',
              seasonality: 'normal',
            },
            breakdown: {
              contentUnits: 0,
              contentJusto: 0,
              eventPresenceJusto: 500,
              coverageUnits: 0,
              coverageJusto: 0,
              travelCost: 0,
              hotelCost: 0,
              logisticsSuggested: 0,
              logisticsIncludedInCache: false,
            },
          }),
      } as Response);
    }

    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  });

  global.fetch = fetchMock as any;

  render(<CalculatorClient />);

  fireEvent.click(screen.getByRole('button', { name: /Presença em Evento/i }));
  fireEvent.click(screen.getByRole('button', { name: /Calcular Valor da Publi/i }));

  await waitFor(() => {
    const postCall = fetchMock.mock.calls.find((call) => call[0] === '/api/calculator');
    expect(postCall).toBeTruthy();
    const body = JSON.parse((postCall?.[1] as RequestInit).body as string);
    expect(body.deliveryType).toBe('evento');
    expect(body.format).toBe('evento');
    expect(body.eventDetails).toMatchObject({ durationHours: 4, travelTier: 'local', hotelNights: 0 });
  });
});

test('blocks submit when content mode has no selected deliverables', async () => {
  setupProUser();

  const fetchMock = jest.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();

    if (url === '/api/mediakit/self/packages' && method === 'GET') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ packages: [] }),
      } as Response);
    }

    if (url === '/api/calculator' && method === 'POST') {
      throw new Error('Calculator should not be called without deliverables');
    }

    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  });

  global.fetch = fetchMock as any;

  render(<CalculatorClient />);

  fireEvent.click(screen.getByLabelText('Diminuir Reels'));
  fireEvent.click(screen.getByRole('button', { name: /Calcular Valor da Publi/i }));

  expect(await screen.findByText(/Selecione pelo menos uma entrega/i)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalledWith('/api/calculator', expect.anything());
});
