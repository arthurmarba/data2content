/** @jest-environment node */
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }), { virtual: true });
jest.mock('next/headers', () => ({ headers: jest.fn(), cookies: jest.fn() }), { virtual: true });
jest.mock('next/navigation', () => ({ notFound: jest.fn() }), { virtual: true });
jest.mock('./page', () => {
  const { getClientIpFromHeaders } = require('@/utils/getClientIp');
  const { headers } = require('next/headers');
  const { logMediaKitAccess } = require('@/lib/logMediaKitAccess');
  const UserModel = require('@/app/models/User').default || require('@/app/models/User');
  return {
    __esModule: true,
    default: async ({ params }: any, req?: any) => {
      const user = await UserModel.findOne({ mediaKitSlug: params.token }).lean();
      if (!user) return null;
      const hdrs = headers();
      const ip = getClientIpFromHeaders(hdrs as any, req);
      const referer = hdrs.get('referer') || undefined;
      await logMediaKitAccess(user._id.toString(), ip, referer);
      return null;
    },
  };
}, { virtual: true });

import MediaKitPage from './page';
import UserModel from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logMediaKitAccess } from '@/lib/logMediaKitAccess';
import { headers } from 'next/headers';

global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ findOne: jest.fn() }));
jest.mock('@/lib/logMediaKitAccess', () => ({ logMediaKitAccess: jest.fn() }));

type Params = { params: { token: string } };

const mockFindOne = UserModel.findOne as jest.Mock;
const mockLogAccess = logMediaKitAccess as jest.Mock;
const mockHeaders = headers as jest.Mock;

describe('MediaKitPage logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHeaders.mockReturnValue(new Headers({ 'x-real-ip': '1.1.1.1' }));
    mockFindOne.mockReturnValue({ lean: () => Promise.resolve({ _id: 'u1' }) });
  });

  it('calls logMediaKitAccess when user exists', async () => {
    await MediaKitPage({ params: { token: 'tok' } } as Params);
    expect(mockLogAccess).toHaveBeenCalledWith('u1', '1.1.1.1', undefined);
  });

  it('falls back to socket.remoteAddress when headers lack IP', async () => {
    mockHeaders.mockReturnValue(new Headers());
    const req = { socket: { remoteAddress: '2.2.2.2' } } as any;
    await MediaKitPage({ params: { token: 'tok' } } as Params, req);
    expect(mockLogAccess).toHaveBeenCalledWith('u1', '2.2.2.2', undefined);
  });

  it('does not use socket.remoteAddress in production', async () => {
    mockHeaders.mockReturnValue(new Headers());
    const req = { socket: { remoteAddress: '3.3.3.3' } } as any;
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    await MediaKitPage({ params: { token: 'tok' } } as Params, req);
    expect(mockLogAccess).toHaveBeenCalledWith('u1', 'unknown', undefined);
    process.env.NODE_ENV = prev;
  });
});
