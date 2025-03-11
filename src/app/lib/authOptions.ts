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
      // Cria um objeto fullSession que garante que session.user esteja definido com os campos mínimos
      const fullSession = {
        ...session,
        user: {
          id: token.sub as string, // Campo obrigatório
          name: session.user?.name ?? null,
          email: session.user?.email ?? null,
          image: token.picture ? (token.picture as string) : (session.user?.image ?? null),
          // Campos customizados com tipos adequados
          role: undefined as string | undefined,
          planStatus: undefined as string | undefined,
          planExpiresAt: null as string | null, // Alterado para null em vez de undefined
          affiliateCode: undefined as string | undefined,
          affiliateBalance: undefined as number | undefined,
          affiliateRank: undefined as string | undefined,
          affiliateInvites: undefined as number | undefined,
        },
      };

      await connectToDatabase();
      const dbUser = await DbUser.findById(token.sub);
      if (dbUser) {
        fullSession.user.role = dbUser.role;
        fullSession.user.planStatus = dbUser.planStatus;
        fullSession.user.planExpiresAt = dbUser.planExpiresAt
          ? dbUser.planExpiresAt.toISOString()
          : null;
        fullSession.user.affiliateCode =
          dbUser.affiliateCode !== undefined ? dbUser.affiliateCode.toString() : undefined;
        fullSession.user.affiliateBalance = dbUser.affiliateBalance;
        fullSession.user.affiliateRank =
          dbUser.affiliateRank !== undefined ? dbUser.affiliateRank.toString() : undefined;
        fullSession.user.affiliateInvites = dbUser.affiliateInvites;
      }

      return fullSession as Session;
    },

    async redirect({ baseUrl }: { baseUrl: string }) {
      return baseUrl + "/dashboard";
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
