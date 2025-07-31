export const USER_ROLES = ['user', 'guest', 'agency', 'admin'] as const;
export type UserRole = typeof USER_ROLES[number];

export const PLAN_STATUSES = ['active', 'pending', 'canceled', 'inactive', 'trial'] as const;
export type PlanStatus = typeof PLAN_STATUSES[number];
