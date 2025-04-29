// types/next-auth.d.ts

import { DefaultSession, DefaultUser } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt"; // Import JWT type for merging

/**
 * Aqui estendemos a interface `Session` para incluir campos extras.
 */
declare module "next-auth" {
  interface Session {
    // REMOVIDO: provider?: string; // Provider não pertence à raiz da Session

    // Torna o user opcional para permitir 'limpar' a sessão em caso de erro
    user?: {
      // Adiciona campos ao objeto 'user' dentro da Session
      id: string; // ID do seu banco de dados (obrigatório)
      provider?: string | null; // <<< ADICIONADO AQUI: Provider usado no login ('google', 'facebook')
      role?: string;
      planStatus?: string;
      planExpiresAt?: string | null; // Convertido para string ISO no callback session
      affiliateCode?: string;
      affiliateBalance?: number;
      affiliateRank?: number;
      affiliateInvites?: number;
      instagramConnected?: boolean;
      // Adicione outros campos do seu IUser que você passa no callback session
    } & DefaultSession["user"]; // Mantém os campos padrão (name, email, image)
  }

  /**
   * Aqui estendemos a interface `User` padrão do NextAuth.
   */
  interface User extends DefaultUser {
    id: string; // ID do seu banco de dados (obrigatório)
    // Seus campos extras que vêm do DB ou são definidos no profile/authorize
    role?: string;
    planStatus?: string;
    planExpiresAt?: Date | string | null;
    affiliateCode?: string;
    affiliateBalance?: number;
    affiliateRank?: number;
    affiliateInvites?: number;
    provider?: string; // Mantido para consistência
    providerAccountId?: string; // Mantido para consistência
    instagramAccountId?: string; // Mantido para consistência
    instagramAccessToken?: string; // Mantido para consistência
  }
}

/**
 * Aqui estendemos a interface `JWT` para incluir campos extras
 * que serão persistidos no token após o callback `jwt`.
 */
declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT { // Estende o JWT padrão
    // Campos que você adiciona no callback jwt
    id: string; // ID do usuário do seu DB (obrigatório)
    accessToken?: string; // Token de acesso do provider (ex: Facebook, Google) - Usado temporariamente
    provider?: string; // Mantido: Provider usado ('google', 'facebook')
    role?: string;
    // Removidos campos redundantes que são buscados do DB no callback session
    // planStatus?: string;
    // planExpiresAt?: string | null;
    // affiliateCode?: string;
    // affiliateBalance?: number;
    // affiliateRank?: number;
    // affiliateInvites?: number;
    // lastSync?: number; // Removido se não estiver sendo usado no callback jwt
  }
}
