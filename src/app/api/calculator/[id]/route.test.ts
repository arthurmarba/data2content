// @jest-environment node

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { connectToDatabase } from '@/app/lib/mongoose';
import PubliCalculation from '@/app/models/PubliCalculation';
import { logUsageEvent } from '@/app/lib/dataService/usageEventService';

jest.mock('next-auth/next', () => ({
  __esModule: true,
  default: jest.fn(() => jest.fn()),
  getServerSession: jest.fn(),
}));
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/PubliCalculation', () => ({
  __esModule: true,
  default: { findOneAndUpdate: jest.fn() },
}));
jest.mock('@/app/lib/dataService/usageEventService', () => ({ logUsageEvent: jest.fn() }));
jest.mock('@/app/lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const calculationId = '507f191e810c19729de860eb';
let patchRoute: typeof import('./route').PATCH;

function request(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/calculator/${calculationId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/calculator/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.isolateModules(() => {
      patchRoute = require('./route').PATCH;
    });
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: '507f1f77bcf86cd799439011' } });
    (connectToDatabase as jest.Mock).mockResolvedValue(undefined);
  });

  it('persists price perception for the calculation owner', async () => {
    const calculation = {
      _id: calculationId,
      userId: '507f1f77bcf86cd799439011',
      result: { estrategico: 350, justo: 600, premium: 800 },
      cpmApplied: 30,
      params: {
        format: 'reels',
        exclusivity: 'nenhuma',
        usageRights: 'organico',
        complexity: 'simples',
        authority: 'padrao',
      },
      metrics: { reach: 10_000 },
      pricing: { version: 'v2.0.0' },
      pricingFeedback: { perception: 'fair', intendedAsk: 650, submittedAt: new Date() },
    };
    const exec = jest.fn().mockResolvedValue(calculation);
    const lean = jest.fn(() => ({ exec }));
    (PubliCalculation.findOneAndUpdate as jest.Mock).mockReturnValue({ lean });

    const response = await patchRoute(request({ perception: 'fair', intendedAsk: 650 }), {
      params: { id: calculationId },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(PubliCalculation.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: calculationId, userId: '507f1f77bcf86cd799439011' },
      expect.objectContaining({
        $set: expect.objectContaining({
          pricingFeedback: expect.objectContaining({ perception: 'fair', intendedAsk: 650 }),
        }),
      }),
      { new: true }
    );
    expect(payload.pricingFeedback).toMatchObject({ perception: 'fair', intendedAsk: 650 });
    expect(logUsageEvent).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'publi_price_perception_submitted',
      'publi',
      expect.objectContaining({ perception: 'fair', pricingVersion: 'v2.0.0' })
    );
  });

  it('rejects invalid perception before writing', async () => {
    const response = await patchRoute(request({ perception: 'maybe' }), { params: { id: calculationId } });
    expect(response.status).toBe(400);
    expect(PubliCalculation.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
