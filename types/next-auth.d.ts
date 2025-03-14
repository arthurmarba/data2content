// types/next-auth.d.ts
import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  /**
   * Aqui extendemos a interface `Session` para incluir
   * campos extras no `session.user`.
   */
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
   * Aqui extendemos a interface `User` para incluir
   * campos extras que serão salvos no banco de dados (ou retornados pelo provider).
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

declare module "next-auth/jwt" {
  /**
   * Aqui extendemos a interface `JWT` para incluir
   * campos extras que serão persistidos no token.
   */
  interface JWT {
    sub?: string;
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
