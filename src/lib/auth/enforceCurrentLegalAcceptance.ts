import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser from "@/app/models/User";
import { hasCurrentLegalAcceptance } from "@/lib/auth/legalConsent";

export async function enforceCurrentLegalAcceptance(callbackUrl: string) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return;
  }

  await connectToDatabase();
  const user = await DbUser.findById(userId)
    .select("serviceTermsAcceptedAt serviceTermsVersion privacyPolicyAcceptedAt privacyPolicyVersion")
    .lean();

  if (!hasCurrentLegalAcceptance(user)) {
    redirect(
      `/login?error=TermsConsentRequired&callbackUrl=${encodeURIComponent(callbackUrl)}`
    );
  }
}
