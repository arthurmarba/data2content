import type { Metadata } from "next";

import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Login - Data2Content",
  description: "Acesse sua conta para continuar.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <LoginClient />;
}
