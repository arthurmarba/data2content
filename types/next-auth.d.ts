// types/next-auth.d.ts
import { DefaultSession, DefaultUser } from "next-auth";

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
