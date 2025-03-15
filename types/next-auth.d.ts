// types/next-auth.d.ts

import { DefaultSession, DefaultUser } from "next-auth";
import { JWT } from "next-auth/jwt";

/**
 * Aqui estendemos a interface `Session` para incluir campos extras no `session.user`.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"] & {
      role?: string;
      planStatus?: string;
      planExpiresAt?: string | null;
      affiliateCode?: string;
      affiliateBalance?: number;
      affiliateRank?: string | number;
      affiliateInvites?: number;
    };
  }

  /**
   * Aqui estendemos a interface `User` para incluir campos extras
   * que serão salvos no banco de dados (ou retornados pelo provider).
   */
  interface User extends DefaultUser {
    id: string;
    role?: string;
    planStatus?: string;
    planExpiresAt?: Date | string | null;
    affiliateCode?: string;
    affiliateBalance?: number;
    affiliateRank?: string | number;
    affiliateInvites?: number;
  }
}

/**
 * Aqui estendemos a interface `JWT` para incluir campos extras
 * que serão persistidos no token.
 */
declare module "next-auth/jwt" {
  interface JWT {
    sub?: string; // Normalmente, a sub é a id do usuário
    id?: string;
    role?: string;
    planStatus?: string;
    planExpiresAt?: string | null;
    affiliateCode?: string;
    affiliateBalance?: number;
    affiliateRank?: string | number;
    affiliateInvites?: number;
    lastSync?: number;
    picture?: string;
  }
}
