import { connectToDatabase } from "@/app/lib/mongoose";
import CreatorVideoNarrativeDiagnosis from "@/app/models/CreatorVideoNarrativeDiagnosis";
import { Types } from "mongoose";
import type {
  CreatorVideoNarrativeDiagnosisCommercialReading,
  CreatorVideoNarrativeDiagnosisDocument,
  CreatorVideoNarrativeEvidenceAnchors,
  CreatorVideoNarrativeDiagnosisProductionReading,
  CreatorVideoNarrativeDiagnosisProfileContribution,
  CreatorVideoNarrativeDiagnosisSafetyFlags,
  CreatorVideoNarrativeDiagnosisSpeechReading,
  CreatorVideoNarrativeDiagnosisStatus,
  CreatorVideoNarrativeDiagnosisStrategicRecommendation,
  CreatorVideoNarrativeDiagnosisVideoReading,
  VideoNarrativeContentContext,
  VideoNarrativeCoherence,
} from "./creatorVideoNarrativeDiagnosisTypes";

export interface CreatorVideoNarrativeDiagnosisSafeReading {
  userId: string;
  diagnosisId: string;
  status: CreatorVideoNarrativeDiagnosisStatus;
  videoReading: CreatorVideoNarrativeDiagnosisVideoReading;
  speechReading: CreatorVideoNarrativeDiagnosisSpeechReading;
  productionReading: CreatorVideoNarrativeDiagnosisProductionReading;
  commercialReading: CreatorVideoNarrativeDiagnosisCommercialReading;
  strategicRecommendation: CreatorVideoNarrativeDiagnosisStrategicRecommendation;
  profileContribution: CreatorVideoNarrativeDiagnosisProfileContribution;
  evidenceAnchors?: CreatorVideoNarrativeEvidenceAnchors;
  /** Structured life-asset dimensions extracted from watching the video. */
  contentContext?: VideoNarrativeContentContext;
  /** Coherence verdict against the creator's confirmed top-performing pattern. */
  narrativeCoherence?: VideoNarrativeCoherence;
  /** Creator's answers to the adaptive quiz shown on the confirmation step. */
  confirmationQuizAnswers?: Array<{
    questionId: string;
    questionText: string;
    answerId: string;
    answerValue: string;
    answeredAt?: Date;
  }>;
  safetyFlags: CreatorVideoNarrativeDiagnosisSafetyFlags;
  createdAt?: Date;
  updatedAt?: Date;
  analyzedAt?: Date;
}

export interface ListCreatorVideoNarrativeDiagnosesForUserParams {
  userId: string;
  limit?: number;
}

export interface GetCreatorVideoNarrativeDiagnosisForUserParams {
  userId: string;
  diagnosisId: string;
}

const DEFAULT_RECENT_LIMIT = 6;
const MAX_RECENT_LIMIT = 12;

function assertValidUserId(userId: string): void {
  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new Error("UserId inválido");
  }
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return DEFAULT_RECENT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit ?? DEFAULT_RECENT_LIMIT), 1), MAX_RECENT_LIMIT);
}

function asDate(value: unknown): Date | undefined {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : undefined;
  }
  return undefined;
}

export function mapCreatorVideoNarrativeDiagnosisToSafeReading(
  doc: CreatorVideoNarrativeDiagnosisDocument & { userId?: unknown },
): CreatorVideoNarrativeDiagnosisSafeReading {
  return {
    userId: typeof doc.userId === "string" ? doc.userId : String(doc.userId),
    diagnosisId: doc.diagnosisId,
    status: doc.status,
    videoReading: doc.videoReading,
    speechReading: doc.speechReading,
    productionReading: doc.productionReading,
    commercialReading: doc.commercialReading,
    strategicRecommendation: doc.strategicRecommendation,
    profileContribution: doc.profileContribution,
    evidenceAnchors: doc.evidenceAnchors,
    contentContext: (doc as unknown as { contentContext?: VideoNarrativeContentContext }).contentContext,
    narrativeCoherence: (doc as unknown as { narrativeCoherence?: VideoNarrativeCoherence }).narrativeCoherence,
    confirmationQuizAnswers: (doc as unknown as { confirmationQuizAnswers?: CreatorVideoNarrativeDiagnosisSafeReading["confirmationQuizAnswers"] }).confirmationQuizAnswers,
    safetyFlags: doc.safetyFlags,
    createdAt: asDate(doc.createdAt),
    updatedAt: asDate(doc.updatedAt),
    analyzedAt: asDate(doc.videoMetadata?.analyzedAt),
  };
}

function queryProjection() {
  return {
    userId: 1,
    diagnosisId: 1,
    status: 1,
    videoReading: 1,
    speechReading: 1,
    productionReading: 1,
    commercialReading: 1,
    strategicRecommendation: 1,
    profileContribution: 1,
    evidenceAnchors: 1,
    contentContext: 1,
    narrativeCoherence: 1,
    confirmationQuizAnswers: 1,
    safetyFlags: 1,
    "videoMetadata.analyzedAt": 1,
    createdAt: 1,
    updatedAt: 1,
  };
}

export async function listCreatorVideoNarrativeDiagnosesForUser(
  params: ListCreatorVideoNarrativeDiagnosesForUserParams,
): Promise<CreatorVideoNarrativeDiagnosisSafeReading[]> {
  assertValidUserId(params.userId);
  await connectToDatabase();

  const docs = await CreatorVideoNarrativeDiagnosis.find({
    userId: new Types.ObjectId(params.userId),
  })
    .select(queryProjection())
    .sort({ "videoMetadata.analyzedAt": -1, createdAt: -1 })
    .limit(normalizeLimit(params.limit))
    .lean();

  return docs.map((doc) =>
    mapCreatorVideoNarrativeDiagnosisToSafeReading(doc as unknown as CreatorVideoNarrativeDiagnosisDocument),
  );
}

export async function getCreatorVideoNarrativeDiagnosisForUser(
  params: GetCreatorVideoNarrativeDiagnosisForUserParams,
): Promise<CreatorVideoNarrativeDiagnosisSafeReading | null> {
  assertValidUserId(params.userId);
  if (!params.diagnosisId?.trim()) {
    throw new Error("DiagnosisId inválido");
  }
  await connectToDatabase();

  const doc = await CreatorVideoNarrativeDiagnosis.findOne({
    userId: new Types.ObjectId(params.userId),
    diagnosisId: params.diagnosisId.trim(),
  })
    .select(queryProjection())
    .lean();

  return doc
    ? mapCreatorVideoNarrativeDiagnosisToSafeReading(doc as unknown as CreatorVideoNarrativeDiagnosisDocument)
    : null;
}

export async function listRecentCreatorVideoNarrativeDiagnosesForUser(
  params: ListCreatorVideoNarrativeDiagnosesForUserParams,
): Promise<CreatorVideoNarrativeDiagnosisSafeReading[]> {
  return listCreatorVideoNarrativeDiagnosesForUser(params);
}
