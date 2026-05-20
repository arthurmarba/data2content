import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import CreatorVideoNarrativeDiagnosis from "@/app/models/CreatorVideoNarrativeDiagnosis";
import CreatorStrategicProfileSnapshot from "@/app/models/CreatorStrategicProfileSnapshot";
import { buildCreatorVideoNarrativeDiagnosisFixture } from "./creatorVideoNarrativeDiagnosisFixtures";
import {
  createCreatorVideoNarrativeDiagnosis,
  getCreatorVideoNarrativeDiagnosisByUserAndDiagnosisId,
} from "./creatorVideoNarrativeDiagnosisService";

jest.mock("@/app/lib/mongoose", () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock("@/app/models/CreatorVideoNarrativeDiagnosis", () => ({
  create: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("@/app/models/CreatorStrategicProfileSnapshot", () => ({
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
  create: jest.fn(),
}));

const mockConnect = connectToDatabase as jest.Mock;
const mockCreate = CreatorVideoNarrativeDiagnosis.create as jest.Mock;
const mockFindOne = CreatorVideoNarrativeDiagnosis.findOne as jest.Mock;
const mockSnapshotFindOneAndUpdate = CreatorStrategicProfileSnapshot.findOneAndUpdate as jest.Mock;
const mockSnapshotUpdateOne = CreatorStrategicProfileSnapshot.updateOne as jest.Mock;
const mockSnapshotCreate = CreatorStrategicProfileSnapshot.create as jest.Mock;

describe("creatorVideoNarrativeDiagnosisService", () => {
  const userId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
  });

  it("cria um documento válido de leitura por vídeo", async () => {
    const input = buildCreatorVideoNarrativeDiagnosisFixture({ userId, diagnosisId: "diagnosis-1" });
    mockCreate.mockImplementation(async (doc) => ({
      ...doc,
      createdAt: new Date("2026-05-20T10:00:00.000Z"),
      updatedAt: new Date("2026-05-20T10:00:00.000Z"),
    }));

    const result = await createCreatorVideoNarrativeDiagnosis(input);

    expect(mockConnect).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: new Types.ObjectId(userId),
        diagnosisId: "diagnosis-1",
        schemaVersion: "creator_video_narrative_diagnosis_v1",
      }),
    );
    expect(result.userId).toBe(userId);
    expect(result.profileContribution.type).toBe("commercial_signal");
  });

  it("consulta por userId e diagnosisId", async () => {
    const input = buildCreatorVideoNarrativeDiagnosisFixture({ userId, diagnosisId: "diagnosis-2" });
    mockFindOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          ...input,
          userId: new Types.ObjectId(userId),
          videoMetadata: input.videoMetadata,
          safetyFlags: {
            containsPersistedVideoReference: false,
            containsSignedUrl: false,
            containsObjectKey: false,
            containsRawModelResponse: false,
            containsLongTranscript: false,
            sanitized: false,
          },
          schemaVersion: "creator_video_narrative_diagnosis_v1",
        }),
    });

    const result = await getCreatorVideoNarrativeDiagnosisByUserAndDiagnosisId({
      userId,
      diagnosisId: "diagnosis-2",
    });

    expect(mockFindOne).toHaveBeenCalledWith({
      userId: new Types.ObjectId(userId),
      diagnosisId: "diagnosis-2",
    });
    expect(result?.userId).toBe(userId);
    expect(result?.diagnosisId).toBe("diagnosis-2");
  });

  it("não altera CreatorStrategicProfileSnapshot ao criar a leitura do vídeo", async () => {
    const input = buildCreatorVideoNarrativeDiagnosisFixture({ userId, diagnosisId: "diagnosis-3" });
    mockCreate.mockImplementation(async (doc) => doc);

    await createCreatorVideoNarrativeDiagnosis(input);

    expect(mockSnapshotFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mockSnapshotUpdateOne).not.toHaveBeenCalled();
    expect(mockSnapshotCreate).not.toHaveBeenCalled();
  });
});
