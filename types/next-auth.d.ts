// types/next-auth.d.ts

import { DefaultSession, DefaultUser } from "next-auth";

/**
 * Aqui estendemos a interface `Session` para incluir campos extras no `session.user`.
 */
declare module "next-auth" {
  interface Session {
    user: {
      /** Aqui o 'id' é obrigatório */
      id: string;
    } & DefaultSession["user"] & {
      /** Campos extras opcionais */
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
    /** O 'id' você definiu como obrigatório, mas 'email', 'name', e 'image' seguem opcionais */
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;

    /** Seus campos extras */
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
