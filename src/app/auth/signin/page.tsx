"use client";

import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Fazer Login</h1>

      <button onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
        Entrar com Google
      </button>

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
