import NextAuth from "next-auth";
import type { NextAuthOptions, Session, User, Account } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User";
import type { JWT } from "next-auth/jwt";

// Garante que essa rota use Node.js em vez de Edge (importante para Mongoose).
export const runtime = "nodejs";

// Interfaces para os callbacks
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
}

/**
 * Definição única do NextAuthOptions.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: { scope: "openid email profile" },
      },
      // Log extra para ver se o Google retorna a foto e email
      profile(profile) {
        console.log("NextAuth: Google profile returned:", profile);
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
          } as User;
        }
        return null;
      },
    }),
  ],

  callbacks: {
    // Callback chamado quando o usuário faz signIn
    async signIn({ user, account }: SignInCallback): Promise<boolean> {
      console.log("NextAuth: signIn callback - user:", user, "account:", account);
      if (account?.provider === "google") {
        try {
          await connectToDatabase();
          const existingUser = (await DbUser.findOne({ email: user.email })) as IUser | null;

          if (!existingUser) {
            console.log("NextAuth: Criando novo usuário no DB para email:", user.email);
            const created = new DbUser({
              name: user.name,
              email: user.email,
              googleId: account.providerAccountId,
              role: "user",
            });
            await created.save();
            user.id = (created._id as Types.ObjectId).toString();
          } else {
            console.log("NextAuth: Usuário já existe no DB, id =", existingUser._id);
            user.id = (existingUser._id as Types.ObjectId).toString();
          }
        } catch (error) {
          console.error("Erro durante signIn:", error);
        }
      }
      return true;
    },

    // Callback chamado para gerar/atualizar o JWT a cada requisição
    async jwt({ token, user }: JwtCallback): Promise<JWT> {
      if (user) {
        // Se for Google, user.id é o _id do DB; se for demo, "demo-123"
        token.sub = user.id;
        if (user.image) {
          token.picture = user.image;
        }
      }
      console.log("NextAuth: JWT Callback - token:", token, "user:", user);
      return token;
    },

    // Callback chamado para popular o objeto session a partir do token
    async session({ session, token }: SessionCallback): Promise<Session> {
      console.log("NextAuth: Session Callback (antes) - token:", token, "session:", session);

      // Inicializa session.user se ainda não existir
      if (!session.user) {
        session.user = { id: "", name: "", email: "", image: "" };
      }
      session.user.id = token.sub as string;

      try {
        await connectToDatabase();
        let dbUser: IUser | null = null;

        // Se token.sub for um ObjectId, busca por _id; caso contrário, por googleId
        if (typeof token.sub === "string") {
          if (Types.ObjectId.isValid(token.sub)) {
            dbUser = await DbUser.findById(token.sub);
          } else {
            dbUser = await DbUser.findOne({ googleId: token.sub });
          }
        }

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
      console.log("NextAuth: Session Callback (depois) - session:", session);
      return session;
    },

    // Redireciona o usuário após login
    async redirect({ baseUrl }: RedirectCallback): Promise<string> {
      return baseUrl + "/dashboard";
    },
  },

  // Segredo para assinar o JWT
  secret: process.env.NEXTAUTH_SECRET,

  // Páginas customizadas
  pages: {
    signIn: "/login",     // Rota custom de login
    error: "/auth/error", // Rota custom de erro
  },

  // Configuração de sessão
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
};

// Cria o handler NextAuth e exporta como GET e POST (App Router).
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
