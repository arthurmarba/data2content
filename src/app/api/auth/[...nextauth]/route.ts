// src/app/api/auth/[...nextauth]/route.ts

import NextAuth from "next-auth/next";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

// Interface para os parâmetros do callback signIn
interface SignInParams {
  user: {
    email?: string | null;
    name?: string | null;
    id?: string;
    image?: string | null;
  };
  account: {
    provider?: string;
    providerAccountId?: string;
  } | null;
}

// Interface para os parâmetros do callback jwt
interface JwtParams {
  token: {
    sub?: string;
    picture?: string;
    [key: string]: unknown;
  };
  user?: {
    id?: string;
    image?: string;
    [key: string]: unknown;
  };
}

// Interface para os parâmetros do callback session
interface SessionParams {
  session: {
    user: { // Agora obrigatório e com os campos exigidos
      name: string | null;
      email: string | null;
      image: string | null;
      id?: string;
      role?: string;
      planStatus?: string;
      planExpiresAt?: string | null;
      affiliateCode?: string;
      affiliateBalance?: number;
      affiliateRank?: number;
      affiliateInvites?: number;
    };
    [key: string]: unknown;
  };
  token: {
    sub?: string;
    picture?: string;
    [key: string]: unknown;
  };
  user: unknown; // Substituído de "any" para "unknown"
  newSession: unknown; // Substituído de "any" para "unknown"
  trigger: "update";
}

// Interface para os parâmetros do callback redirect
interface RedirectParams {
  baseUrl: string;
  url: string;
}

const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    }),
    CredentialsProvider({
      name: "Demo",
      credentials: {
        username: { label: "Usuário", type: "text", placeholder: "demo" },
        password: { label: "Senha", type: "password", placeholder: "demo" },
      },
      async authorize(credentials) {
        if (credentials?.username === "demo" && credentials?.password === "demo") {
          return {
            id: "demo-123",
            name: "Demo User",
            email: "demo@example.com",
          };
        }
        return null;
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }: SignInParams): Promise<boolean> {
      if (account?.provider === "google") {
        await connectToDatabase();
        const existingUser = await User.findOne({ email: user.email });
        if (!existingUser) {
          const created = await User.create({
            name: user.name,
            email: user.email,
            googleId: account.providerAccountId,
            role: "user",
          });
          user.id = created._id.toString();
        } else {
          user.id = existingUser._id.toString();
        }
      }
      return true;
    },

    async jwt({ token, user }: JwtParams) {
      if (user) {
        token.sub = user.id;
        if (user.image) {
          token.picture = user.image;
        }
      }
      return token;
    },

    async session({ session, token }: SessionParams) {
      if (!token.sub) return session;

      await connectToDatabase();
      const dbUser = await User.findById(token.sub);

      // Garante que session.user esteja definido com os campos obrigatórios
      if (!session.user) {
        session.user = { name: null, email: null, image: null };
      }
      const typedUser = session.user as {
        id?: string;
        role?: string;
        planStatus?: string;
        planExpiresAt?: string | null;
        affiliateCode?: string;
        affiliateBalance?: number;
        affiliateRank?: number;
        affiliateInvites?: number;
        name: string | null;
        email: string | null;
        image: string | null;
      };

      if (dbUser) {
        typedUser.id = dbUser._id.toString();
        typedUser.role = dbUser.role;
        typedUser.planStatus = dbUser.planStatus;
        typedUser.planExpiresAt = dbUser.planExpiresAt;
        typedUser.affiliateCode = dbUser.affiliateCode;
        typedUser.affiliateBalance = dbUser.affiliateBalance;
        typedUser.affiliateRank = dbUser.affiliateRank;
        typedUser.affiliateInvites = dbUser.affiliateInvites;
      }

      if (token.picture && session.user) {
        typedUser.image = token.picture as string;
      }

      return session;
    },

    async redirect({ baseUrl }: RedirectParams): Promise<string> {
      return baseUrl + "/dashboard";
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
