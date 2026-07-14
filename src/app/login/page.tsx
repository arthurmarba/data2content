import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const PRESERVED_LOGIN_PARAMS = ["callbackUrl", "intent", "error"] as const;

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : null;
}

export function buildLandingLoginRedirect(
  searchParams: LoginPageProps["searchParams"] = {},
) {
  const landingParams = new URLSearchParams({ auth: "login" });

  for (const key of PRESERVED_LOGIN_PARAMS) {
    const value = firstParam(searchParams?.[key]);
    if (value) landingParams.set(key, value);
  }

  return `/?${landingParams.toString()}`;
}

export default function LoginPage({ searchParams = {} }: LoginPageProps) {
  redirect(buildLandingLoginRedirect(searchParams));
}
