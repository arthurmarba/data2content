import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser from "@/app/models/User";
import {
  SERVICE_TERMS_VERSION,
  PRIVACY_POLICY_VERSION,
} from "@/lib/auth/legalConsent";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { acceptTerms?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.acceptTerms) {
    return NextResponse.json(
      { error: "Aceite dos Termos e Condições é obrigatório." },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const now = new Date();

  await DbUser.findByIdAndUpdate(userId, {
    serviceTermsAcceptedAt: now,
    serviceTermsVersion: SERVICE_TERMS_VERSION,
    privacyPolicyAcceptedAt: now,
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
  });

  return NextResponse.json({ ok: true });
}
