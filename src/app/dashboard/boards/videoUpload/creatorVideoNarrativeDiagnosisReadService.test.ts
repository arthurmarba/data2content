import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import CreatorVideoNarrativeDiagnosis from "@/app/models/CreatorVideoNarrativeDiagnosis";
import { buildCreatorVideoNarrativeDiagnosisFixture } from "./creatorVideoNarrativeDiagnosisFixtures";
import {
  getCreatorVideoNarrativeDiagnosisForUser,
  listRecentCreatorVideoNarrativeDiagnosesForUser,
  mapCreatorVideoNarrativeDiagnosisToSafeReading,
  readingFeedsNarrativeMap,
} from "./creatorVideoNarrativeDiagnosisReadService";

jest.mock("@/app/lib/mongoose", () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock("@/app/models/CreatorVideoNarrativeDiagnosis", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

const mockConnect = connectToDatabase as jest.Mock;
const mockFind = CreatorVideoNarrativeDiagnosis.find as jest.Mock;
const mockFindOne = CreatorVideoNarrativeDiagnosis.findOne as jest.Mock;

function doc(params: { userId: string; diagnosisId: string; createdAt: string; analyzedAt?: string }) {
  const input = buildCreatorVideoNarrativeDiagnosisFixture({
    userId: params.userId,
    diagnosisId: params.diagnosisId,
  });
  return {
    ...input,
    userId: new Types.ObjectId(params.userId),
    videoMetadata: {
      ...input.videoMetadata,
      analyzedAt: params.analyzedAt ? new Date(params.analyzedAt) : undefined,
      objectKey: "blocked",
      signedUrl: "blocked",
      uploadUrl: "blocked",
      thumbnailUrl: "blocked",
      localPath: "blocked",
      storageProviderPath: "blocked",
    },
    safetyFlags: {
      containsPersistedVideoReference: false,
      containsSignedUrl: false,
      containsObjectKey: false,
      containsRawModelResponse: false,
      containsLongTranscript: false,
      sanitized: true,
    },
    createdAt: new Date(params.createdAt),
    updatedAt: new Date(params.createdAt),
    objectKey: "blocked",
    signedUrl: "blocked",
    uploadUrl: "blocked",
    thumbnailUrl: "blocked",
    localPath: "blocked",
    storageProviderPath: "blocked",
  };
}

function mockFindChain(result: unknown[]) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
  mockFind.mockReturnValue(chain);
  return chain;
}

function mockFindOneChain(result: unknown | null) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
  mockFindOne.mockReturnValue(chain);
  return chain;
}

describe("creatorVideoNarrativeDiagnosisReadService", () => {
  const userId = new Types.ObjectId().toString();
  const otherUserId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
  });

  it("lista leituras recentes por userId com ordenação e limite", async () => {
    const chain = mockFindChain([
      doc({ userId, diagnosisId: "newer", createdAt: "2026-05-20T10:00:00.000Z" }),
      doc({ userId, diagnosisId: "older", createdAt: "2026-05-18T10:00:00.000Z" }),
    ]);

    const result = await listRecentCreatorVideoNarrativeDiagnosesForUser({ userId, limit: 2 });

    expect(mockConnect).toHaveBeenCalled();
    expect(mockFind).toHaveBeenCalledWith({ userId: new Types.ObjectId(userId) });
    expect(chain.sort).toHaveBeenCalledWith({ "videoMetadata.analyzedAt": -1, createdAt: -1 });
    expect(chain.limit).toHaveBeenCalledWith(2);
    expect(result.map((reading) => reading.diagnosisId)).toEqual(["newer", "older"]);
  });

  it("busca leitura por diagnosisId e userId", async () => {
    mockFindOneChain(doc({ userId, diagnosisId: "diagnosis-safe", createdAt: "2026-05-20T10:00:00.000Z" }));

    const result = await getCreatorVideoNarrativeDiagnosisForUser({ userId, diagnosisId: "diagnosis-safe" });

    expect(mockFindOne).toHaveBeenCalledWith({
      userId: new Types.ObjectId(userId),
      diagnosisId: "diagnosis-safe",
    });
    expect(result?.diagnosisId).toBe("diagnosis-safe");
    expect(result?.userId).toBe(userId);
  });

  it("não retorna leitura de outro userId", async () => {
    mockFindOneChain(null);

    const result = await getCreatorVideoNarrativeDiagnosisForUser({ userId, diagnosisId: "other-user-reading" });

    expect(result).toBeNull();
    expect(mockFindOne).not.toHaveBeenCalledWith(expect.objectContaining({ userId: new Types.ObjectId(otherUserId) }));
  });

  it("retorna apenas shape seguro para UI", () => {
    const safe = mapCreatorVideoNarrativeDiagnosisToSafeReading(
      doc({ userId, diagnosisId: "diagnosis-safe-shape", createdAt: "2026-05-20T10:00:00.000Z" }) as any,
    );
    const serialized = JSON.stringify(safe);

    expect(safe.videoReading.rememberedAs).toBeTruthy();
    expect(safe.profileContribution.profileImpactPreview).toBeTruthy();
    expect(serialized).not.toContain("objectKey");
    expect(serialized).not.toContain("signedUrl");
    expect(serialized).not.toContain("uploadUrl");
    expect(serialized).not.toContain("thumbnailUrl");
    expect(serialized).not.toContain("localPath");
    expect(serialized).not.toContain("storageProviderPath");
  });

  it("limita quantidade de leituras recentes", async () => {
    const chain = mockFindChain([]);

    await listRecentCreatorVideoNarrativeDiagnosesForUser({ userId, limit: 99 });

    expect(chain.limit).toHaveBeenCalledWith(12);
  });

  describe("readingFeedsNarrativeMap (contrato binário do publishIntent)", () => {
    it("exclui apenas leituras 'no'", () => {
      expect(readingFeedsNarrativeMap({ publishIntent: "no" })).toBe(false);
    });

    it("inclui 'yes'", () => {
      expect(readingFeedsNarrativeMap({ publishIntent: "yes" })).toBe(true);
    });

    it("inclui leituras legadas (null/undefined) com peso pleno", () => {
      expect(readingFeedsNarrativeMap({ publishIntent: null })).toBe(true);
      expect(readingFeedsNarrativeMap({})).toBe(true);
    });
  });
});
