import { createHash } from "node:crypto";

const OPENAI_CONVERSIONS_ENDPOINT = "https://bzr.openai.com/v1/events";

export interface OpenAiSubscriptionConversionInput {
  eventId: string;
  timestampMs: number;
  sourceUrl: string;
  planId: "d2c_pro_monthly" | "d2c_pro_annual";
  email?: string | null;
  externalId?: string | null;
  obref?: string | null;
  oppref?: string | null;
}

export type OpenAiConversionDeliveryResult =
  | { delivered: false; reason: "not_configured" }
  | { delivered: true; status: number; validateOnly: boolean };

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashOpenAiEmail(value: string): string {
  return sha256(value.trim().toLowerCase());
}

export function hashOpenAiExternalId(value: string): string {
  return sha256(value.trim());
}

function compactOptionalValue(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

export async function sendOpenAiSubscriptionConversion(
  input: OpenAiSubscriptionConversionInput,
): Promise<OpenAiConversionDeliveryResult> {
  const pixelId =
    process.env.OPENAI_ADS_PIXEL_ID?.trim()
    || process.env.NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID?.trim();
  const apiKey = process.env.OPENAI_ADS_CONVERSIONS_API_KEY?.trim();
  if (!pixelId || !apiKey) return { delivered: false, reason: "not_configured" };

  const email = compactOptionalValue(input.email);
  const externalId = compactOptionalValue(input.externalId);
  const obref = compactOptionalValue(input.obref);
  const oppref = compactOptionalValue(input.oppref);
  const user = {
    ...(email ? { emails_sha256: [hashOpenAiEmail(email)] } : {}),
    ...(externalId ? { external_ids_sha256: [hashOpenAiExternalId(externalId)] } : {}),
    ...(obref ? { obref } : {}),
  };
  const validateOnly = process.env.OPENAI_ADS_CAPI_VALIDATE_ONLY?.trim() === "1";

  const response = await fetch(
    `${OPENAI_CONVERSIONS_ENDPOINT}?pid=${encodeURIComponent(pixelId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        validate_only: validateOnly,
        integration_source: "data2content",
        events: [
          {
            id: input.eventId,
            type: "subscription_created",
            timestamp_ms: input.timestampMs,
            ...(oppref ? { oppref } : {}),
            source_url: input.sourceUrl,
            action_source: "web",
            ...(Object.keys(user).length > 0 ? { user } : {}),
            data: {
              type: "plan_enrollment",
              plan_id: input.planId,
            },
          },
        ],
      }),
      signal: AbortSignal.timeout(5_000),
    },
  );

  if (!response.ok) {
    throw new Error(`OpenAI Conversions API respondeu com status ${response.status}.`);
  }

  return { delivered: true, status: response.status, validateOnly };
}
