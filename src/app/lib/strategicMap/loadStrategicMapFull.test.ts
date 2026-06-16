import { loadStrategicMapFull } from "./loadStrategicMapFull";

const mockConnect = jest.fn().mockResolvedValue(undefined);
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: () => mockConnect() }));

// O loader orquestra funções já testadas; aqui cobrimos só os guards próprios
// dele (userId inválido sem tocar o banco; exceção no pipeline → null).
const mockBuildViewModel = jest.fn();
jest.mock("@/app/dashboard/boards/videoUpload/narrativeMapMobileViewModelServerSelector", () => ({
  buildNarrativeMapMobileViewModelFromReadings: (...a: unknown[]) => mockBuildViewModel(...a),
}));
jest.mock("@/app/dashboard/boards/videoUpload/mapaSeedSynthesisMerge", () => ({
  loadMapaSeedForSynthesisMerge: jest.fn().mockResolvedValue(null),
  mergeMapaSeedIntoSynthesis: (s: unknown) => s,
}));
jest.mock("@/app/dashboard/boards/videoUpload/mapConfirmationsService", () => ({
  getMapConfirmationsSnapshot: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/app/dashboard/boards/videoUpload/mapEvolutionStatusResolver", () => ({
  resolveMapEvolutionStatus: jest.fn().mockReturnValue("first_reading"),
}));
jest.mock("@/app/dashboard/boards/videoUpload/narrativeMapAccessState", () => ({
  getNarrativeMapAccessLevelForUser: jest.fn().mockReturnValue("free"),
  hasNarrativeMapInstagramConnection: jest.fn().mockReturnValue(false),
}));
jest.mock("@/app/models/User", () => ({ __esModule: true, default: { findById: jest.fn() } }));
jest.mock("@/app/models/MapaSeed", () => ({ __esModule: true, default: { findOne: jest.fn() } }));

const VALID = "507f1f77bcf86cd799439011";

describe("loadStrategicMapFull", () => {
  beforeEach(() => jest.clearAllMocks());

  it("userId inválido → null sem tocar o banco", async () => {
    await expect(loadStrategicMapFull("nope")).resolves.toBeNull();
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("exceção no pipeline → null (não lança)", async () => {
    // User.findById().select().lean() lança → cai no catch.
    const User = require("@/app/models/User").default;
    User.findById.mockReturnValue({ select: () => ({ lean: () => { throw new Error("db down"); } }) });
    await expect(loadStrategicMapFull(VALID)).resolves.toBeNull();
  });
});
