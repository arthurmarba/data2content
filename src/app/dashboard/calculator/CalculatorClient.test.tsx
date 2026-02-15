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

const pushMock = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

jest.mock('@/lib/track', () => ({
  track: jest.fn(),
}));

const mockUseFeatureFlag = jest.fn();
jest.mock('@/app/context/FeatureFlagsContext', () => ({
  useFeatureFlag: (key: string, fallback?: boolean) => mockUseFeatureFlag(key, fallback),
}));

const originalFetch = global.fetch;
const originalDispatch = window.dispatchEvent;
const originalScrollIntoView = Element.prototype.scrollIntoView;
const jsonResponse = (payload: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response);

beforeEach(() => {
  toastMock.mockClear();
  (track as jest.Mock).mockClear();
  mockUseBillingStatus.mockReset();
  mockUseSession.mockReset();
  pushMock.mockReset();
  mockUseFeatureFlag.mockReset();
  mockUseFeatureFlag.mockReturnValue({ enabled: true, loading: false });
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
  calibration: {
    enabled: true,
    baseJusto: 500,
    factorRaw: 1.05,
    factorApplied: 1.05,
    guardrailApplied: false,
    confidence: 0.74,
    confidenceBand: 'alta',
    segmentSampleSize: 40,
    creatorSampleSize: 12,
    windowDaysSegment: 180,
    windowDaysCreator: 365,
    lowConfidenceRangeExpanded: false,
    linkQuality: 'high',
  },
  params: {
    format: 'reels',
    deliveryType: 'conteudo',
    formatQuantities: { reels: 1, post: 0, stories: 0 },
    eventDetails: { durationHours: 4, travelTier: 'local', hotelNights: 0 },
    eventCoverageQuantities: { reels: 0, post: 0, stories: 0 },
    exclusivity: 'nenhuma',
    usageRights: 'organico',
    paidMediaDuration: null,
    repostTikTok: false,
    instagramCollab: false,
    brandSize: 'media',
    imageRisk: 'medio',
    strategicGain: 'baixo',
    contentModel: 'publicidade_perfil',
    allowStrategicWaiver: false,
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
      return Promise.resolve(jsonResponse({ packages: [] }));
    }

    if (url === '/api/calculator' && method === 'POST') {
      return Promise.resolve(jsonResponse(calculationResult));
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
  expect(track).toHaveBeenCalledWith(
    'calculator_submit_started',
    expect.objectContaining({ source: 'form_submit', deliveryType: 'conteudo', format: 'reels', hasCoverage: false })
  );
  expect(track).toHaveBeenCalledWith(
    'calculator_submit_succeeded',
    expect.objectContaining({ source: 'form_submit', deliveryType: 'conteudo', format: 'reels', hasCoverage: false })
  );
  expect(track).not.toHaveBeenCalledWith('pro_feature_locked_viewed', expect.anything());
});

test('shows calibration indicators and tracks calibration event', async () => {
  setupProUser();

  const calculationResult = buildCalculationResponse({
    calibration: {
      enabled: true,
      baseJusto: 420,
      factorRaw: 1.34,
      factorApplied: 1.25,
      guardrailApplied: true,
      confidence: 0.35,
      confidenceBand: 'baixa',
      segmentSampleSize: 9,
      creatorSampleSize: 2,
      windowDaysSegment: 180,
      windowDaysCreator: 365,
      lowConfidenceRangeExpanded: true,
      linkQuality: 'mixed',
    },
  });

  global.fetch = jest.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();
    if (url === '/api/mediakit/self/packages' && method === 'GET') return Promise.resolve(jsonResponse({ packages: [] }));
    if (url === '/api/calculator' && method === 'POST') return Promise.resolve(jsonResponse(calculationResult));
    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  });

  render(<CalculatorClient />);
  fireEvent.click(screen.getByRole('button', { name: /Calcular Valor da Publi/i }));

  expect(await screen.findByText('Confiança')).toBeInTheDocument();
  expect(screen.getByText(/Guardrail ativado/i)).toBeInTheDocument();
  expect(screen.getByText(/Faixa estratégico\/premium ampliada/i)).toBeInTheDocument();
  expect(track).toHaveBeenCalledWith(
    'calculator_calibration_applied',
    expect.objectContaining({
      factorRaw: 1.34,
      factorApplied: 1.25,
      confidence: 0.35,
      band: 'baixa',
      guardrailApplied: true,
    })
  );
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
              paidMediaDuration: null,
              repostTikTok: false,
              instagramCollab: false,
              brandSize: 'media',
              imageRisk: 'medio',
              strategicGain: 'baixo',
              contentModel: 'publicidade_perfil',
              allowStrategicWaiver: false,
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
              paidMediaDuration: null,
              repostTikTok: false,
              instagramCollab: false,
              brandSize: 'media',
              imageRisk: 'medio',
              strategicGain: 'baixo',
              contentModel: 'publicidade_perfil',
              allowStrategicWaiver: false,
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

test('submits paid media rights with duration and platform toggles', async () => {
  setupProUser();

  const fetchMock = jest.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();

    if (url === '/api/mediakit/self/packages' && method === 'GET') {
      return Promise.resolve(jsonResponse({ packages: [] }));
    }

    if (url === '/api/calculator' && method === 'POST') {
      return Promise.resolve(jsonResponse(buildCalculationResponse({
        params: {
          format: 'reels',
          deliveryType: 'conteudo',
          formatQuantities: { reels: 1, post: 0, stories: 0 },
          eventDetails: { durationHours: 4, travelTier: 'local', hotelNights: 0 },
          eventCoverageQuantities: { reels: 0, post: 0, stories: 0 },
          exclusivity: 'nenhuma',
          usageRights: 'midiapaga',
          paidMediaDuration: '30d',
          repostTikTok: true,
          instagramCollab: true,
          brandSize: 'media',
          imageRisk: 'medio',
          strategicGain: 'baixo',
          contentModel: 'publicidade_perfil',
          allowStrategicWaiver: true,
          complexity: 'simples',
          authority: 'padrao',
          seasonality: 'normal',
        },
      })));
    }

    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  });

  global.fetch = fetchMock as any;
  render(<CalculatorClient />);

  fireEvent.click(screen.getByRole('button', { name: /Mídia Paga/i }));
  fireEvent.click(screen.getByRole('button', { name: /Repost no TikTok/i }));
  fireEvent.click(screen.getByRole('button', { name: /Collab com marca no Instagram/i }));
  fireEvent.click(screen.getByRole('button', { name: /Calcular Valor da Publi/i }));

  await waitFor(() => {
    const postCall = fetchMock.mock.calls.find((call) => call[0] === '/api/calculator');
    expect(postCall).toBeTruthy();
    const body = JSON.parse((postCall?.[1] as RequestInit).body as string);
    expect(body.usageRights).toBe('midiapaga');
    expect(body.paidMediaDuration).toBe('30d');
    expect(body.repostTikTok).toBe(true);
    expect(body.instagramCollab).toBe(true);
    expect(body.brandSize).toBe('media');
    expect(body.imageRisk).toBe('medio');
    expect(body.strategicGain).toBe('baixo');
    expect(body.contentModel).toBe('publicidade_perfil');
    expect(body.allowStrategicWaiver).toBe(false);
  });
});

