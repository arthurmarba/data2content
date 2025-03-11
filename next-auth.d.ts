import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      planStatus?: string;
      planExpiresAt?: string | Date;
      affiliateCode?: string;
      affiliateBalance?: number;
      affiliateRank?: string;
      affiliateInvites?: number;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    picture?: string;
  }
}
