/**
 * weeklyWhatsAppMessageService.ts
 *
 * Generates the weekly WhatsApp newsletter body for a creator.
 *
 * Responsibilities:
 *   1. Eligibility check  — whatsappVerified, not opted-out, Pro/admin
 *   2. Throttle check     — 6-day minimum between sends (weeklyWhatsAppSentAt)
 *   3. Tier determination — seed / growing / mature from map state
 *   4. Context assembly   — synthesis from readings + map confirmations + active ideas
 *   5. Gemini call        — generates the message body (≤ 460 chars)
 *   6. Return payload     — templateName + params ready for sendTemplateMessage (D2)
 *
 * Does NOT send the message. The cron (D2: /api/cron/weekly-whatsapp-message)
 * calls this function and dispatches the result via whatsappService.sendTemplateMessage.
 *
 * Throttle stamp (weeklyWhatsAppSentAt) is written by the D2 cron AFTER a
 * successful send, not here — this service is idempotent and read-only on User.
 *
 * Template names (pre-approved on Meta WABA):
 *   d2c_weekly_seed_v1        — for seed tier (map building)
 *   d2c_weekly_newsletter_v1  — for growing / mature tiers
 *
 * Template body structure:
 *   "{{1}}, seu mapa [context]:\n\n{{2}}\n\n→ {{3}}"
 *   {{1}} = creator first name
 *   {{2}} = AI-generated newsletter body (this service generates it)
 *   {{3}} = CTA text + URL (assembled here, formatted for template)
 */

import { Types } from "mongoose";
import { GoogleGenAI, createUserContent } from "@google/genai";
import { connectToDatabase } from "@/app/lib/mongoose";
import {
  isNarrativeMapAdminUser,
  hasNarrativeMapPremiumAccess,
} from "./narrativeMapAccessState";
import { getMapConfirmationsSnapshot } from "./mapConfirmationsService";
import { buildNarrativeMapMobileViewModelFromReadings } from "./narrativeMapMobileViewModelServerSelector";
import {
  WHATSAPP_SYSTEM_PROMPT,
  WHATSAPP_TEMPLATE_NAMES,
  buildSeedPrompt,
  buildGrowingMaturePrompt,
  type WhatsAppMessageTier,
} from "./weeklyWhatsAppMessagePromptBuilder";

// ─── Constants ────────────────────────────────────────────────────────────────

const GEMINI_MODEL = "gemini-2.5-flash";

/** 6 days — same cadence as idea freshness and weekly summary. */
const MIN_SEND_INTERVAL_MS = 6 * 24 * 60 * 60 * 1000;

/** Readings threshold to cross from "growing" to "mature" tier. */
const MATURE_TIER_THRESHOLD = 6;

// ─── Result types ─────────────────────────────────────────────────────────────

/**
 * Template-ready payload for the D2 cron to call sendTemplateMessage.
 * Matches the ITemplateComponent[] shape expected by whatsappService.
 */
export interface WeeklyWhatsAppTemplatePayload {
  /** Meta WABA template name */
  templateName: string;
  /**
   * Template body parameters in order:
   *   [0] = creatorFirstName  → {{1}}
   *   [1] = messageBody       → {{2}}
   *   [2] = ctaText           → {{3}}
   */
  bodyParams: [string, string, string];
  /** Destination phone in international format (e.g. "+5511999998888") */
  whatsappPhone: string;
  tier: WhatsAppMessageTier;
  /** ISO timestamp used by D2 cron to write weeklyWhatsAppSentAt after sending. */
  generatedAt: string;
}

export type WeeklyWhatsAppMessageSkipReason =
  | "no_whatsapp"
  | "opted_out"
  | "not_eligible"
  | "too_recent"
  | "no_readings"
  | "no_narrative"
  | "generation_failed"
  | "invalid_user";

