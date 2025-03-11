import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role?: string
      planStatus?: string
      planExpiresAt?: string | null
      affiliateCode?: string
      affiliateBalance?: number
      affiliateRank?: number
      affiliateInvites?: number
    }
  }

  interface User {
    id: string
    role?: string
    planStatus?: string
    planExpiresAt?: string | null
    affiliateCode?: string
    affiliateBalance?: number
    affiliateRank?: number
    affiliateInvites?: number
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role?: string
    planStatus?: string
    planExpiresAt?: string | null
    affiliateCode?: string
    affiliateBalance?: number
    affiliateRank?: number
    affiliateInvites?: number
    lastSync?: number
  }
}