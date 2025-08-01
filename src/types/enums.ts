// src/types/enums.ts

export const USER_ROLES = ['user', 'guest', 'agency', 'admin'] as const;
export type UserRole = typeof USER_ROLES[number];

// CORREÇÃO: Adicionado 'expired' para corresponder aos status usados no aplicativo.
export const PLAN_STATUSES = ['active', 'pending', 'canceled', 'inactive', 'trial', 'expired'] as const;
export type PlanStatus = typeof PLAN_STATUSES[number];

export const PLAN_TYPES = ['monthly', 'annual'] as const;
export type PlanType = typeof PLAN_TYPES[number];

export const AGENCY_PLAN_TYPES = ['basic', 'annual'] as const;
export type AgencyPlanType = typeof AGENCY_PLAN_TYPES[number];