export interface WeeklyWhatsAppMessageResult {
  ok: boolean;
  skipped?: WeeklyWhatsAppMessageSkipReason;
  payload?: WeeklyWhatsAppTemplatePayload;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function readApiKey(): string | null {
  return (
    process.env.GOOGLE_GEMINI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    null
  );
}

function extractFirstName(fullName: string | null | undefined): string {
  if (!fullName?.trim()) return "Criador";
  return fullName.trim().split(/\s+/)[0] ?? "Criador";
}

function determineTier(
  narrativeConfirmed: boolean,
  territoriesConfirmed: boolean,
  readingCount: number,
): WhatsAppMessageTier {
  if (!narrativeConfirmed || !territoriesConfirmed) return "seed";
  return readingCount >= MATURE_TIER_THRESHOLD ? "mature" : "growing";
}

async function callGemini(system: string, user: string): Promise<string | null> {
  const apiKey = readApiKey();
  if (!apiKey) {
    console.error("[weeklyWhatsApp] Gemini API key missing.");
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: createUserContent([user]),
      config: {
        systemInstruction: system,
        maxOutputTokens: 600,
        temperature: 0.65,
      },
    });
    const text = response.text?.trim();
    return text || null;
  } catch (err) {
    console.error("[weeklyWhatsApp] Gemini call failed:", err);
    return null;
  }
}

function buildCtaText(tier: WhatsAppMessageTier): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://data2content.com.br";
  const profilePath = `${baseUrl}/perfil`;

  if (tier === "seed") {
    return `Confirmar e ver roteiros: ${profilePath}`;
  }
  return `Ver seus roteiros: ${profilePath}`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generates the weekly WhatsApp newsletter payload for one creator.
 * Pure read — never writes to the database. Idempotent.
 *
 * The D2 cron should:
 *   1. Call this function
 *   2. On ok=true, call sendTemplateMessage(payload.whatsappPhone, payload.templateName, components)
 *   3. On send success, write weeklyWhatsAppSentAt = new Date() to User
 */
