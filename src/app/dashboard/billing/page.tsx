import BillingClientPage from "./BillingClientPage";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

type Search = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Search }) {
  const cookieStore = cookies();

  const fromUrl = (
    (searchParams?.ref || searchParams?.aff || "") as string
  ).trim().toUpperCase();

  const session = await getServerSession(authOptions);

  const fromCookie =
    (cookieStore.get("d2c_ref")?.value || "").trim().toUpperCase();

  const fromSession = (
    (session as any)?.user?.affiliateCode ||
    (session as any)?.affiliateCode ||
    (session as any)?.user?.ref ||
    (session as any)?.ref ||
    ""
  )
    .toString()
    .trim()
    .toUpperCase();

  // ✅ URL > COOKIE > SESSION
  const defaultAffiliateCode = fromUrl || fromCookie || fromSession || "";

  console.log("[billing/page] defaultAffiliateCode:", defaultAffiliateCode, {
    fromUrl,
    fromCookie,
    fromSession,
  });

  return <BillingClientPage initialAffiliateCode={defaultAffiliateCode} />;
}