test('switching to UGC auto-adjusts complexity to simples, with manual override allowed', async () => {
  setupProUser();

  const fetchMock = jest.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();

    if (url === '/api/mediakit/self/packages' && method === 'GET') {
      return Promise.resolve(jsonResponse({ packages: [] }));
    }

    if (url === '/api/calculator' && method === 'POST') {
      return Promise.resolve(jsonResponse(buildCalculationResponse()));
    }

    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  });

  global.fetch = fetchMock as any;
  render(<CalculatorClient />);

  fireEvent.click(screen.getByRole('button', { name: /Pro Edição avançada/i }));
  fireEvent.click(screen.getByRole('button', { name: /UGC \(whitelabel\)/i }));

  expect(toastMock).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Complexidade ajustada para UGC',
    })
  );

  fireEvent.click(screen.getByRole('button', { name: /Calcular Valor da Publi/i }));

  await waitFor(() => {
    const postCall = fetchMock.mock.calls.find((call) => call[0] === '/api/calculator');
    expect(postCall).toBeTruthy();
    const body = JSON.parse((postCall?.[1] as RequestInit).body as string);
    expect(body.contentModel).toBe('ugc_whitelabel');
    expect(body.complexity).toBe('simples');
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
  expect(track).toHaveBeenCalledWith(
    'calculator_submit_failed',
    expect.objectContaining({ source: 'form_submit', errorCode: 'missing_deliverables' })
  );
  expect(fetchMock).not.toHaveBeenCalledWith('/api/calculator', expect.anything());
});

test('uses numeric card value for package and saves media kit with loading state', async () => {
  setupProUser();

  let resolveSaveRequest: ((value: Response) => void) | null = null;
  const savePromise = new Promise<Response>((resolve) => {
    resolveSaveRequest = resolve;
  });

  const fetchMock = jest.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();

    if (url === '/api/mediakit/self/packages' && method === 'GET') {
      return Promise.resolve(jsonResponse({ packages: [] }));
    }

    if (url === '/api/calculator' && method === 'POST') {
      return Promise.resolve(
        jsonResponse(
          buildCalculationResponse({
            estrategico: 990.45,
            justo: 1234.56,
            premium: 1800.5,
          })
        )
      );
    }

    if (url === '/api/mediakit/self/packages' && method === 'POST') {
      return savePromise;
    }

    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  });

  global.fetch = fetchMock as any;
  render(<CalculatorClient />);

  fireEvent.click(screen.getByRole('button', { name: /Calcular Valor da Publi/i }));
  await screen.findByText('Valor Justo (Sugerido)');

  const addButtons = screen.getAllByRole('button', { name: /Usar como pacote/i });
  fireEvent.click(addButtons[1]);

  const priceInput = screen.getByDisplayValue('1234.56');
  expect(priceInput).toBeInTheDocument();
  fireEvent.change(priceInput, { target: { value: '' } });

  const saveButton = screen.getByRole('button', { name: /Salvar pacotes no Media Kit/i });
  fireEvent.click(saveButton);

  expect(screen.getByRole('button', { name: /Salvando no Media Kit/i })).toBeDisabled();

  await waitFor(() => {
    const saveCall = fetchMock.mock.calls.find(
      (call) => call[0] === '/api/mediakit/self/packages' && (call[1] as RequestInit)?.method === 'POST'
    );
    expect(saveCall).toBeTruthy();
    const body = JSON.parse((saveCall?.[1] as RequestInit).body as string);
    expect(body.packages[0].price).toBe(0);
  });

  resolveSaveRequest?.(jsonResponse({ success: true, count: 1 }));

  await waitFor(() => {
    expect(pushMock).toHaveBeenCalledWith('/media-kit?fromCalc=calc-1');
  });

  expect(track).toHaveBeenCalledWith(
    'calculator_package_added',
    expect.objectContaining({ source: 'suggested_card' })
  );
  expect(track).toHaveBeenCalledWith(
    'calculator_mediakit_save_succeeded',
    expect.objectContaining({ source: 'result_cta' })
  );
});
