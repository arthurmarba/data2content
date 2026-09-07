/** @jest-environment node */
import { acquireReading, checkpointReading, finishReading, claimGeminiAvailability, classifyReadingFailure, fairReadingBatch } from "./contentReadingState";
import State from "@/app/models/ContentReadingState";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/ContentReadingState", () => ({ __esModule: true, default: {
  updateOne: jest.fn(), findOneAndUpdate: jest.fn(), findById: jest.fn(),
} }));
describe("recuperação da leitura", () => {
  it.each([
    ["Your prepayment credits are depleted", "provider_balance", false],
    ["Instagram HTTP 401", "instagram_auth", false],
    ["Instagram HTTP 404", "media_deleted", true],
    ["Vídeo acima do teto", "unsupported_media", true],
    ["HTTP 403", "media_url_expired", false],
    ["HTTP 429 rate limit", "provider_rate_limit", false],
  ])("classifica %s", (message,reason,terminal) => expect(classifyReadingFailure(message)).toMatchObject({reason,terminal}));
  it("distribui o lote entre criadores e prioriza engajamento dentro da conta", () => {
    const rows = [ {_id:"a1",user:"a",stats:{reach:100,total_interactions:50}}, {_id:"a2",user:"a",stats:{reach:100,total_interactions:10}}, {_id:"b1",user:"b",stats:{reach:100,total_interactions:5}} ];
    expect(fairReadingBatch(rows,2).map(r=>r._id)).toEqual(["a1","b1"]);
  });
});

describe("contrato de exclusão mútua e retomada", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (State.updateOne as jest.Mock).mockResolvedValue({ matchedCount: 1 });
    jest.useFakeTimers().setSystemTime(new Date("2026-09-07T00:00:00Z"));
  });
  afterEach(() => jest.useRealTimers());

  it("exige lease vencido e adia um segundo consumidor", async () => {
    (State.findOneAndUpdate as jest.Mock).mockReturnValue({ lean: async () => null });
    expect(await acquireReading("post", "v4")).toBeNull();
    expect(State.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({
      _id: "post", leaseUntil: { $lte: new Date() },
    }), expect.objectContaining({ $inc: { attempts: 1 } }), { new: true });
  });
  it("reutiliza extração paga da mesma revisão e descarta a de outra revisão", async () => {
    (State.findOneAndUpdate as jest.Mock).mockReturnValue({ lean: async () => ({ revision: "v4", result: { transcript: "fala salva" } }) });
    expect(await acquireReading("post", "v4")).toMatchObject({ result: { transcript: "fala salva" } });
    expect(await acquireReading("post", "v5")).toMatchObject({ result: null });
    expect(State.updateOne).toHaveBeenCalledWith(expect.objectContaining({ _id: "post", leaseToken: expect.any(String) }),
      { $set: { revision: "v5", result: null, attempts: 1 } });
  });
  it("não aceita checkpoint de um consumidor que perdeu a posse", async () => {
    (State.updateOne as jest.Mock).mockResolvedValue({ matchedCount: 0 });
    await expect(checkpointReading("post", "antigo", {})).rejects.toThrow("reading_lease_lost");
  });
  it("preserva checkpoint ao adiar persistência", async () => {
    await finishReading("post", "token", "Falha ao persistir a evidência integral");
    const update = (State.updateOne as jest.Mock).mock.calls[0][1].$set;
    expect(update).toMatchObject({ state: "deferred", leaseToken: null });
    expect(update).not.toHaveProperty("result");
  });
  it("não tenta Gemini durante a pausa de saldo", async () => {
    (State.findById as jest.Mock).mockReturnValue({ lean: async () => ({ state: "paused", nextAttemptAt: new Date(Date.now() + 1000) }) });
    expect(await claimGeminiAvailability()).toBe(false);
    expect(State.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
