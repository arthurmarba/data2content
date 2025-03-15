import type { NextAuthOptions, Session, User, Account } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "@/app/lib/mongoose";
import UserModel, { IUser } from "@/app/models/User";
import { Types } from "mongoose";
import type { JWT } from "next-auth/jwt";

// Interfaces específicas para os callbacks
interface SignInCallback {
  user: User & { id?: string };
  account: Account | null;
}

interface JwtCallback {
  token: JWT;
  user?: User;
}

interface SessionCallback {
  session: Session;
  token: JWT;
}

interface RedirectCallback {
  baseUrl: string;
  // Parâmetro "url" removido pois não é utilizado
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: { scope: "openid email profile" },
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
          // Exemplo simples de usuário 'demo'
          return {
            id: "demo-123",
            name: "Demo User",
            email: "demo@example.com",
          } as User;
        }
        return null;
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }: SignInCallback): Promise<boolean> {
      if (account?.provider === "google") {
        try {
          await connectToDatabase();
          const existingUser = (await UserModel.findOne({ email: user.email })) as IUser | null;
          if (!existingUser) {
            const created = new UserModel({
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
        } catch (error) {
          console.error("Erro durante signIn:", error);
        }
      }
      return true;
    },

    async jwt({ token, user }: JwtCallback): Promise<JWT> {
      if (user) {
        // Se for Google, user.id será o _id do DB; se for demo, "demo-123"
        token.sub = user.id;
        if (user.image) {
          token.picture = user.image;
        }
      }
      return token;
    },

    async session({ session, token }: SessionCallback): Promise<Session> {
      // Inicializa session.user com 'id' (conforme extensão no next-auth.d.ts)
      if (!session.user) {
        session.user = { id: "", name: "", email: "", image: "" };
      }
      session.user.id = token.sub as string;

      try {
        await connectToDatabase();
        const dbUser = await UserModel.findById(token.sub);
        if (dbUser) {
          session.user.role = dbUser.role;
          session.user.planStatus = dbUser.planStatus;
          session.user.planExpiresAt = dbUser.planExpiresAt
            ? dbUser.planExpiresAt.toISOString()
            : null;
          session.user.affiliateCode = dbUser.affiliateCode
            ? dbUser.affiliateCode.toString()
            : undefined;
          session.user.affiliateBalance = dbUser.affiliateBalance;
          session.user.affiliateRank = dbUser.affiliateRank
            ? dbUser.affiliateRank.toString()
            : undefined;
          session.user.affiliateInvites = dbUser.affiliateInvites;
        }
      } catch (error) {
        console.error("Erro ao buscar dados do usuário na sessão:", error);
      }

      if (token.picture) {
        session.user.image = token.picture as string;
      }
      return session;
    },

    async redirect({ baseUrl }: RedirectCallback): Promise<string> {
      // Redireciona para /dashboard após login
      return baseUrl + "/dashboard";
    },
  },

  secret: process.env.NEXTAUTH_SECRET,

  pages: {
    signIn: "/login",       // Caso esteja usando Pages Router para login
    error: "/auth/error",   // Ou rota custom de erro
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
};

export default authOptions;
