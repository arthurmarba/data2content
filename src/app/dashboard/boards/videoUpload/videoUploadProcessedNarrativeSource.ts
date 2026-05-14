import type { NarrativeSource } from "../narrativeSource/narrativeSourceTypes";
import {
  buildTranscriptTextFromArtifacts,
  buildVisualDescriptionFromArtifacts,
  hasUsableVideoProcessingArtifacts,
  type VideoProcessingArtifacts,
} from "./videoProcessingArtifacts";
import { buildNarrativeSourceFromVideoUploadDraft } from "./videoUploadNarrativeSourceBridge";
import type { VideoUploadDraft, VideoUploadLimits } from "./videoUploadTypes";

type BuildProcessedNarrativeSourceFromVideoUploadParams = {
  draft: VideoUploadDraft;
  artifacts: VideoProcessingArtifacts;
  id?: string;
  createdAt?: string | null;
  limits?: VideoUploadLimits;
};

type HasEnoughProcessedContextForNarrativeAnalysisParams = {
  draft: VideoUploadDraft;
  artifacts: VideoProcessingArtifacts;
  limits?: VideoUploadLimits;
};

export function buildProcessedNarrativeSourceFromVideoUpload({
  draft,
  artifacts,
  id,
  createdAt,
  limits,
}: BuildProcessedNarrativeSourceFromVideoUploadParams): NarrativeSource | null {
  const baseSource = buildNarrativeSourceFromVideoUploadDraft({
    draft,
    id,
    createdAt,
    limits,
  });

  if (!baseSource) return null;

  return {
    ...baseSource,
    rawText: null,
    transcript: buildTranscriptTextFromArtifacts(artifacts),
    visualDescription: buildVisualDescriptionFromArtifacts(artifacts),
  };
}

export function hasEnoughProcessedContextForNarrativeAnalysis({
  draft,
  artifacts,
  limits,
}: HasEnoughProcessedContextForNarrativeAnalysisParams): boolean {
  const baseSource = buildNarrativeSourceFromVideoUploadDraft({
    draft,
    limits,
  });

  return Boolean(baseSource && hasUsableVideoProcessingArtifacts(artifacts));
}
