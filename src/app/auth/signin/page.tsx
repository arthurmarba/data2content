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
            callbackUrl: "/dashboard", // para onde redirecionar após login
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
            callbackUrl: "/dashboard",
          })
        }
      >
        Login com Credenciais (demo)
      </button>
    </div>
  );
}
