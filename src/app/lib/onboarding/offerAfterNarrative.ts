// Oferta do Pro logo depois de a narrativa aparecer no primeiro acesso.
//
// Plano em docs/plano-oferta-pos-narrativa.md. A narrativa é o momento mais
// forte do primeiro acesso; a oferta vem na tela seguinte, nunca junto dela.
// Regras: só conta gratuita, só quando existe narrativa (sem ela seria vender no
// vazio), uma vez na vida, e atrás de ONBOARDING_OFFER_AFTER_NARRATIVE_ENABLED
// para ligar aos poucos.

import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { isActiveLike } from "@/app/lib/planGuard";
import UserModel from "@/app/models/User";

export type OnboardingOfferReason = "eligible" | "disabled" | "skipped" | "no_narrative" | "already_pro" | "already_seen";

export function isOnboardingOfferEnabled(): boolean {
  return process.env.ONBOARDING_OFFER_AFTER_NARRATIVE_ENABLED?.trim() === "1";
}

/** Decide e reserva a oferta: quem recebe `eligible` já fica marcado como tendo visto. */
export async function claimOnboardingOffer(
  userId: string,
  params: { skipped: boolean; hasNarrative: boolean },
  now = new Date(),
): Promise<{ eligible: boolean; reason: OnboardingOfferReason }> {
  if (!isOnboardingOfferEnabled()) return { eligible: false, reason: "disabled" };
  if (params.skipped) return { eligible: false, reason: "skipped" };
  if (!params.hasNarrative) return { eligible: false, reason: "no_narrative" };
  if (!Types.ObjectId.isValid(userId)) return { eligible: false, reason: "disabled" };

  await connectToDatabase();
  const user = await UserModel.findById(userId).select("planStatus").lean<{ planStatus?: unknown } | null>();
  if (isActiveLike(user?.planStatus)) return { eligible: false, reason: "already_pro" };

  const marked = await UserModel.updateOne(
    { _id: new Types.ObjectId(userId), onboardingOfferSeenAt: { $exists: false } },
    { $set: { onboardingOfferSeenAt: now } },
  );
  return marked.modifiedCount
    ? { eligible: true, reason: "eligible" }
    : { eligible: false, reason: "already_seen" };
}