export async function generateWeeklyWhatsAppMessageForUser(
  userId: string,
): Promise<WeeklyWhatsAppMessageResult> {
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return { ok: false, skipped: "invalid_user" };
  }

  await connectToDatabase();
  const { default: User } = await import("@/app/models/User");

  // ── 1. Load user — lightweight select ─────────────────────────────────────
  const userDoc = await User.findById(userId)
    .select(
      "name " +
      "whatsappPhone whatsappVerified whatsappOptOut " +
      "weeklyWhatsAppSentAt " +
      "onboardingAnswers " +
      "planStatus role cancelAtPeriodEnd isAdmin isDev",
    )
    .lean<{
      _id: Types.ObjectId;
      name?: string | null;
      whatsappPhone?: string | null;
      whatsappVerified?: boolean;
      whatsappOptOut?: boolean;
      weeklyWhatsAppSentAt?: Date | null;
      onboardingAnswers?: { whyYouCreate?: string | null } | null;
      planStatus?: string;
      role?: string;
      cancelAtPeriodEnd?: boolean;
      isAdmin?: boolean;
      isDev?: boolean;
    }>();

  if (!userDoc) return { ok: false, skipped: "invalid_user" };

  // ── 2. Eligibility ─────────────────────────────────────────────────────────

  if (!userDoc.whatsappPhone || !userDoc.whatsappVerified) {
    return { ok: false, skipped: "no_whatsapp" };
  }
  if (userDoc.whatsappOptOut) {
    return { ok: false, skipped: "opted_out" };
  }

  const effectiveUser = { ...userDoc, id: userId };
  const isAdmin = isNarrativeMapAdminUser(effectiveUser);
  const hasPremium = hasNarrativeMapPremiumAccess(effectiveUser);
  if (!isAdmin && !hasPremium) {
    return { ok: false, skipped: "not_eligible" };
  }

  // ── 3. Throttle ────────────────────────────────────────────────────────────
  if (userDoc.weeklyWhatsAppSentAt) {
    const ageMs = Date.now() - new Date(userDoc.weeklyWhatsAppSentAt).getTime();
    if (ageMs < MIN_SEND_INTERVAL_MS) {
      return { ok: false, skipped: "too_recent" };
    }
  }

  // ── 4. Map data — build synthesis from readings (reliable source) ──────────
  const selectorResult = await buildNarrativeMapMobileViewModelFromReadings({
    userId,
    displayName: userDoc.name ?? "Creator",
    displayHandle: null,
    accessLevel: "premium",
    instagramConnected: false,
    mediaKitAvailable: false,
  });

  const synthesis = selectorResult.profileSynthesis;
  const readingCount = synthesis.analyzedReadingsCount ?? 0;

  if (readingCount === 0) return { ok: false, skipped: "no_readings" };

  // ── 5. Map confirmations ───────────────────────────────────────────────────
  const mapConfirmations = await getMapConfirmationsSnapshot(userId);
  const narrativeConfirmed = mapConfirmations?.narrative === "confirmed";
  const territoriesConfirmed = mapConfirmations?.territories === "confirmed";

  const tier = determineTier(narrativeConfirmed, territoriesConfirmed, readingCount);
  const templateName = WHATSAPP_TEMPLATE_NAMES[tier];
  const creatorFirstName = extractFirstName(userDoc.name);

  const narrativeLabel = synthesis.mainNarrative?.label ?? null;
  const territoriesLabels = synthesis.narrativeTerritories
    .slice(0, 3)
    .map((t) => t.label)
    .filter((l): l is string => !!l);

  // ── 6. Build context + call Gemini ────────────────────────────────────────
  let generatedBody: string | null = null;

  if (tier === "seed") {
    const { system, user } = buildSeedPrompt({
      tier: "seed",
      creatorFirstName,
      readingCount,
      narrativeLabel,
      territoriesLabels,
      whyCreate: userDoc.onboardingAnswers?.whyYouCreate ?? null,
    });
    generatedBody = await callGemini(system, user);
  } else {
    // growing | mature — need active pautas for preview
    if (!narrativeLabel) return { ok: false, skipped: "no_narrative" };

    const { default: CreatorContentIdea } = await import(
      "@/app/models/CreatorContentIdea"
    );
    const previewCount = tier === "mature" ? 5 : 4; // fetch extra; prompt picks 3 or 2
    const activeIdeas = await CreatorContentIdea.find({
      userId: new Types.ObjectId(userId),
      status: { $in: ["active", "saved"] },
    })
      .sort({ generatedAt: -1 })
      .limit(previewCount)
      .select("title hook territory suggestedFormat")
      .lean<Array<{ title: string; hook: string; territory: string; suggestedFormat: string }>>();

    const confirmedAssets = (mapConfirmations?.assetConfirmations ?? [])
      .filter((a) => a.state === "confirmed")
      .map((a) => a.label)
      .slice(0, 4);

    // Tone label: read from synthesis if confirmed
    const toneLabel =
      mapConfirmations?.tone === "confirmed"
        ? (synthesis.dominantTone ?? null)
        : null;

    // Latest endorsed hypothesis as discovery signal
    const endorsedHypotheses = mapConfirmations?.endorsedHypotheses ?? [];
    const latestHypothesis: string | null =
      endorsedHypotheses[endorsedHypotheses.length - 1] ?? null;

    const { system, user } = buildGrowingMaturePrompt({
      tier,
      creatorFirstName,
      readingCount,
      narrativeLabel,
      territoriesLabels,
      confirmedAssets,
      toneLabel,
      activeIdeas: activeIdeas.map((i) => ({
        title: i.title,
        hook: i.hook,
        territory: i.territory,
        suggestedFormat: i.suggestedFormat,
      })),
      latestHypothesis,
    });
    generatedBody = await callGemini(system, user);
  }

  if (!generatedBody) {
    return { ok: false, skipped: "generation_failed" };
  }

  // ── 7. Assemble template payload ──────────────────────────────────────────
  const ctaText = buildCtaText(tier);

  return {
    ok: true,
    payload: {
      templateName,
      bodyParams: [creatorFirstName, generatedBody, ctaText],
      whatsappPhone: userDoc.whatsappPhone,
      tier,
      generatedAt: new Date().toISOString(),
    },
  };
}
