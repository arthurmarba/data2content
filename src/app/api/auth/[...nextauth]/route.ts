// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import type { NextAuthOptions, Session, User, Account } from "next-auth"; // Tipos padrão
import type { AdapterUser } from "next-auth/adapters";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User"; // Sua interface IUser do Mongoose
import { Types } from "mongoose";
import type { JWT, JWTEncodeParams, JWTDecodeParams } from "next-auth/jwt";
import { SignJWT, jwtVerify } from "jose";
// import { nanoid } from 'nanoid';

export const runtime = "nodejs";

// --- REMOVIDAS INTERFACES SessionUser e CustomSession ---
// A tipagem agora vem exclusivamente do seu types/next-auth.d.ts

/**
 * Interfaces auxiliares para os callbacks (mantidas para clareza interna).
 */
interface SignInCallback {
  user: User & { id?: string }; // User from provider or authorize
  account: Account | null;
}

interface JwtCallback {
  token: JWT;
  user?: User | AdapterUser; // User object on initial sign in
}

interface RedirectCallback {
  baseUrl: string;
}

/**
 * Custom encode (HS256) para JWT.
 */
async function customEncode({ token, secret, maxAge }: JWTEncodeParams): Promise<string> {
    if (!secret) throw new Error("NEXTAUTH_SECRET ausente em customEncode");
    const secretString = typeof secret === "string" ? secret : String(secret);
    const expirationTime = Math.floor(Date.now() / 1000) + (maxAge ?? 30 * 24 * 60 * 60);
    return await new SignJWT({ ...token })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(expirationTime)
        .sign(new TextEncoder().encode(secretString));
}


/**
 * Custom decode (HS256) para JWT com logs adicionais.
 */
async function customDecode({ token, secret }: JWTDecodeParams): Promise<JWT | null> {
    if (!token || !secret) {
        console.error("customDecode: Token ou secret não fornecidos.");
        return null;
    }
    const secretString = typeof secret === "string" ? secret : String(secret);
    try {
        console.debug("customDecode: Iniciando decodificação do token:", token.substring(0, 10) + "...");
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secretString), {
            algorithms: ["HS256"],
        });
        console.debug("customDecode: Token decodificado com sucesso.");
        return payload as JWT;
    } catch (err) {
        console.error("customDecode: Erro ao decodificar token:", err instanceof Error ? err.message : err);
        return null;
    }
}


// --- REMOVIDA função generateAffiliateCode local ---
// A geração agora é feita pelo hook pre-save do Mongoose no models/User.ts


/**
 * Configurações do NextAuth.
 */
