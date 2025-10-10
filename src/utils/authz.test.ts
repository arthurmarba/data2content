import { evaluateUserAccess, isAdminUser } from './authz';

describe('authz helpers', () => {
  describe('isAdminUser', () => {
    it('detects admin role irrespective of casing', () => {
      expect(isAdminUser({ id: '1', role: 'admin' })).toBe(true);
      expect(isAdminUser({ id: '1', role: 'ADMIN' })).toBe(true);
      expect(isAdminUser({ id: '1', role: 'user' })).toBe(false);
      expect(isAdminUser(undefined)).toBe(false);
    });
  });

  describe('evaluateUserAccess', () => {
    it('denies when user is not authenticated', () => {
      const res = evaluateUserAccess(undefined, '123');
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('unauthenticated');
    });

    it('allows self-access when target is omitted', () => {
      const res = evaluateUserAccess({ id: 'abc', role: 'user' }, undefined);
      expect(res.allowed).toBe(true);
      expect(res.actorId).toBe('abc');
      expect(res.targetUserId).toBe('abc');
    });

    it('allows self-access when target equals actor', () => {
      const res = evaluateUserAccess({ id: 'abc', role: 'user' }, 'abc');
      expect(res.allowed).toBe(true);
      expect(res.targetUserId).toBe('abc');
    });

    it('denies non-admin trying to access another user', () => {
      const res = evaluateUserAccess({ id: 'actor', role: 'user' }, 'target');
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('forbidden');
    });

    it('allows admin to access another user', () => {
      const res = evaluateUserAccess({ id: 'adminId', role: 'admin' }, 'targetId');
      expect(res.allowed).toBe(true);
      expect(res.isAdmin).toBe(true);
      expect(res.targetUserId).toBe('targetId');
    });
  });
});
