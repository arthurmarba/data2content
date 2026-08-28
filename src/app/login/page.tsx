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

type LoginPageProps = {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

export default async function LoginPage({ searchParams }: LoginPageProps = {}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const reviewParam = resolvedSearchParams?.review;
  const isReviewAccess = Array.isArray(reviewParam)
    ? reviewParam.includes("1")
    : reviewParam === "1";
  const session = await getServerSession(authOptions);
  if (session?.user && !isReviewAccess) redirect(MAIN_DASHBOARD_ROUTE);

  return <LoginClient />;
}
