import type { NarrativeSource } from "../narrativeSource/narrativeSourceTypes";
import type { VideoUploadDraft, VideoUploadLimits } from "./videoUploadTypes";
import { DEFAULT_VIDEO_UPLOAD_LIMITS, validateVideoUploadDraft } from "./videoUploadTypes";

type BuildNarrativeSourceFromVideoUploadDraftParams = {
  draft: VideoUploadDraft;
  id?: string;
  createdAt?: string | null;
  limits?: VideoUploadLimits;
};

function getNarrativeVideoFormat(durationSeconds: number | null): "short_video" | "long_video" | "unknown" {
  if (durationSeconds === null) return "unknown";
  return durationSeconds <= 90 ? "short_video" : "long_video";
}

export function isVideoUploadReadyForNarrativeSource(
  draft: VideoUploadDraft,
  limits: VideoUploadLimits = DEFAULT_VIDEO_UPLOAD_LIMITS,
): boolean {
  return validateVideoUploadDraft(draft, limits).ok;
}

export function buildNarrativeSourceFromVideoUploadDraft({
  draft,
  id,
  createdAt,
  limits = DEFAULT_VIDEO_UPLOAD_LIMITS,
}: BuildNarrativeSourceFromVideoUploadDraftParams): NarrativeSource | null {
  const validation = validateVideoUploadDraft(draft, limits);
  if (!validation.ok) return null;

  const { normalizedDraft } = validation;

  return {
    id: id || normalizedDraft.id,
    sourceType: "video_upload_future",
    rawText: null,
    creatorQuestion: normalizedDraft.creatorQuestion,
    transcript: null,
    visualDescription: null,
    metadata: {
      title: normalizedDraft.fileName,
      durationSeconds: normalizedDraft.durationSeconds,
      platform: "unknown",
      format: getNarrativeVideoFormat(normalizedDraft.durationSeconds),
      campaignContext: null,
    },
    createdAt: createdAt ?? normalizedDraft.createdAt ?? null,
  };
}
