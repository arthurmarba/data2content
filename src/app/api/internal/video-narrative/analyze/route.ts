import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import {
  canAccessInternalPreview,
  type InternalPreviewUser,
} from "@/app/dashboard/boards/internalPreviewAccess";
import {
  createBlockedVideoNarrativeGuardResult,
  createPassedVideoNarrativeGuardResult,
  summarizeVideoNarrativeGuardResults,
  type VideoNarrativeGuardPipelineSummary,
  type VideoNarrativeGuardResult,
} from "@/app/dashboard/boards/videoUpload/videoNarrativeGuardContracts";
import { isVideoNarrativeInternalEndpointEnabled } from "@/app/dashboard/boards/videoUpload/videoNarrativeInternalEndpointFeatureFlag";
import { validateVideoNarrativeConsentRetentionForPhase } from "@/app/dashboard/boards/videoUpload/videoNarrativeConsentRetentionGuards";
import { validateVideoNarrativeInputSourceForPhase } from "@/app/dashboard/boards/videoUpload/videoNarrativeInputSourceGuards";
import {
  buildVideoNarrativeObservabilityEvent,
  createVideoNarrativeRequestId,
  type VideoNarrativeObservabilityEventPayload,
  type VideoNarrativeObservabilityStatus,
} from "@/app/dashboard/boards/videoUpload/videoNarrativeObservabilityEvents";
import { validateVideoNarrativeAnalyzePayload } from "@/app/dashboard/boards/videoUpload/videoNarrativePayloadValidation";
import {
  buildBlockedVideoNarrativeSafeResponse,
  validateVideoNarrativeSafeResponse,
  type VideoNarrativeSafeIssue,
  type VideoNarrativeSafeResponse,
  type VideoNarrativeSafeResponseStatus,
} from "@/app/dashboard/boards/videoUpload/videoNarrativeSafeResponseBuilder";
import * as usageQuotaGuards from "@/app/dashboard/boards/videoUpload/videoNarrativeUsageQuotaGuards";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

const PHASE = "internal_endpoint" as const;
const REQUEST_ID = createVideoNarrativeRequestId("video-narrative-endpoint-skeleton");
const CREATED_AT = new Date(0).toISOString();
const DEFAULT_EXPIRES_AT = new Date(60 * 60 * 1000).toISOString();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createSafeIssue(params: {
  code: string;
  message: string;
  severity?: VideoNarrativeSafeIssue["severity"];
}): VideoNarrativeSafeIssue {
  return {
    code: params.code,
    message: params.message,
    severity: params.severity ?? "blocking",
  };
}

function createEvent(params: {
  eventName: VideoNarrativeObservabilityEventPayload["eventName"];
  status: VideoNarrativeObservabilityStatus;
  providerStatus?: string | null;
  guardBlockedBy?: string | null;
  issuesCount?: number | null;
}): VideoNarrativeObservabilityEventPayload | null {
  const result = buildVideoNarrativeObservabilityEvent({
    requestId: REQUEST_ID,
    eventName: params.eventName,
    status: params.status,
    source: PHASE,
    createdAt: CREATED_AT,
    providerStatus: params.providerStatus,
    guardBlockedBy: params.guardBlockedBy,
    issuesCount: params.issuesCount,
    hasRawText: false,
    fallbackUsed: false,
    schemaParseOk: null,
    quotaConsumed: false,
  });

  return result.ok ? result.event : null;
}

function compactEvents(
  events: Array<VideoNarrativeObservabilityEventPayload | null>,
): VideoNarrativeObservabilityEventPayload[] {
  return events.filter((event): event is VideoNarrativeObservabilityEventPayload => Boolean(event));
}

function buildGuardSummary(results: VideoNarrativeGuardResult[]): VideoNarrativeGuardPipelineSummary {
  return summarizeVideoNarrativeGuardResults(results);
}

function buildSafeJsonResponse(
  response: VideoNarrativeSafeResponse,
  status: number,
): NextResponse<VideoNarrativeSafeResponse> {
  const validation = validateVideoNarrativeSafeResponse(response);

  if (validation.ok) {
    return NextResponse.json(response, { status });
  }

  const fallback = buildBlockedVideoNarrativeSafeResponse({
    status: "blocked",
    issues: [
      createSafeIssue({
        code: "unsafe_response",
        message: "Resposta segura não validada.",
      }),
    ],
  });

  return NextResponse.json(fallback, { status: 500 });
}

