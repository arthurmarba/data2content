// Conteúdo para o seu SignInPage.tsx
// - ATUALIZADO: callbackUrl para Google SignIn agora aponta para MAIN_DASHBOARD_ROUTE

"use client";

import { signIn } from "next-auth/react";
import { MAIN_DASHBOARD_ROUTE } from '@/constants/routes';

export default function SignInPage() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Fazer Login</h1>

      {/* Botão para Login via Google */}
      <button
        onClick={() =>
          signIn("google", {
            callbackUrl: MAIN_DASHBOARD_ROUTE,
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
            callbackUrl: MAIN_DASHBOARD_ROUTE,
          })
        }
      >
        Login com Credenciais (demo)
      </button>
    </div>
  );
}
