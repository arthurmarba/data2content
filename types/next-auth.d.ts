// types/next-auth.d.ts

import { DefaultSession, DefaultUser } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt"; // Import JWT type for merging

/**
 * Aqui estendemos a interface `Session` para incluir campos extras.
 */
declare module "next-auth" {
  interface Session {
    user?: {
      id: string; // ID do seu banco de dados (obrigatório)
      provider?: string | null; // Provider usado no login ATUAL ('google', 'facebook')
      role?: string;
      planStatus?: string;
      planExpiresAt?: string | null;
      affiliateCode?: string;
      affiliateBalance?: number;
      affiliateRank?: number;
      affiliateInvites?: number;
      instagramConnected?: boolean;
    } & DefaultSession["user"];
  }

  /**
   * Aqui estendemos a interface `User` padrão do NextAuth.
   * Representa o objeto 'user' no DB ou retornado pelo 'profile'.
   */
  interface User extends DefaultUser {
    id: string; // ID do seu banco de dados (obrigatório)
    role?: string;
    planStatus?: string;
    planExpiresAt?: Date | string | null;
    affiliateCode?: string;
    affiliateBalance?: number;
    affiliateRank?: number;
    affiliateInvites?: number;
    provider?: string; // Provider do primeiro login ou principal
    providerAccountId?: string; // ID do provider principal
    facebookProviderAccountId?: string; // <<< ADICIONADO AQUI >>> ID específico do Facebook
    instagramAccountId?: string;
    instagramAccessToken?: string;
    isInstagramConnected?: boolean;
  }
}

/**
 * Aqui estendemos a interface `JWT` para incluir campos extras
 * que serão persistidos no token após o callback `jwt`.
 */
declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT { // Estende o JWT padrão
    id: string; // ID do usuário do seu DB (obrigatório)
    provider?: string; // Provider do login ATUAL ('google', 'facebook')
    role?: string;
    // Não precisamos de accessToken aqui pois o LLAT é guardado no DB
  }
}