function buildBlockedResponse(params: {
  httpStatus: number;
  status?: VideoNarrativeSafeResponseStatus;
  issue: VideoNarrativeSafeIssue;
  guardResults: VideoNarrativeGuardResult[];
  eventStatus?: VideoNarrativeObservabilityStatus;
  providerStatus?: string | null;
}): NextResponse<VideoNarrativeSafeResponse> {
  const guardSummary = buildGuardSummary(params.guardResults);
  const events = compactEvents([
    createEvent({
      eventName: "video_narrative_analysis_requested",
      status: "requested",
      providerStatus: params.providerStatus,
      issuesCount: 0,
    }),
    createEvent({
      eventName: "video_narrative_analysis_started",
      status: "started",
      providerStatus: params.providerStatus,
      issuesCount: 0,
    }),
    createEvent({
      eventName:
        params.eventStatus === "blocked"
          ? "video_narrative_limit_reached"
          : "video_narrative_analysis_failed",
      status: params.eventStatus ?? "failed",
      providerStatus: params.providerStatus,
      guardBlockedBy: guardSummary.blockedBy?.name ?? null,
      issuesCount: 1,
    }),
  ]);

  return buildSafeJsonResponse(
    buildBlockedVideoNarrativeSafeResponse({
      status: params.status ?? "blocked",
      issues: [params.issue],
      guardSummary,
      observabilityEvents: events,
    }),
    params.httpStatus,
  );
}

function getExpiresAtFromPayload(payload: unknown): string {
  if (!isRecord(payload) || typeof payload.expiresAt !== "string") {
    return DEFAULT_EXPIRES_AT;
  }

  return payload.expiresAt;
}

function methodNotAllowedResponse(): NextResponse<VideoNarrativeSafeResponse> {
  return buildBlockedResponse({
    httpStatus: 405,
    issue: createSafeIssue({
      code: "method_not_allowed",
      message: "Método não permitido.",
    }),
    guardResults: [
      createBlockedVideoNarrativeGuardResult({
        name: "method",
        code: "method_not_allowed",
        message: "Método não permitido.",
      }),
    ],
  });
}

export async function GET(): Promise<NextResponse<VideoNarrativeSafeResponse>> {
  return methodNotAllowedResponse();
}

export async function PUT(): Promise<NextResponse<VideoNarrativeSafeResponse>> {
  return methodNotAllowedResponse();
}

export async function PATCH(): Promise<NextResponse<VideoNarrativeSafeResponse>> {
  return methodNotAllowedResponse();
}

export async function DELETE(): Promise<NextResponse<VideoNarrativeSafeResponse>> {
  return methodNotAllowedResponse();
}

