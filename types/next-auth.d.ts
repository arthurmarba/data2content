// types/next-auth.d.ts

import { DefaultSession, DefaultUser } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt"; // Import JWT type for merging
import type { AvailableInstagramAccount } from '@/app/lib/instagramService'; // Importando o tipo que faltava
import type { UserRole, PlanStatus, AgencyPlanType } from '@/types/enums';

/**
 * Aqui estendemos a interface `Session` para incluir campos extras.
 * Esta é a estrutura que o seu frontend (ex: useSession()) receberá.
 */
declare module "next-auth" {
  interface Session {
    user?: {
      id: string; // ID do seu banco de dados (obrigatório)
      name?: string | null;
      email?: string | null;
      image?: string | null;
      provider?: string | null; // Provider usado no login ATUAL ('google', 'facebook')
      role?: UserRole;
      agencyId?: string | null;
      agencyPlanStatus?: PlanStatus | null;
      agencyPlanType?: AgencyPlanType | null;
      planStatus?: PlanStatus;
      planExpiresAt?: string | null; // Mantido como string (ISO) para o cliente
      affiliateCode?: string;
      affiliateBalances?: Record<string, number>;
      affiliateRank?: number;
      affiliateInvites?: number;

      stripeAccountStatus?: 'pending' | 'verified' | 'disabled' | null;
      stripeAccountDefaultCurrency?: string | null;
      payoutsEnabled?: boolean | null;

      // Campos do Instagram que o frontend (InstagramConnectCard) espera:
      instagramConnected?: boolean;
      instagramAccountId?: string | null;
      instagramUsername?: string | null;
      igConnectionError?: string | null; // Erro de conexão do Instagram
      availableIgAccounts?: AvailableInstagramAccount[] | null; // Lista de contas IG disponíveis (se aplicável no fluxo)
      lastInstagramSyncAttempt?: string | null; // Data da última tentativa de sincronização (string ISO)
      lastInstagramSyncSuccess?: boolean | null; // Status da última sincronização

      // Outros campos personalizados que você possa ter
      isNewUserForOnboarding?: boolean;
      onboardingCompletedAt?: string | null; // Mantido como string (ISO) para o cliente

    } & Omit<DefaultSession["user"], "id">; // Omit "id" from DefaultSession["user"] if your "id" is string and DefaultSession's is different or to avoid conflict
  }

  /**
   * Aqui estendemos a interface `User` padrão do NextAuth.
   * Representa o objeto 'user' no DB ou retornado pelo 'profile' callback do provider,
   * e o que é passado para o callback `jwt` no parâmetro `user`.
   */
  interface User extends DefaultUser { // DefaultUser já tem id, name, email, image
    id: string; // Garante que nosso ID (do DB) sobrescreva/seja o principal
    role?: UserRole | null;
    agency?: string | null;
    provider?: string | null; // Provider do primeiro login ou principal
    providerAccountId?: string | null; // ID do provider principal
    facebookProviderAccountId?: string | null; // ID específico do Facebook
    
    isNewUserForOnboarding?: boolean;
    onboardingCompletedAt?: Date | null; // Pode ser Date aqui, pois vem do DB
    
    planStatus?: PlanStatus | null;
    planExpiresAt?: Date | null; // Pode ser Date aqui
    affiliateCode?: string | null;
    affiliateBalances?: Record<string, number>;
    affiliateRank?: number;
    affiliateInvites?: number;

    stripeAccountStatus?: 'pending' | 'verified' | 'disabled' | null;
    stripeAccountDefaultCurrency?: string | null;
    payoutsEnabled?: boolean | null;
    
    // Campos do Instagram como vêm do DB ou são processados antes do JWT
    isInstagramConnected?: boolean | null;
    instagramAccountId?: string | null;
    instagramUsername?: string | null;
    instagramAccessToken?: string | null; // Geralmente não vai para o token/sessão final
    igUserAccessToken?: string | null; // LLAT do usuário IG
    igConnectionError?: string | null; // Adicionado para consistência
    availableIgAccounts?: AvailableInstagramAccount[] | null;
    lastInstagramSyncAttempt?: Date | null; // Date aqui
    lastInstagramSyncSuccess?: boolean | null;
  }
}

/**
 * Aqui estendemos a interface `JWT` para incluir campos extras
 * que serão persistidos no token após o callback `jwt`.
 * O callback `session` usará esses campos para construir o objeto `session.user`.
 */
declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT { // DefaultJWT já tem name, email, picture, sub
    id: string; // ID do usuário do seu DB (obrigatório)
    role?: UserRole | null;
    agencyId?: string | null;
    agencyPlanStatus?: PlanStatus | null;
    agencyPlanType?: AgencyPlanType | null;
    provider?: string | null;
    planStatus?: PlanStatus | null;
    affiliateBalances?: Record<string, number>;
    
    isNewUserForOnboarding?: boolean;
    onboardingCompletedAt?: Date | string | null; // Pode ser Date ou string (após encode)
    
    // Campos do Instagram no token
    isInstagramConnected?: boolean | null;
    instagramAccountId?: string | null;
    instagramUsername?: string | null;
    igConnectionError?: string | null;
    availableIgAccounts?: AvailableInstagramAccount[] | null; // Se você decidir passar isso pelo token
    lastInstagramSyncAttempt?: Date | string | null; // Pode ser Date ou string (após encode)
    lastInstagramSyncSuccess?: boolean | null;

    stripeAccountStatus?: 'pending' | 'verified' | 'disabled' | null;
    stripeAccountDefaultCurrency?: string | null;
    payoutsEnabled?: boolean | null;
    
    // picture pode ser usado por NextAuth, image é mais comum
    image?: string | null;
  }
}
