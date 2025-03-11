import "next-auth";
import { DefaultSession } from "next-auth";

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
      affiliateRank?: number;
      affiliateInvites?: number;
    };
  }

  interface User {
    id: string;
    role?: string;
    planStatus?: string;
    planExpiresAt?: string | null;
    affiliateCode?: string;
    affiliateBalance?: number;
    affiliateRank?: number;
    affiliateInvites?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: string;
    planStatus?: string;
    planExpiresAt?: string | null;
    affiliateCode?: string;
    affiliateBalance?: number;
    affiliateRank?: number;
    affiliateInvites?: number;
    lastSync?: number;
  }
}
