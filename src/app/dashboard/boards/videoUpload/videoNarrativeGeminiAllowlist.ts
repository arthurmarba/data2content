import type { VideoNarrativeAiIssue } from "./videoNarrativeAiProviderTypes";

type EnvLike = NodeJS.ProcessEnv | Record<string, string | undefined>;

export type VideoNarrativeGeminiAllowlistUser = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
  isAdmin?: boolean | null;
  isDev?: boolean | null;
};

export type VideoNarrativeGeminiAllowlistResult =
  | { ok: true; reason: "admin_dev_user" | "email_allowlist" | "user_id_allowlist" }
  | { ok: false; issues: VideoNarrativeAiIssue[] };

function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

export function evaluateVideoNarrativeGeminiAllowlist(params: {
  user: VideoNarrativeGeminiAllowlistUser;
  env?: EnvLike;
}): VideoNarrativeGeminiAllowlistResult {
  const env = params.env ?? process.env;
  const user = params.user;

  if (!parseBoolean(env.VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED)) {
    return {
      ok: false,
      issues: [
        {
          code: "gemini_allowlist_disabled",
          severity: "blocker",
          message: "Provider multimodal real indisponível nesta fase.",
        },
      ],
    };
  }

  if (user.isAdmin || user.isDev || user.role === "admin" || user.role === "dev") {
    return { ok: true, reason: "admin_dev_user" };
  }

  const normalizedEmail = user.email?.trim().toLowerCase();
  const allowedEmails = parseList(env.VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS).map((email) => email.toLowerCase());
  if (normalizedEmail && allowedEmails.includes(normalizedEmail)) {
    return { ok: true, reason: "email_allowlist" };
  }

  const userId = user.id?.trim();
  const allowedUserIds = parseList(env.VIDEO_NARRATIVE_GEMINI_ALLOWED_USER_IDS);
  if (userId && allowedUserIds.includes(userId)) {
    return { ok: true, reason: "user_id_allowlist" };
  }

  return {
    ok: false,
    issues: [
      {
        code: "gemini_user_not_allowed",
        severity: "blocker",
        message: "Provider multimodal real indisponível para este usuário.",
      },
    ],
  };
}
