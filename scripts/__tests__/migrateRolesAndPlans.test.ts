/** @jest-environment node */

import { USER_ROLES, PLAN_STATUSES } from '@/types/enums';

const userUpdateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });
const agencyUpdateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });

jest.mock('@/app/lib/mongoose', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(null),
}));

jest.mock('mongoose', () => ({
  disconnect: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/models/User', () => ({
  __esModule: true,
  default: { updateMany: userUpdateMany },
}));

jest.mock('@/app/models/Agency', () => ({
  __esModule: true,
  default: { updateMany: agencyUpdateMany },
}));

describe('migrateRolesAndPlans script', () => {
  beforeAll(async () => {
    await import('../migrateRolesAndPlans');
  });

  it('updates users with invalid role and planStatus to default enums', () => {
    expect(userUpdateMany).toHaveBeenNthCalledWith(
      1,
      { role: { $nin: USER_ROLES as any } },
      { $set: { role: 'user' } }
    );
    expect(userUpdateMany).toHaveBeenNthCalledWith(
      2,
      { planStatus: { $nin: PLAN_STATUSES as any } },
      { $set: { planStatus: 'inactive' } }
    );
  });

  it('updates agencies with invalid planStatus to default enum', () => {
    expect(agencyUpdateMany).toHaveBeenCalledWith(
      { planStatus: { $nin: PLAN_STATUSES as any } },
      { $set: { planStatus: 'inactive' } }
    );
  });
});
