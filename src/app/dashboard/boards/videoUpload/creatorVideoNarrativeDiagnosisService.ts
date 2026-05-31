import { connectToDatabase } from "@/app/lib/mongoose";
import CreatorVideoNarrativeDiagnosis from "@/app/models/CreatorVideoNarrativeDiagnosis";
import { Types } from "mongoose";
import { sanitizeCreatorVideoNarrativeDiagnosisInput } from "./creatorVideoNarrativeDiagnosisSanitizer";
import type {
  CreatorVideoNarrativeDiagnosisDocument,
  CreatorVideoNarrativeDiagnosisInput,
} from "./creatorVideoNarrativeDiagnosisTypes";

function assertValidUserId(userId: string): void {
  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new Error("UserId inválido");
  }
}

function mapDiagnosisDoc(doc: any): CreatorVideoNarrativeDiagnosisDocument {
  return {
    userId: doc.userId.toString(),
    diagnosisId: doc.diagnosisId,
    status: doc.status,
    source: doc.source,
    videoMetadata: doc.videoMetadata ?? {},
    creatorGoal: doc.creatorGoal,
    selectedGoalOption: doc.selectedGoalOption,
    videoReading: doc.videoReading,
    speechReading: doc.speechReading,
    productionReading: doc.productionReading,
    commercialReading: doc.commercialReading,
    strategicRecommendation: doc.strategicRecommendation,
    profileContribution: doc.profileContribution,
    safetyFlags: doc.safetyFlags,
    schemaVersion: doc.schemaVersion,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function createCreatorVideoNarrativeDiagnosis(
  input: CreatorVideoNarrativeDiagnosisInput,
): Promise<CreatorVideoNarrativeDiagnosisDocument> {
  assertValidUserId(input.userId);

  const sanitized = sanitizeCreatorVideoNarrativeDiagnosisInput(input);

  await connectToDatabase();

  const createdDoc = await CreatorVideoNarrativeDiagnosis.create({
    ...sanitized,
    userId: new Types.ObjectId(sanitized.userId),
  });

  return mapDiagnosisDoc(createdDoc);
}

export async function appendConfirmationQuizAnswer(params: {
  userId: string;
  diagnosisId: string;
  answer: {
    questionId: string;
    questionText: string;
    answerId: string;
    answerValue: string;
  };
}): Promise<{ ok: boolean }> {
  assertValidUserId(params.userId);
  if (!params.diagnosisId?.trim()) throw new Error("DiagnosisId inválido");

  await connectToDatabase();

  const result = await CreatorVideoNarrativeDiagnosis.findOneAndUpdate(
    { userId: new Types.ObjectId(params.userId), diagnosisId: params.diagnosisId.trim() },
    { $push: { confirmationQuizAnswers: { ...params.answer, answeredAt: new Date() } } },
    { new: false },
  ).lean();

  return { ok: result != null };
}

export async function getCreatorVideoNarrativeDiagnosisByUserAndDiagnosisId(params: {
  userId: string;
  diagnosisId: string;
}): Promise<CreatorVideoNarrativeDiagnosisDocument | null> {
  assertValidUserId(params.userId);
  if (!params.diagnosisId?.trim()) {
    throw new Error("DiagnosisId inválido");
  }

  await connectToDatabase();

  const doc = await CreatorVideoNarrativeDiagnosis.findOne({
    userId: new Types.ObjectId(params.userId),
    diagnosisId: params.diagnosisId.trim(),
  }).lean();

  return doc ? mapDiagnosisDoc(doc) : null;
}
