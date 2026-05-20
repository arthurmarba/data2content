export interface MobileStrategicProfileSnapshotPayload {
  schemaVersion: "mobile_strategic_profile_snapshot_v1";
  profileState: string;
  unlockedSignals: string[];
  pendingSignals: string[];
  recurringPatterns: string[];
  opportunities: string[];
  diagnosisSummary: string;
  commercialSummary: string;
  lastAnalysisSummary: string;
  extraData?: Record<string, any>;
}

export interface CreatorStrategicProfileSnapshotInput {
  userId: string;
  status?: "active" | "inactive" | "archived";
  accessLevel: "free" | "premium" | "instagram_optimized";
  snapshot: MobileStrategicProfileSnapshotPayload;
  source: "manual_seed" | "mock_analysis" | "future_video_analysis" | "gemini_ready" | "gemini_fixture" | "imported" | "unknown";
  lastAnalyzedAt?: Date;
}
