import AgencyModel from '@/app/models/Agency';
import UserModel from '@/app/models/User';

describe('Model enums', () => {
  it('rejects invalid user role', () => {
    const user = new UserModel({ email: 'a@b.com', role: 'invalid', planStatus: 'active' } as any);
    const err = user.validateSync();
    expect(err?.errors?.role).toBeDefined();
  });

  it('rejects invalid user planStatus', () => {
    const user = new UserModel({ email: 'a@b.com', role: 'user', planStatus: 'foo' } as any);
    const err = user.validateSync();
    expect(err?.errors?.planStatus).toBeDefined();
  });

  it('rejects invalid agency planStatus', () => {
    const agency = new AgencyModel({ name: 'Agency', inviteCode: 'code', planStatus: 'foo' } as any);
    const err = agency.validateSync();
    expect(err?.errors?.planStatus).toBeDefined();
  });

  it('accepts valid enums', () => {
    const user = new UserModel({ email: 'a@b.com', role: 'guest', planStatus: 'pending' } as any);
    const errUser = user.validateSync();
    expect(errUser).toBeUndefined();
    const agency = new AgencyModel({ name: 'Agency', inviteCode: 'code', planStatus: 'active' } as any);
    const errAgency = agency.validateSync();
    expect(errAgency).toBeUndefined();
  });
});
