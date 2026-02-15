// @jest-environment node

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { connectToDatabase } from '@/app/lib/mongoose';
import AdDeal from '@/app/models/AdDeal';
import PubliCalculation from '@/app/models/PubliCalculation';

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockSave = jest.fn();
jest.mock('@/app/models/AdDeal', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), { find: jest.fn() }),
}));
jest.mock('@/app/models/PubliCalculation', () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));

const mockSession = getServerSession as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;
const mockedAdDeal = AdDeal as unknown as jest.Mock;
const mockedPubliCalculation = PubliCalculation as any;
let postRoute: typeof import('./route').POST;

function buildFindOneChain(value: any, supportsSort = false) {
  const exec = jest.fn().mockResolvedValue(value);
  const lean = jest.fn(() => ({ exec }));
  const sort = jest.fn(() => ({ select, lean, exec }));
  const select = jest.fn(() => (supportsSort ? { sort, lean, exec } : { lean, exec }));
  return { select, sort, lean, exec };
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/ads', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as any);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.isolateModules(() => {
    const routeModule = require('./route');
    postRoute = routeModule.POST;
  });
  mockSession.mockResolvedValue({ user: { id: '507f1f77bcf86cd799439011' } });
  mockConnect.mockResolvedValue(null);
  mockedAdDeal.mockImplementation((payload: any) => ({
    ...payload,
    _id: 'deal-1',
    save: mockSave,
  }));
  mockSave.mockImplementation(async function save(this: any) {
    return { ...this };
  });
});

it('grava vínculo manual quando sourceCalculationId é informado', async () => {
  const manualCalc = {
    _id: '507f191e810c19729de860eb',
    result: { justo: 1500 },
    metrics: { reach: 120000, profileSegment: 'luxo' },
  };
  const manualChain = buildFindOneChain(manualCalc, false);
  mockedPubliCalculation.findOne.mockReturnValueOnce(manualChain);

  const response = await postRoute(
    makeRequest({
      brandName: 'Marca A',
      dealDate: '2026-01-10',
      deliverables: ['1 Reel'],
      compensationType: 'Valor Fixo',
      compensationValue: 1500,
      compensationCurrency: 'BRL',
      sourceCalculationId: '507f191e810c19729de860eb',
    })
  );
  const json = await response.json();

  expect(response.status).toBe(201);
  expect(mockedPubliCalculation.findOne).toHaveBeenCalledWith(
    expect.objectContaining({
      _id: '507f191e810c19729de860eb',
    })
  );
  expect(mockedAdDeal).toHaveBeenCalledWith(
    expect.objectContaining({
      pricingLinkMethod: 'manual',
      pricingLinkConfidence: 1,
      linkedCalculationJusto: 1500,
      linkedCalculationReach: 120000,
      linkedCalculationSegment: 'luxo',
    })
  );
  expect(json.pricingLinkMethod).toBe('manual');
});

it('faz auto-link quando sourceCalculationId não é informado', async () => {
  const autoCalc = {
    _id: '507f191e810c19729de860ef',
    params: { deliveryType: 'conteudo', format: 'reels' },
    result: { justo: 900 },
    metrics: { reach: 80000, profileSegment: 'default' },
  };
  const autoChain = buildFindOneChain(autoCalc, true);
  mockedPubliCalculation.findOne.mockReturnValueOnce(autoChain);

  const response = await postRoute(
    makeRequest({
      brandName: 'Marca B',
      dealDate: '2026-01-11',
      deliverables: ['1 Reel', '3 Stories'],
      compensationType: 'Valor Fixo',
      compensationValue: 900,
      compensationCurrency: 'BRL',
    })
  );
  const json = await response.json();

  expect(response.status).toBe(201);
  expect(mockedAdDeal).toHaveBeenCalledWith(
    expect.objectContaining({
      pricingLinkMethod: 'auto',
      pricingLinkConfidence: 0.7,
      linkedCalculationJusto: 900,
      linkedCalculationReach: 80000,
      linkedCalculationSegment: 'default',
    })
  );
  expect(json.pricingLinkMethod).toBe('auto');
});
