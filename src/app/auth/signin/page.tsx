// Conteúdo para o seu SignInPage.tsx
// - ATUALIZADO: callbackUrl para Google SignIn agora aponta para /auth/complete-signup

"use client";

import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Fazer Login</h1>

      {/* Botão para Login via Google */}
      <button
        onClick={() =>
          signIn("google", {
            // <<< MODIFICADO: callbackUrl atualizado >>>
            callbackUrl: "/auth/complete-signup", // Redireciona para a página de aceite de termos/finalização de cadastro
          })
        }
        style={{ marginBottom: 10 }}
      >
        Entrar com Google
      </button>

      <br />

      {/* Botão para Login via Credenciais "demo" */}
      <button
        onClick={() =>
          signIn("credentials", {
            username: "demo",
            password: "demo",
            callbackUrl: "/dashboard/chat", // Atualizado para nova rota principal
          })
        }
      >
        Login com Credenciais (demo)
      </button>
    </div>
  );
}