export async function POST(request: Request): Promise<NextResponse<VideoNarrativeSafeResponse>> {
  const methodGuard = createPassedVideoNarrativeGuardResult("method");

  if (!isVideoNarrativeInternalEndpointEnabled()) {
    return buildBlockedResponse({
      httpStatus: 403,
      status: "disabled",
      issue: createSafeIssue({
        code: "disabled",
        message: "Endpoint interno de vídeo desativado.",
      }),
      guardResults: [
        methodGuard,
        createBlockedVideoNarrativeGuardResult({
          name: "feature_flag",
          code: "disabled",
          message: "Flag server-side desativada.",
        }),
      ],
      providerStatus: "endpoint_disabled",
    });
  }

  const session = (await getServerSession(await resolveAuthOptions())) as {
    user?: InternalPreviewUser | null;
  } | null;
  const user = session?.user ?? null;
  const sessionGuard = user
    ? createPassedVideoNarrativeGuardResult("session")
    : createBlockedVideoNarrativeGuardResult({
        name: "session",
        code: "unauthorized",
        message: "Sessão não informada.",
      });

  if (!user) {
    return buildBlockedResponse({
      httpStatus: 401,
      issue: createSafeIssue({
        code: "unauthorized",
        message: "Sessão não informada.",
      }),
      guardResults: [methodGuard, sessionGuard],
    });
  }

  const adminDevGuard = canAccessInternalPreview(user)
    ? createPassedVideoNarrativeGuardResult("admin_dev")
    : createBlockedVideoNarrativeGuardResult({
        name: "admin_dev",
        code: "forbidden",
        message: "Acesso interno não permitido.",
      });

  if (adminDevGuard.status === "blocked") {
    return buildBlockedResponse({
      httpStatus: 403,
      issue: createSafeIssue({
        code: "forbidden",
        message: "Acesso interno não permitido.",
      }),
      guardResults: [methodGuard, sessionGuard, adminDevGuard],
    });
  }

  const featureFlagGuard = createPassedVideoNarrativeGuardResult("feature_flag");
  const contentType = request.headers.get("content-type") ?? "";
  const contentTypeGuard = contentType.toLowerCase().includes("application/json")
    ? createPassedVideoNarrativeGuardResult("content_type")
    : createBlockedVideoNarrativeGuardResult({
        name: "content_type",
        code: "invalid_content_type",
        message: "Content-type não validado.",
      });

  if (contentTypeGuard.status === "blocked") {
    return buildBlockedResponse({
      httpStatus: 400,
      issue: createSafeIssue({
        code: "invalid_content_type",
        message: "Content-type não validado.",
      }),
      guardResults: [methodGuard, sessionGuard, adminDevGuard, featureFlagGuard, contentTypeGuard],
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    const payloadGuard = createBlockedVideoNarrativeGuardResult({
      name: "payload_schema",
      code: "invalid_payload",
      message: "Payload não validado.",
    });

    return buildBlockedResponse({
      httpStatus: 400,
      issue: createSafeIssue({
        code: "invalid_payload",
        message: "Payload não validado.",
      }),
      guardResults: [
        methodGuard,
        sessionGuard,
        adminDevGuard,
        featureFlagGuard,
        contentTypeGuard,
        payloadGuard,
      ],
    });
  }

  const payloadValidation = validateVideoNarrativeAnalyzePayload(payload);
  if (!payloadValidation.ok || !payloadValidation.normalized) {
    return buildBlockedResponse({
      httpStatus: 400,
      issue: createSafeIssue({
        code: payloadValidation.issues[0]?.code ?? "invalid_payload",
        message: payloadValidation.issues[0]?.message ?? "Payload não validado.",
      }),
      guardResults: [
        methodGuard,
        sessionGuard,
        adminDevGuard,
        featureFlagGuard,
        contentTypeGuard,
        payloadValidation.guardResult,
      ],
    });
  }

  const inputSourceGuard = validateVideoNarrativeInputSourceForPhase({
    payload: payloadValidation.normalized,
    phase: PHASE,
  });

  if (!inputSourceGuard.ok) {
    return buildBlockedResponse({
      httpStatus: 400,
      issue: createSafeIssue({
        code: inputSourceGuard.issues[0]?.code ?? "invalid_source",
        message: inputSourceGuard.issues[0]?.message ?? "Origem do vídeo não validada.",
      }),
      guardResults: [
        methodGuard,
        sessionGuard,
        adminDevGuard,
        featureFlagGuard,
        contentTypeGuard,
        payloadValidation.guardResult,
        inputSourceGuard.guardResult,
      ],
    });
  }

  const consentRetentionGuard = validateVideoNarrativeConsentRetentionForPhase({
    phase: PHASE,
    isAdminOrDev: true,
    expiresAt: getExpiresAtFromPayload(payload),
    now: CREATED_AT,
  });

  if (!consentRetentionGuard.ok) {
    return buildBlockedResponse({
      httpStatus: 400,
      issue: createSafeIssue({
        code: consentRetentionGuard.issues[0]?.code ?? "retention_expired",
        message: consentRetentionGuard.issues[0]?.message ?? "Retenção não validada.",
      }),
      guardResults: [
        methodGuard,
        sessionGuard,
        adminDevGuard,
        featureFlagGuard,
        contentTypeGuard,
        payloadValidation.guardResult,
        inputSourceGuard.guardResult,
        consentRetentionGuard.consentGuardResult,
        consentRetentionGuard.retentionGuardResult,
      ],
    });
  }

  const usageQuotaGuard = usageQuotaGuards.validateVideoNarrativeUsageQuotaForPhase({
    phase: PHASE,
    usageState: {
      usedToday: 0,
      usedThisMonth: 0,
      repeatedFailureCount: 0,
      isAdminOrDev: true,
      now: CREATED_AT,
    },
  });

  if (!usageQuotaGuard.ok) {
    return buildBlockedResponse({
      httpStatus: 429,
      status: "usage_limited",
      issue: createSafeIssue({
        code: usageQuotaGuard.issues[0]?.code ?? "usage_limited",
        message: usageQuotaGuard.issues[0]?.message ?? "Uso não disponível.",
      }),
      guardResults: [
        methodGuard,
        sessionGuard,
        adminDevGuard,
        featureFlagGuard,
        contentTypeGuard,
        payloadValidation.guardResult,
        inputSourceGuard.guardResult,
        consentRetentionGuard.consentGuardResult,
        consentRetentionGuard.retentionGuardResult,
        usageQuotaGuard.guardResult,
      ],
      eventStatus: "blocked",
    });
  }

  const observabilityStartGuard = createPassedVideoNarrativeGuardResult("observability_start");
  const providerGuard = createBlockedVideoNarrativeGuardResult({
    name: "provider",
    code: "disabled",
    message: "Provider real desativado nesta fase.",
  });
  const guardResults = [
    methodGuard,
    sessionGuard,
    adminDevGuard,
    featureFlagGuard,
    contentTypeGuard,
    payloadValidation.guardResult,
    inputSourceGuard.guardResult,
    consentRetentionGuard.consentGuardResult,
    consentRetentionGuard.retentionGuardResult,
    usageQuotaGuard.guardResult,
    observabilityStartGuard,
    providerGuard,
  ];
  const guardSummary = buildGuardSummary(guardResults);
  const events = compactEvents([
    createEvent({
      eventName: "video_narrative_analysis_requested",
      status: "requested",
      providerStatus: "skeleton",
      issuesCount: 0,
    }),
    createEvent({
      eventName: "video_narrative_analysis_started",
      status: "started",
      providerStatus: "skeleton",
      issuesCount: 0,
    }),
    createEvent({
      eventName: "video_narrative_analysis_failed",
      status: "blocked",
      providerStatus: "provider_disabled_in_skeleton",
      guardBlockedBy: guardSummary.blockedBy?.name ?? null,
      issuesCount: 1,
    }),
  ]);

  return buildSafeJsonResponse(
    buildBlockedVideoNarrativeSafeResponse({
      status: "disabled",
      issues: [
        createSafeIssue({
          code: "provider_disabled_in_skeleton",
          message: "Provider real desativado nesta fase.",
        }),
      ],
      guardSummary,
      observabilityEvents: events,
    }),
    200,
  );
}
