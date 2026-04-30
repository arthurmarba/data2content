import crypto from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";

import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { serializePostCreationTrial } from "@/app/lib/postCreationTrial/access";
import UserModel from "@/app/models/User";
import {
  COMMUNITY_INSPIRATION_TERMS_VERSION,
  PRIVACY_POLICY_VERSION,
  SERVICE_TERMS_VERSION,
} from "@/lib/auth/legalConsent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRE_SIGNUP_TOKEN_TTL_MINUTES = 15;

function buildTrialEmail() {
  return `trial-${crypto.randomUUID()}@pre-signup.data2content.local`;
}

function buildTokenExpiry() {
  return new Date(Date.now() + PRE_SIGNUP_TOKEN_TTL_MINUTES * 60 * 1000);
}

export async function POST(request: Request) {
  const authOptions = await resolveAuthOptions();
  const session = (await getServerSession(authOptions as any)) as any;
  const sessionUserId = typeof session?.user?.id === "string" ? session.user.id.trim() : "";
  const now = new Date();
  let acceptedLegal = false;
  try {
    const body = await request.json();
    acceptedLegal = body?.acceptedLegal === true;
  } catch {
    acceptedLegal = false;
  }

  if (!acceptedLegal) {
    return NextResponse.json(
      {
        ok: false,
        error: "Aceite os Termos e a Política de Privacidade para conectar o Instagram.",
        reason: "legal_consent_required",
      },
      { status: 400 },
    );
  }

  await connectToDatabase();

  if (sessionUserId && Types.ObjectId.isValid(sessionUserId)) {
    const user = await UserModel.findById(sessionUserId)
      .select("accountState postCreationTrial isInstagramConnected")
      .exec();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Usuário não encontrado." }, { status: 404 });
    }

    if (!user.postCreationTrial?.startedAt) {
      user.postCreationTrial = {
        ...(user.postCreationTrial ?? {}),
        startedAt: now,
        source: "post_creation_board",
      };
      await user.save();
    }

    return NextResponse.json({
      ok: true,
      userId: String(user._id),
      accountState: user.accountState ?? "registered",
      instagramConnected: Boolean(user.isInstagramConnected),
      postCreationTrial: serializePostCreationTrial(user.postCreationTrial),
      loginToken: null,
    });
  }

  const loginToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = buildTokenExpiry();

  const user = await UserModel.create({
    name: "Criador Data2Content",
    email: buildTrialEmail(),
    provider: "credentials",
    role: "user",
    accountState: "pre_signup",
    planStatus: "inactive",
    isNewUserForOnboarding: false,
    onboardingCompletedAt: null,
    preSignupLoginToken: loginToken,
    preSignupLoginTokenExpiresAt: expiresAt,
    postCreationTrial: {
      startedAt: now,
      source: "post_creation_board",
    },
    serviceTermsAcceptedAt: now,
    serviceTermsVersion: SERVICE_TERMS_VERSION,
    privacyPolicyAcceptedAt: now,
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    communityInspirationOptIn: false,
    communityInspirationOptInDate: null,
    communityInspirationTermsVersion: COMMUNITY_INSPIRATION_TERMS_VERSION,
    isInstagramConnected: false,
  });

  return NextResponse.json({
    ok: true,
    userId: String(user._id),
    accountState: "pre_signup",
    instagramConnected: false,
    postCreationTrial: serializePostCreationTrial(user.postCreationTrial),
    loginToken,
    expiresAt: expiresAt.toISOString(),
  });
}
