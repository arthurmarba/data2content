/** @jest-environment node */
import { NextRequest } from 'next/server';
import mongoose from 'mongoose';

import { POST } from './route';
import BrandProposal from '@/app/models/BrandProposal';
import { sendProposalReplyEmail } from '@/app/lib/emailService';
import { ensurePlannerAccess } from '@/app/lib/planGuard';
import { connectToDatabase } from '@/app/lib/mongoose';

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/BrandProposal', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    updateOne: jest.fn(),
  },
}));
jest.mock('@/app/lib/emailService', () => ({
  sendProposalReplyEmail: jest.fn(),
}));
jest.mock('@/app/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));
jest.mock('@/app/lib/planGuard', () => ({
  ensurePlannerAccess: jest.fn(),
}));

const getServerSession = require('next-auth/next').getServerSession as jest.Mock;
const brandProposalModel = BrandProposal as any;
const sendEmailMock = sendProposalReplyEmail as jest.Mock;
const ensureAccessMock = ensurePlannerAccess as jest.Mock;
const connectDbMock = connectToDatabase as jest.Mock;

const PROPOSAL_ID = new mongoose.Types.ObjectId().toString();

function createRequest(body: any) {
  return new NextRequest(`http://localhost/api/proposals/${PROPOSAL_ID}/reply`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const baseProposal = {
  _id: new mongoose.Types.ObjectId(PROPOSAL_ID),
  userId: 'user-123',
  brandName: 'Acme',
  contactEmail: 'brand@example.com',
  contactWhatsapp: '+5511999999999',
  campaignTitle: 'Teste campanha',
  campaignDescription: 'desc',
  deliverables: ['Reel'],
  referenceLinks: [],
  budget: 2000,
  currency: 'BRL',
  status: 'visto',
  originIp: '127.0.0.1',
  userAgent: 'jest',
  mediaKitSlug: 'creator-kit',
  createdAt: new Date('2024-05-20T12:00:00Z'),
  updatedAt: new Date('2024-05-21T12:00:00Z'),
  lastResponseAt: null,
  lastResponseMessage: null,
};

function mockFindByIdOnce(payload: any) {
  return {
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(payload),
  };
}

describe('POST /api/proposals/[id]/reply', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();

    process.env.NEXT_PUBLIC_APP_URL = 'https://app.data2content.ai';

    getServerSession.mockResolvedValue({
      user: { id: 'user-123', name: 'Creator Name', instagramUsername: 'creator.handle' },
    });
    ensureAccessMock.mockResolvedValue({ ok: true, normalizedStatus: 'active', source: 'session' });
    connectDbMock.mockResolvedValue(undefined);
  });

  it('bloqueia acesso sem sessão', async () => {
    getServerSession.mockResolvedValueOnce(null);

    const res = await POST(createRequest({ emailText: 'Oi' }), { params: { id: PROPOSAL_ID } });

    expect(res.status).toBe(401);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('valida presença de texto da resposta', async () => {
    brandProposalModel.findById.mockReturnValue(mockFindByIdOnce(baseProposal));

    const res = await POST(createRequest({ emailText: '   ' }), { params: { id: PROPOSAL_ID } });

    expect(res.status).toBe(422);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('envia email e retorna proposta atualizada', async () => {
    const now = new Date('2024-06-01T12:00:00Z');
    jest.useFakeTimers().setSystemTime(now);

    brandProposalModel.findById
      .mockReturnValueOnce(mockFindByIdOnce(baseProposal))
      .mockReturnValueOnce(
        mockFindByIdOnce({
          ...baseProposal,
          status: 'respondido',
          lastResponseAt: now,
          lastResponseMessage: 'Oi, podemos seguir',
        })
      );

    brandProposalModel.updateOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });

    const res = await POST(createRequest({ emailText: 'Oi, podemos seguir' }), {
      params: { id: PROPOSAL_ID },
    });

    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledWith(
      'brand@example.com',
      expect.objectContaining({
        creatorName: 'Creator Name',
        creatorHandle: 'creator.handle',
        brandName: baseProposal.brandName,
        campaignTitle: baseProposal.campaignTitle,
        emailBody: 'Oi, podemos seguir',
        budgetText: 'R$ 2.000,00',
        deliverables: baseProposal.deliverables,
        receivedAt: baseProposal.createdAt,
        mediaKitUrl: 'https://app.data2content.ai/mediakit/creator-kit',
      })
    );

    expect(brandProposalModel.updateOne).toHaveBeenCalledWith(
      { _id: baseProposal._id },
      {
        $set: {
          status: 'respondido',
          lastResponseAt: now,
          lastResponseMessage: 'Oi, podemos seguir',
        },
      }
    );

    expect(payload.proposal.status).toBe('respondido');
    expect(payload.proposal.lastResponseMessage).toBe('Oi, podemos seguir');
    expect(payload.proposal.lastResponseAt).toBe(now.toISOString());
  });
});
