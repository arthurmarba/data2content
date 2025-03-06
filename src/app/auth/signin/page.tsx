// pages/auth/signin.tsx
"use client"; // se estiver usando Next.js 13 (app dir) ou não, verifique se precisa

import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Fazer Login</h1>

      <button onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
        Entrar com Google
      </button>

      {/* Se quiser manter credenciais (demo) */}
      <br />
      <button
        onClick={() =>
          signIn("credentials", {
            username: "demo",
            password: "demo",
            callbackUrl: "/dashboard",
          })
        }
      >
        Login com Credenciais (demo)
      </button>
    </div>
  );
}
