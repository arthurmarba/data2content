// types/next-auth.d.ts

import { DefaultSession, DefaultUser } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";
import type { AvailableInstagramAccount } from '@/app/lib/instagramService';
import type { UserRole, PlanStatus, AgencyPlanType } from '@/types/enums';
import type { ProTrialState } from '@/types/billing';

/**
 * Estende a interface Session com campos extras que o frontend consome.
 */
declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      provider?: string | null;
      role?: UserRole;

      // Agency
      agencyId?: string | null;
      agencyPlanStatus?: PlanStatus | "non_renewing" | null;
      agencyPlanType?: AgencyPlanType | null;

      // Billing (PESSOAL)
      planStatus?: PlanStatus | "non_renewing" | null;
      planInterval?: "month" | "year" | null;
      planExpiresAt?: string | null; // manter ISO no cliente
      cancelAtPeriodEnd?: boolean;
      stripeCustomerId?: string | null;
      stripeSubscriptionId?: string | null;
      stripePriceId?: string | null;
      proTrialStatus?: ProTrialState | null;
      proTrialActivatedAt?: string | null;
      proTrialExpiresAt?: string | null;

      // Afiliados
      affiliateCode?: string;
      affiliateBalances?: Record<string, number>;
      affiliateRank?: number;
      affiliateInvites?: number;

      // Stripe Connect (payouts)
      stripeAccountStatus?: 'pending' | 'verified' | 'disabled' | null;
      stripeAccountDefaultCurrency?: string | null;
      payoutsEnabled?: boolean | null;

      // Instagram (UI)
      instagramConnected?: boolean;
      instagramAccountId?: string | null;
      instagramUsername?: string | null;
      igConnectionError?: string | null;
      availableIgAccounts?: AvailableInstagramAccount[] | null;
      lastInstagramSyncAttempt?: string | null;
      lastInstagramSyncSuccess?: boolean | null;

      // Onboarding
      isNewUserForOnboarding?: boolean;
      onboardingCompletedAt?: string | null;

    } & Omit<DefaultSession["user"], "id">;
  }

  /**
   * Estende o User do NextAuth (lado servidor/DB → JWT callback).
   */
  interface User extends DefaultUser {
    id: string;
    role?: UserRole | null;
    agency?: string | null;
    provider?: string | null;
    providerAccountId?: string | null;
    facebookProviderAccountId?: string | null;

    isNewUserForOnboarding?: boolean;
    onboardingCompletedAt?: Date | null;

    // Billing
    planStatus?: PlanStatus | "non_renewing" | null;
    planInterval?: "month" | "year" | null;
    planExpiresAt?: Date | null;
    cancelAtPeriodEnd?: boolean;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    proTrialStatus?: ProTrialState | null;
    proTrialActivatedAt?: Date | null;
    proTrialExpiresAt?: Date | null;

    // Afiliados
    affiliateCode?: string | null;
    affiliateBalances?: Record<string, number>;
    affiliateRank?: number;
    affiliateInvites?: number;

    // Stripe Connect (payouts)
    stripeAccountStatus?: 'pending' | 'verified' | 'disabled' | null;
    stripeAccountDefaultCurrency?: string | null;
    payoutsEnabled?: boolean | null;

    // Instagram
    isInstagramConnected?: boolean | null;
    instagramAccountId?: string | null;
    instagramUsername?: string | null;
    instagramAccessToken?: string | null;
    igUserAccessToken?: string | null;
    igConnectionError?: string | null;
    availableIgAccounts?: AvailableInstagramAccount[] | null;
    lastInstagramSyncAttempt?: Date | null;
    lastInstagramSyncSuccess?: boolean | null;
  }
}

/**
 * Estende o JWT com os mesmos campos que precisamos carregar na sessão.
 */
declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role?: UserRole | null;

    // Agency
    agencyId?: string | null;
    agencyPlanStatus?: PlanStatus | "non_renewing" | null;
    agencyPlanType?: AgencyPlanType | null;

    provider?: string | null;

    // Billing
    planStatus?: PlanStatus | "non_renewing" | null;
    planInterval?: "month" | "year" | null;
    planExpiresAt?: Date | string | null;
    cancelAtPeriodEnd?: boolean;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    proTrialStatus?: ProTrialState | null;
    proTrialActivatedAt?: Date | string | null;
    proTrialExpiresAt?: Date | string | null;

    // Afiliados
    affiliateBalances?: Record<string, number>;

    // Onboarding
    isNewUserForOnboarding?: boolean;
    onboardingCompletedAt?: Date | string | null;

    // Instagram
    isInstagramConnected?: boolean | null;
    instagramAccountId?: string | null;
    instagramUsername?: string | null;
    igConnectionError?: string | null;
    availableIgAccounts?: AvailableInstagramAccount[] | null;
    lastInstagramSyncAttempt?: Date | string | null;
    lastInstagramSyncSuccess?: boolean | null;

    // Stripe Connect (payouts)
    stripeAccountStatus?: 'pending' | 'verified' | 'disabled' | null;
    stripeAccountDefaultCurrency?: string | null;
    payoutsEnabled?: boolean | null;

    image?: string | null;
  }
}
