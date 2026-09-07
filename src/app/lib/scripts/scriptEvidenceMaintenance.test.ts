/** @jest-environment node */
import Evidence from "@/app/models/PublishedContentEvidence";
import ScriptEntry from "@/app/models/ScriptEntry";
import { buildCreatorScriptDnaV3 } from "./creatorScriptDnaV3";
import { maintainScriptEvidence } from "./scriptEvidenceMaintenance";

const mockOwner = "507f1f77bcf86cd799439011";
const mockMetric = { _id: "507f1f77bcf86cd799439012", postDate: new Date("2026-09-06"), stats: { reach: 100, total_interactions: 0 } };
const mockScript = { _id: "507f1f77bcf86cd799439013", postedContent: { metricId: mockMetric._id }, evidenceProvenance: { packId: "pack" } };
const mockQuery = (rows: unknown[]) => {
  const q: any = { sort: () => q, limit: () => q, select: () => q, lean: async () => rows }; return q;
};
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/Metric", () => ({ __esModule: true, default: { find: () => mockQuery([mockMetric]) } }));
jest.mock("@/app/models/PublishedContentEvidence", () => ({ __esModule: true, default: {
  find: jest.fn(() => mockQuery([{ _id: "evidence", metricId: mockMetric._id, transcript: { source: "stored_script" } }])), bulkWrite: jest.fn(),
} }));
jest.mock("@/app/models/ScriptEntry", () => ({ __esModule: true, default: { find: () => mockQuery([mockScript]), bulkWrite: jest.fn() } }));
jest.mock("./creatorScriptDnaV3", () => ({ buildCreatorScriptDnaV3: jest.fn() }));

describe("manutenção sem reler vídeos", () => {
  beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers().setSystemTime(new Date("2026-09-07T12:00:00Z")); });
  afterEach(() => jest.useRealTimers());
  it("por padrão somente informa o que mudaria", async () => {
    expect(await maintainScriptEvidence(mockOwner)).toMatchObject({ dryRun: true, updates: 1, confirmedLinks: 1, outcomeWindows: 1 });
    expect(Evidence.bulkWrite).not.toHaveBeenCalled();
    expect(ScriptEntry.bulkWrite).not.toHaveBeenCalled();
    expect(buildCreatorScriptDnaV3).not.toHaveBeenCalled();
  });
  it("reconcilia vínculo e métricas preservando zero e origem", async () => {
    await maintainScriptEvidence(mockOwner, false);
    const operation = (Evidence.bulkWrite as jest.Mock).mock.calls[0][0][0].updateOne;
    expect(String(operation.filter.userId)).toBe(mockOwner);
    expect(operation.update.$set).toMatchObject({ performance: { interactions: 0 }, "completeness.transcript": false, scriptLink: { confidence: "confirmed" } });
    expect(buildCreatorScriptDnaV3).toHaveBeenCalledWith({ userId: mockOwner });
  });
  it("não inventa retratos antigos de 1/7/30 dias", async () => {
    jest.setSystemTime(new Date("2026-09-16"));
    expect(await maintainScriptEvidence(mockOwner, false)).toMatchObject({ outcomeWindows: 0 });
    expect(ScriptEntry.bulkWrite).not.toHaveBeenCalled();
  });
});
