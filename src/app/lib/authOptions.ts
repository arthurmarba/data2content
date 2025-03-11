import { Session } from "next-auth";
import NextAuth from "next-auth/next"; // Atualizado para o caminho correto
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";
import { Model, Types } from "mongoose";

import { connectToDatabase } from "@/app/lib/mongoose";
// Importa o modelo e a interface do usuário
import DbUser, { IUser } from "@/app/models/User";

// Atualize a interface BaseUser para permitir undefined
interface BaseUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

// Define a interface para o objeto account, permitindo null
interface CustomAccount {
  provider: string;
  providerAccountId: string;
  // Adicione outras propriedades, se necessário
}

export const authOptions = {
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
    async signIn({
      user,
      account,
    }: {
      user: BaseUser;
      account: CustomAccount | null;
    }) {
      if (account?.provider === "google") {
        await connectToDatabase();
        const existingUser = await (DbUser as Model<IUser>).findOne({ email: user.email });
        if (!existingUser) {
          const created = new DbUser({
            name: user.name,
            email: user.email,
            googleId: account.providerAccountId,
            role: "user",
          });
          await created.save();
          user.id = (created._id as Types.ObjectId).toString();
        } else {
          user.id = (existingUser._id as Types.ObjectId).toString();
        }
      }
      return true;
    },

    async jwt({ token, user }: { token: JWT; user?: IUser | null }) {
      if (user) {
        token.sub = user.id;
        if (user.image) {
          token.picture = user.image;
        }
      }
      return token;
    },

    async session(
      params: {
        session: Session;
        token: JWT;
        newSession: unknown;
        trigger: "update";
        user: unknown;
      }
    ): Promise<Session> {
      const { session, token } = params;
      // Garante que session.user exista com os campos mínimos exigidos
      session.user = {
        id: token.sub as string,
        name: session.user?.name ?? null,
        email: session.user?.email ?? null,
        image: session.user?.image ?? null,
        // Campos customizados (inicializados com undefined ou null)
        role: undefined,
        planStatus: undefined,
        planExpiresAt: undefined,
        affiliateCode: undefined,
        affiliateBalance: undefined,
        affiliateRank: undefined,
        affiliateInvites: undefined,
      };

      await connectToDatabase();
      const dbUser = await DbUser.findById(token.sub);
      if (dbUser) {
        session.user.role = dbUser.role;
        session.user.planStatus = dbUser.planStatus;
        session.user.planExpiresAt = dbUser.planExpiresAt
          ? dbUser.planExpiresAt.toISOString()
          : null;
        session.user.affiliateCode = dbUser.affiliateCode;
        session.user.affiliateBalance = dbUser.affiliateBalance;
        session.user.affiliateRank = dbUser.affiliateRank;
        session.user.affiliateInvites = dbUser.affiliateInvites;
      }

      if (token.picture) {
        session.user.image = token.picture as string;
      }
      return session;
    },

    async redirect({ baseUrl }: { baseUrl: string }) {
      return baseUrl + "/dashboard";
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