export const authOptions: NextAuthOptions = {
  useSecureCookies: process.env.NODE_ENV === "production",
  cookies: {
    // ... (configuração de cookies mantida) ...
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        domain: process.env.NODE_ENV === 'production' ? process.env.NEXTAUTH_COOKIE_DOMAIN : undefined,
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === 'production' ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
      options: {
        sameSite: "lax",
        path: "/",
        domain: process.env.NODE_ENV === 'production' ? process.env.NEXTAUTH_COOKIE_DOMAIN : undefined,
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === 'production' ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
         domain: process.env.NODE_ENV === 'production' ? process.env.NEXTAUTH_COOKIE_DOMAIN : undefined,
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { scope: "openid email profile" } },
      profile(profile) {
        console.debug("NextAuth: Google profile returned:", profile);
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    }),
    CredentialsProvider({
      // ... (provider de Credentials mantido) ...
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
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    encode: customEncode,
    decode: customDecode,
  },
  callbacks: {
    async signIn({ user, account }: SignInCallback): Promise<boolean> {
      console.debug("NextAuth: signIn callback initiated", { userId: user.id, provider: account?.provider });
      if (account?.provider === "google") {
        if (!user.email) {
             console.error("Erro no signIn: Email do Google não encontrado.");
             return false;
        }
        try {
          await connectToDatabase();
          let existingUser = await DbUser.findOne({ email: user.email }).exec() as IUser | null;

          if (!existingUser) {
            console.debug("NextAuth: Criando novo usuário para email:", user.email);
            // Não precisamos gerar affiliateCode aqui, o hook pre-save fará isso.

            const newUser = new DbUser({
              name: user.name,
              email: user.email,
              image: user.image,
              googleId: account.providerAccountId,
              role: "user",
              planStatus: "inactive",
              planExpiresAt: null,
              // affiliateCode será gerado pelo hook pre-save
              // Inicializa os outros campos de afiliado
              affiliateBalance: 0,
              affiliateRank: 1,
              affiliateInvites: 0,
            });
            // O hook pre-save será executado aqui, antes do save real
            existingUser = await newUser.save();
            user.id = existingUser._id.toString();
            console.debug("NextAuth: Novo usuário criado com sucesso, id =", user.id);
            console.debug("NextAuth: Código de afiliado atribuído pelo hook:", existingUser.affiliateCode); // Log para confirmar

          } else {
            console.debug("NextAuth: Usuário já existe, id =", existingUser._id.toString());
            user.id = existingUser._id.toString();

             // Atualiza nome/imagem se mudou no Google (opcional)
             let needsSave = false;
             if (user.name && user.name !== existingUser.name) {
                 existingUser.name = user.name;
                 needsSave = true;
             }
             if (user.image && user.image !== existingUser.image) {
                 existingUser.image = user.image;
                 needsSave = true;
             }

             // Verifica se campos de afiliado existem e inicializa se necessário
             // O hook pre-save cuidará do affiliateCode se ele estiver faltando e 'needsSave' for true
             if (existingUser.affiliateBalance === undefined || existingUser.affiliateBalance === null) {
                 existingUser.affiliateBalance = 0;
                 needsSave = true;
             }
              if (existingUser.affiliateRank === undefined || existingUser.affiliateRank === null) {
                 existingUser.affiliateRank = 1;
                 needsSave = true;
             }
              if (existingUser.affiliateInvites === undefined || existingUser.affiliateInvites === null) {
                 existingUser.affiliateInvites = 0;
                 needsSave = true;
             }
             // Se o código estiver faltando, marcar para salvar fará o hook pre-save rodar
             if (!existingUser.affiliateCode) {
                 console.warn("Usuário existente sem affiliateCode. Será gerado no próximo save (se houver).");
                 // Não precisamos gerar aqui, mas precisamos salvar se outros campos mudaram
                 // Se needsSave já for true, o hook rodará. Se não, o código só será gerado
                 // se o usuário for salvo por outro motivo no futuro.
                 // Para garantir, podemos forçar o save se o código estiver faltando:
                 // needsSave = true; // Descomente se quiser garantir a criação imediata
             }


            if (needsSave) {
                // O hook pre-save rodará aqui se affiliateCode estiver faltando
                await existingUser.save();
                console.debug("NextAuth: Dados do usuário existente atualizados/verificados.");
            }
          }
        } catch (error) {
          console.error("Erro durante signIn ao interagir com o banco:", error);
          return false;
        }
      } else if (account?.provider === "credentials") {
         if (!user?.id) {
            console.error("Erro: Usuário de Credentials sem ID após authorize.");
            return false;
         }
         // Lógica para Credentials: Buscar usuário e verificar/inicializar campos de afiliado
         try {
            await connectToDatabase();
            const credUser = await DbUser.findById(user.id);
            if (credUser && !credUser.affiliateCode) {
                // O hook pre-save gerará o código se salvarmos
                credUser.affiliateBalance = credUser.affiliateBalance ?? 0;
                credUser.affiliateRank = credUser.affiliateRank ?? 1;
                credUser.affiliateInvites = credUser.affiliateInvites ?? 0;
                await credUser.save();
                console.debug("NextAuth: Código/dados de afiliado inicializados para usuário de Credentials.");
            }
         } catch(error) {
             console.error("Erro ao verificar/atualizar usuário de Credentials:", error);
             // Não impedir login necessariamente, mas logar o erro
         }

      }

      if (!user?.id) {
          console.error("Erro no signIn: user.id não definido ao final.");
          return false;
      }

      return true;
    },
    async jwt({ token, user, account }: { token: JWT; user?: User | AdapterUser; account?: Account | null }): Promise<JWT> {
        console.debug("NextAuth: JWT Callback initiated", { userId: user?.id, accountProvider: account?.provider });
        if (account && user?.id) {
            token.id = user.id;
        }
        console.debug("NextAuth: JWT Callback finished", { tokenId: token.id });
        return token;
    },
    async session({ session, token }: { session: Session; token: JWT }): Promise<Session> {
      console.debug("NextAuth: Session Callback initiated", { tokenId: token.id });

      if (token.id && session.user) {
          session.user.id = token.id as string;
      } else {
          console.error("Erro na Session Callback: token.id ou session.user ausente.", { tokenId: token.id, sessionUserExists: !!session.user });
          return session;
      }

      try {
        await connectToDatabase();
        const dbUser = await DbUser.findById(token.id).lean();

        if (dbUser && session.user) {
          console.debug("NextAuth: Usuário encontrado no DB para sessão:", dbUser._id);

          session.user.name = dbUser.name ?? session.user.name;
          session.user.email = dbUser.email ?? session.user.email;
          session.user.image = dbUser.image ?? session.user.image;

          session.user.role = dbUser.role;
          session.user.planStatus = dbUser.planStatus;
          session.user.planExpiresAt = dbUser.planExpiresAt instanceof Date
                                        ? dbUser.planExpiresAt.toISOString()
                                        : null;
          session.user.affiliateCode = dbUser.affiliateCode ?? undefined;
          session.user.affiliateBalance = dbUser.affiliateBalance ?? 0;

          // Lógica para affiliateRank (considerando string | number do seu .d.ts)
          if (typeof dbUser.affiliateRank === 'number' || typeof dbUser.affiliateRank === 'string') {
              session.user.affiliateRank = dbUser.affiliateRank;
          } else {
              session.user.affiliateRank = undefined; // Ou um valor padrão, como 1
          }

          session.user.affiliateInvites = dbUser.affiliateInvites ?? 0;

        } else if (session.user) {
           console.error(`Usuário não encontrado no DB para id: ${token.id}, limpando campos customizados da sessão.`);
           delete session.user.role;
           delete session.user.planStatus;
           delete session.user.planExpiresAt;
           delete session.user.affiliateCode;
           delete session.user.affiliateBalance;
           delete session.user.affiliateRank;
           delete session.user.affiliateInvites;
        }
      } catch (error) {
        console.error("Erro ao buscar/processar dados do usuário na sessão:", error);
      }

      console.debug("NextAuth: Session Callback finished", session.user);
      return session;
    },
    async redirect({ baseUrl }: RedirectCallback): Promise<string> {
      // ... (callback redirect mantido) ...
      return `${baseUrl}/dashboard`;
    },
  },
  pages: {
    // ... (configuração de pages mantida) ...
    signIn: "/login",
    error: "/auth/error",
  },
  session: {
    // ... (configuração de session mantida) ...
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
  // debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
