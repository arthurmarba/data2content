/** @jest-environment node */

jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ countDocuments: jest.fn() }));

import User from '@/app/models/User';
import { GET } from './route';

describe('GET /api/internal/affiliate/health', () => {
  it('returns unhealthy while commissions are overdue', async () => {
    (User as any).countDocuments.mockResolvedValue(2);

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false, pendingDueUsers: 2 });
  });

  it('returns healthy without overdue commissions', async () => {
    (User as any).countDocuments.mockResolvedValue(0);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, pendingDueUsers: 0 });
  });
});
