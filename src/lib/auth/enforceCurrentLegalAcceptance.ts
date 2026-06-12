import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser from "@/app/models/User";
import {
  hasCurrentLegalAcceptance,
  hasRecordedLegalAcceptance,
  SERVICE_TERMS_VERSION,
  PRIVACY_POLICY_VERSION,
} from "@/lib/auth/legalConsent";

const CURRENT_PATH_HEADER = "x-d2c-current-path";

function sanitizeInternalCallbackUrl(value: string | null | undefined): string | null {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return null;
}

function resolveLegalAcceptanceCallbackUrl(fallback: string): string {
  try {
    return sanitizeInternalCallbackUrl(headers().get(CURRENT_PATH_HEADER)) ?? fallback;
  } catch {
    return fallback;
  }
}

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
    if (!hasRecordedLegalAcceptance(user)) {
      // Novo usuário: consentimento implícito dado na landing page ("Ao continuar, você aceita...")
      const now = new Date();
      await DbUser.findByIdAndUpdate(userId, {
        serviceTermsAcceptedAt: now,
        serviceTermsVersion: SERVICE_TERMS_VERSION,
        privacyPolicyAcceptedAt: now,
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      });
      return;
    }

    // Usuário existente com versão desatualizada → mostrar "O que mudou"
    const resolvedCallbackUrl = resolveLegalAcceptanceCallbackUrl(callbackUrl);
    redirect(
      `/aceite-de-termos?callbackUrl=${encodeURIComponent(resolvedCallbackUrl)}`
    );
  }
}
