import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { MAIN_DASHBOARD_ROUTE } from "@/constants/routes";
import TermsAcceptanceStep from "@/app/components/auth/TermsAcceptanceStep";

interface Props {
  searchParams: { callbackUrl?: string };
}

export default async function AceiteDeTermosPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    const loginUrl = `/login?callbackUrl=${encodeURIComponent("/aceite-de-termos")}`;
    redirect(loginUrl);
  }

  const rawCallback = searchParams.callbackUrl ?? MAIN_DASHBOARD_ROUTE;
  // Só permite redirects internos
  const callbackUrl =
    rawCallback.startsWith("/") && !rawCallback.startsWith("//")
      ? rawCallback
      : MAIN_DASHBOARD_ROUTE;

  return (
    <TermsAcceptanceStep
      userName={session.user.name}
      callbackUrl={callbackUrl}
    />
  );
}
