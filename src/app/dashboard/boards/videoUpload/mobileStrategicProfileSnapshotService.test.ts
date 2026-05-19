import { Types } from "mongoose";
import {
  getStrategicProfileSnapshotByUserId,
  upsertStrategicProfileSnapshot,
  validateSnapshotPayload,
} from "./mobileStrategicProfileSnapshotService";
import CreatorStrategicProfileSnapshot from "@/app/models/CreatorStrategicProfileSnapshot";
import { connectToDatabase } from "@/app/lib/mongoose";

// Mock das dependências do Mongoose
jest.mock("@/app/models/CreatorStrategicProfileSnapshot", () => {
  return {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };
});

jest.mock("@/app/lib/mongoose", () => ({
  connectToDatabase: jest.fn(),
}));

const mockConnect = connectToDatabase as jest.Mock;
const mockFindOne = CreatorStrategicProfileSnapshot.findOne as jest.Mock;
const mockFindOneAndUpdate = CreatorStrategicProfileSnapshot.findOneAndUpdate as jest.Mock;

describe("mobileStrategicProfileSnapshotService", () => {
  const validUserId = new Types.ObjectId().toString();

  const validSnapshot = {
    schemaVersion: "mobile_strategic_profile_snapshot_v1" as const,
    profileState: "active",
    unlockedSignals: ["sinal1"],
    pendingSignals: ["sinal2"],
    recurringPatterns: ["padrao1"],
    opportunities: ["oportunidade1"],
    diagnosisSummary: "diagnostico",
    commercialSummary: "comercial",
    lastAnalysisSummary: "analise",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
  });

  describe("validateSnapshotPayload", () => {
    it("valida e retorna payload válido", () => {
      const result = validateSnapshotPayload(validSnapshot);
      expect(result.schemaVersion).toBe("mobile_strategic_profile_snapshot_v1");
      expect(result.profileState).toBe("active");
    });

    it("rejeita snapshot sem schemaVersion ou com versão errada", () => {
      const invalid = { ...validSnapshot, schemaVersion: "outra_versao" };
      expect(() => validateSnapshotPayload(invalid)).toThrow(
        "Carga útil inválida: schemaVersion deve ser 'mobile_strategic_profile_snapshot_v1'"
      );
    });

    it("rejeita snapshot com base64 no payload", () => {
      const invalid = {
        ...validSnapshot,
        diagnosisSummary: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA",
      };
      expect(() => validateSnapshotPayload(invalid)).toThrow(
        "Carga útil insegura: base64 não é permitido no snapshot"
      );
    });

    it("rejeita snapshot contendo API key Gemini ou OpenAI", () => {
      const invalidGemini = {
        ...validSnapshot,
        commercialSummary: "Minha chave é AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q",
      };
      expect(() => validateSnapshotPayload(invalidGemini)).toThrow(
        "Carga útil insegura: API key detectada no snapshot"
      );

      const invalidOpenAI = {
        ...validSnapshot,
        commercialSummary: "Chave sk-12345678901234567890123456789012",
      };
      expect(() => validateSnapshotPayload(invalidOpenAI)).toThrow(
        "Carga útil insegura: API key detectada no snapshot"
      );
    });

    it("rejeita snapshot contendo links assinados (signed URLs)", () => {
      const invalid = {
        ...validSnapshot,
        diagnosisSummary: "Acesse https://bucket.com/video.mp4?signature=xyz123&expires=9999",
      };
      expect(() => validateSnapshotPayload(invalid)).toThrow(
        "Carga útil insegura: links assinados ou referências a arquivos de vídeo detectadas"
      );
    });

    it("rejeita snapshot com transcrição ou resumos muito longos", () => {
      const invalid = {
        ...validSnapshot,
        lastAnalysisSummary: "a".repeat(2001),
      };
      expect(() => validateSnapshotPayload(invalid)).toThrow(
        "Carga útil muito longa: limite de transcrição/resumos ultrapassado"
      );
    });
  });

  describe("getStrategicProfileSnapshotByUserId", () => {
    it("retorna null se o usuário não possuir snapshot ativo", async () => {
      mockFindOne.mockReturnValue({
        lean: () => Promise.resolve(null),
      });

      const result = await getStrategicProfileSnapshotByUserId(validUserId);
      expect(mockConnect).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("retorna o snapshot mapeado se existir no banco de dados", async () => {
      const mockDoc = {
        userId: new Types.ObjectId(validUserId),
        status: "active",
        accessLevel: "premium",
        snapshotJson: JSON.stringify(validSnapshot),
        source: "mock_analysis",
        lastAnalyzedAt: new Date(),
      };

      mockFindOne.mockReturnValue({
        lean: () => Promise.resolve(mockDoc),
      });

      const result = await getStrategicProfileSnapshotByUserId(validUserId);
      expect(result).not.toBeNull();
      expect(result?.userId).toBe(validUserId);
      expect(result?.snapshot.profileState).toBe("active");
      expect(result?.source).toBe("mock_analysis");
    });

    it("lança erro se o ID do usuário for inválido", async () => {
      await expect(getStrategicProfileSnapshotByUserId("invalido")).rejects.toThrow("UserId inválido");
    });
  });

  describe("upsertStrategicProfileSnapshot", () => {
    it("cria ou atualiza snapshot com sucesso", async () => {
      const mockDoc = {
        userId: new Types.ObjectId(validUserId),
        status: "active",
        accessLevel: "premium",
        snapshotJson: JSON.stringify(validSnapshot),
        source: "manual_seed",
        lastAnalyzedAt: new Date(),
      };

      mockFindOneAndUpdate.mockResolvedValue(mockDoc);

      const result = await upsertStrategicProfileSnapshot({
        userId: validUserId,
        accessLevel: "premium",
        snapshot: validSnapshot,
        source: "manual_seed",
      });

      expect(mockConnect).toHaveBeenCalled();
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { userId: new Types.ObjectId(validUserId) },
        expect.any(Object),
        { new: true, upsert: true }
      );
      expect(result.userId).toBe(validUserId);
      expect(result.source).toBe("manual_seed");
    });

    it("rejeita a origem gemini_real", async () => {
      await expect(
        upsertStrategicProfileSnapshot({
          userId: validUserId,
          accessLevel: "premium",
          snapshot: validSnapshot,
          source: "gemini_real" as any,
        })
      ).rejects.toThrow("Origem 'gemini_real' não é permitida nesta fase");
    });
  });
});
