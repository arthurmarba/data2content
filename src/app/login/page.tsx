// src/app/login/page.tsx (Corrigido)
// Este arquivo agora é um Server Component que lida com metadados e renderiza o componente de cliente.

import type { Metadata } from "next";
import LoginClient from "./LoginClient";

// Exportar metadados é permitido aqui
export const metadata: Metadata = {
  title: "Login - Data2Content", // Exemplo de título
  description: "Acesse sua conta para continuar.", // Exemplo de descrição
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <LoginClient />;
}
