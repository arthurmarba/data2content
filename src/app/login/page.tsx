import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { MAIN_DASHBOARD_ROUTE } from "@/constants/routes";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Login - Data2Content",
  description: "Acesse sua conta para continuar.",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect(MAIN_DASHBOARD_ROUTE);

  return <LoginClient />;
}
