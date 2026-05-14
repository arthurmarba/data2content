export type VideoProcessingStatus =
  | "pending"
  | "extracting_metadata"
  | "transcribing"
  | "extracting_frames"
  | "extracting_ocr"
  | "summarizing"
  | "completed"
  | "failed";

export type VideoTranscriptSegment = {
  startSeconds: number;
  endSeconds: number;
  text: string;
  confidence: number | null;
};

export type VideoTranscriptArtifact = {
  fullText: string | null;
  language: string | null;
  segments: VideoTranscriptSegment[];
  provider: "future_openai" | "future_assemblyai" | "manual" | "unknown";
};

export type VideoFrameArtifact = {
  id: string;
  timestampSeconds: number;
  label: "opening" | "middle" | "closing" | "scene_change" | "manual" | "unknown";
  description: string | null;
  imageStorageKey: string | null;
};

export type VideoOcrArtifact = {
  timestampSeconds: number;
  text: string;
  confidence: number | null;
};

export type VideoTechnicalSignal = {
  type:
    | "duration"
    | "opening_density"
    | "face_presence"
    | "camera_movement"
    | "text_overlay"
    | "scene_change"
    | "audio_presence"
    | "unknown";
  value: string;
  confidence: number | null;
};

export type VideoProcessingArtifacts = {
  status: VideoProcessingStatus;
  transcript: VideoTranscriptArtifact;
  frames: VideoFrameArtifact[];
  ocr: VideoOcrArtifact[];
  technicalSignals: VideoTechnicalSignal[];
  visualSummary: string | null;
  processingNotes: string[];
};

function normalizeText(value: string | null): string {
  return value?.trim().replace(/\s+/g, " ") || "";
}

export function createEmptyVideoProcessingArtifacts(): VideoProcessingArtifacts {
  return {
    status: "pending",
    transcript: {
      fullText: null,
      language: null,
      segments: [],
      provider: "unknown",
    },
    frames: [],
    ocr: [],
    technicalSignals: [],
    visualSummary: null,
    processingNotes: [],
  };
}

export function mergeTranscriptSegments(segments: VideoTranscriptSegment[]): string {
  return [...segments]
    .sort((a, b) => a.startSeconds - b.startSeconds)
    .map((segment) => normalizeText(segment.text))
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function buildTranscriptTextFromArtifacts(artifacts: VideoProcessingArtifacts): string | null {
  const fullText = normalizeText(artifacts.transcript.fullText);
  if (fullText) return fullText;

  const segmentText = mergeTranscriptSegments(artifacts.transcript.segments);
  return segmentText || null;
}

export function buildVisualDescriptionFromArtifacts(artifacts: VideoProcessingArtifacts): string | null {
  const visualSummary = normalizeText(artifacts.visualSummary);
  if (visualSummary) return visualSummary;

  const frameDescriptions = artifacts.frames
    .slice()
    .sort((a, b) => a.timestampSeconds - b.timestampSeconds)
    .map((frame) => normalizeText(frame.description))
    .filter(Boolean);
  const ocrTexts = artifacts.ocr
    .slice()
    .sort((a, b) => a.timestampSeconds - b.timestampSeconds)
    .map((item) => normalizeText(item.text))
    .filter(Boolean);
  const parts: string[] = [];

  if (frameDescriptions.length > 0) {
    parts.push(`Frames: ${frameDescriptions.join(" ")}`);
  }

  if (ocrTexts.length > 0) {
    parts.push(`Texto na tela: ${ocrTexts.join(" ")}`);
  }

  return parts.length > 0 ? parts.join(" ") : null;
}

export function hasUsableVideoProcessingArtifacts(artifacts: VideoProcessingArtifacts): boolean {
  if (buildTranscriptTextFromArtifacts(artifacts)) return true;
  if (buildVisualDescriptionFromArtifacts(artifacts)) return true;

  return artifacts.technicalSignals.some((signal) => signal.type !== "unknown" && Boolean(normalizeText(signal.value)));
}
