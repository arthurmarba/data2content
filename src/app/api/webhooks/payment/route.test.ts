/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from './route';
import mercadopago from '@/app/lib/mercadopago';
import AgencyModel from '@/app/models/Agency';

jest.mock('@/app/lib/mercadopago', () => ({
  __esModule: true,
  default: {
    preapproval: { get: jest.fn() },
  },
}));

jest.mock('@/app/models/Agency', () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

jest.mock('@/app/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('POST /api/webhooks/payment (Mercado Pago)', () => {
  const mercadopagoMock = mercadopago as any;
  const agencyModelMock = AgencyModel as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('processes a valid preapproval event', async () => {
    mercadopagoMock.preapproval.get.mockResolvedValue({
      body: { external_reference: 'agency1', status: 'authorized' },
    });

    const agency = { _id: 'agency1', planStatus: 'inactive', paymentGatewaySubscriptionId: '', save: jest.fn() };
    agencyModelMock.findById.mockResolvedValue(agency);

    const req = new NextRequest('http://localhost/api/webhooks/payment', {
      method: 'POST',
      body: JSON.stringify({ type: 'preapproval', data: { id: 'pre1' } }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ received: true });
    expect(agency.planStatus).toBe('active');
    expect(agency.paymentGatewaySubscriptionId).toBe('pre1');
    expect(agency.save).toHaveBeenCalled();
  });

  it('ignores preapproval events without id', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/payment', {
      method: 'POST',
      body: JSON.stringify({ type: 'preapproval', data: {} }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mercadopagoMock.preapproval.get).not.toHaveBeenCalled();
    expect(agencyModelMock.findById).not.toHaveBeenCalled();
  });

  it('ignores unrelated event types', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/payment', {
      method: 'POST',
      body: JSON.stringify({ type: 'unknown' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mercadopagoMock.preapproval.get).not.toHaveBeenCalled();
    expect(agencyModelMock.findById).not.toHaveBeenCalled();
  });
});

