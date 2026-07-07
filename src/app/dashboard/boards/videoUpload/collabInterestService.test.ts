import { Types } from "mongoose";
import { registerCollabDecision, getCollabInterestState, markMatchesCelebrated } from "./collabInterestService";
import CollabInterest from "@/app/models/CollabInterest";
import UserModel from "@/app/models/User";
import { sendWhatsAppMessage } from "@/app/lib/whatsappService";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/CollabInterest", () => ({
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
  updateMany: jest.fn(),
  find: jest.fn(),
}));
jest.mock("@/app/models/User", () => ({ findById: jest.fn(), find: jest.fn() }));
jest.mock("@/app/lib/whatsappService", () => ({ sendWhatsAppMessage: jest.fn() }));
jest.mock("@/app/lib/logger", () => ({ logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const mockFindOneAndUpdate = CollabInterest.findOneAndUpdate as jest.Mock;
const mockUpdateOne = CollabInterest.updateOne as jest.Mock;
const mockUpdateMany = CollabInterest.updateMany as jest.Mock;
const mockInterestFind = CollabInterest.find as jest.Mock;
const mockUserFindById = UserModel.findById as jest.Mock;
const mockUserFind = UserModel.find as jest.Mock;
const mockSendWhatsApp = sendWhatsAppMessage as jest.Mock;

const userId = new Types.ObjectId().toString();
const partnerId = new Types.ObjectId().toString();

function leanChain(value: unknown) {
  return { select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }) };
}

const baseInput = {
  userId,
  partnerId,
  pautaId: "pauta-1",
  pautaTitle: "O dia que meu filho perguntou se eu precisava trabalhar",
  pautaTerritory: "Paternidade",
  fitReason: "fala de dinheiro sem culpa",
  sharedSignal: "Paternidade",
  decision: "interested" as const,
};

const viewerUser = {
  _id: new Types.ObjectId(userId), name: "Arthur", username: "arthur",
  image: null, mediaKitSlug: "arthur", whatsappPhone: "+551199", whatsappVerified: true,
};
const partnerUser = {
  _id: new Types.ObjectId(partnerId), name: "Marina Braga", username: "marinabraga",
  image: "https://img/m.jpg", mediaKitSlug: "marina", whatsappPhone: "+551188", whatsappVerified: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateOne.mockResolvedValue({ acknowledged: true });
  mockUpdateMany.mockResolvedValue({ acknowledged: true });
  mockSendWhatsApp.mockResolvedValue("wamid.x");
});

describe("registerCollabDecision", () => {
  it("sem recíproco: registra o interesse e fica aguardando (matched=false)", async () => {
    mockFindOneAndUpdate
      .mockResolvedValueOnce({ _id: new Types.ObjectId(), pautaTitle: baseInput.pautaTitle }) // upsert próprio
      .mockResolvedValueOnce(null); // claim do recíproco falha

    const result = await registerCollabDecision(baseInput);

    expect(result).toEqual({ ok: true, matched: false, match: null });
    // Upsert idempotente por (user, pauta), com expiração de interesse
    const [ownQuery, ownUpdate] = mockFindOneAndUpdate.mock.calls[0];
    expect(ownQuery).toMatchObject({ pautaId: "pauta-1" });
    expect(ownUpdate.$set.decision).toBe("interested");
    expect(ownUpdate.$set.expiresAt).toBeInstanceOf(Date);
    // "como gravar" + modo persistem no snapshot — precisam sobreviver pro pós-match.
    expect(ownUpdate.$set).toHaveProperty("recordingIdea");
    expect(ownUpdate.$set).toHaveProperty("collabMode");
    expect(mockSendWhatsApp).not.toHaveBeenCalled();
  });

  it("com recíproco vigente: casa os dois, notifica os dois lados e devolve o parceiro", async () => {
    const ownDoc = { _id: new Types.ObjectId(), pautaTitle: baseInput.pautaTitle, fitReason: baseInput.fitReason, sharedSignal: "Paternidade" };
    const reciprocalDoc = { _id: new Types.ObjectId(), pautaTitle: "Pauta da Marina" };
    mockFindOneAndUpdate
      .mockResolvedValueOnce(ownDoc)
      .mockResolvedValueOnce(reciprocalDoc);
    mockUserFindById
      .mockReturnValueOnce(leanChain(viewerUser))
      .mockReturnValueOnce(leanChain(partnerUser));

    const result = await registerCollabDecision(baseInput);

    expect(result.ok).toBe(true);
    expect(result.matched).toBe(true);
    // Quem topa por último vê a festa ao vivo → o próprio doc já nasce celebrado.
    const [, ownMatchUpdate] = mockUpdateOne.mock.calls[0];
    expect(ownMatchUpdate.$set.celebratedAt).toBeInstanceOf(Date);
    expect(result.match).toMatchObject({
      id: partnerId,
      name: "Marina Braga",
      username: "marinabraga",
      narrativeFitReason: "fala de dinheiro sem culpa",
      narrativeMatch: true,
    });
    // Claim atômico do recíproco: só casa quem ainda não casou e não expirou
    const [claimQuery, claimUpdate] = mockFindOneAndUpdate.mock.calls[1];
    expect(claimQuery).toMatchObject({ decision: "interested", matchedAt: null });
    expect(claimUpdate.$set.matchedAt).toBeInstanceOf(Date);
    expect(claimUpdate.$unset).toEqual({ expiresAt: 1 });
    // O próprio doc também vira match imortal
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: ownDoc._id },
      expect.objectContaining({ $unset: { expiresAt: 1 } }),
    );
    // Aviso só no match, pros DOIS lados
    expect(mockSendWhatsApp).toHaveBeenCalledTimes(2);
    expect(mockSendWhatsApp.mock.calls.map((c) => c[0]).sort()).toEqual(["+551188", "+551199"]);
  });

  it("'não agora' é silencioso: registra e nunca busca recíproco nem notifica", async () => {
    mockFindOneAndUpdate.mockResolvedValueOnce({ _id: new Types.ObjectId() });

    const result = await registerCollabDecision({ ...baseInput, decision: "dismissed" });

    expect(result).toEqual({ ok: true, matched: false, match: null });
    expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(1); // só o upsert próprio
    expect(mockSendWhatsApp).not.toHaveBeenCalled();
  });

  it("falha de WhatsApp não derruba o match", async () => {
    mockFindOneAndUpdate
      .mockResolvedValueOnce({ _id: new Types.ObjectId(), pautaTitle: "t", fitReason: null, sharedSignal: null })
      .mockResolvedValueOnce({ _id: new Types.ObjectId(), pautaTitle: "t2" });
    mockUserFindById
      .mockReturnValueOnce(leanChain(viewerUser))
      .mockReturnValueOnce(leanChain(partnerUser));
    mockSendWhatsApp.mockRejectedValue(new Error("meta down"));

    const result = await registerCollabDecision(baseInput);
    expect(result.matched).toBe(true);
    expect(result.match?.name).toBe("Marina Braga");
  });

  it("rejeita ids inválidos e self-match", async () => {
    expect((await registerCollabDecision({ ...baseInput, partnerId: "nope" })).ok).toBe(false);
    expect((await registerCollabDecision({ ...baseInput, partnerId: userId })).ok).toBe(false);
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("getCollabInterestState", () => {
  it("separa decisões pendentes de matches e monta o parceiro pro front", async () => {
    const partnerOid = new Types.ObjectId(partnerId);
    const docs = [
      { pautaId: "p-pendente", decision: "interested", matchedAt: null, partner: partnerOid, fitReason: null, sharedSignal: null },
      { pautaId: "p-dispensada", decision: "dismissed", matchedAt: null, partner: partnerOid, fitReason: null, sharedSignal: null },
      { pautaId: "p-casada-vista", decision: "interested", matchedAt: new Date(), celebratedAt: new Date(), partner: partnerOid, fitReason: "fala de dinheiro sem culpa", sharedSignal: "Paternidade", recordingIdea: "Revezamento sobre paternidade", collabMode: "remoto" },
      { pautaId: "p-casada-nova", decision: "interested", matchedAt: new Date(), celebratedAt: null, partner: partnerOid, fitReason: "x", sharedSignal: null },
    ];
    mockInterestFind.mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(docs) }) });
    mockUserFind.mockReturnValue(leanChain([partnerUser]));

    const state = await getCollabInterestState(userId);

    expect(state.ok).toBe(true);
    expect(state.decisions).toEqual([
      { pautaId: "p-pendente", decision: "interested" },
      { pautaId: "p-dispensada", decision: "dismissed" },
    ]);
    expect(state.matches).toHaveLength(2);
    // isNew: casou sem celebratedAt (o outro topou com este criador fora) → festa na volta.
    expect(state.matches.find((m) => m.pautaId === "p-casada-vista")?.isNew).toBe(false);
    expect(state.matches.find((m) => m.pautaId === "p-casada-nova")?.isNew).toBe(true);
    // "como gravar" + modo sobrevivem ao match e chegam ao payload do pós-match.
    const casadaVista = state.matches.find((m) => m.pautaId === "p-casada-vista")?.collab;
    expect(casadaVista?.collabRecordingIdea).toBe("Revezamento sobre paternidade");
    expect(casadaVista?.collabMode).toBe("remoto");
  });
});

describe("markMatchesCelebrated", () => {
  it("marca só os docs matchados ainda sem celebratedAt (idempotente)", async () => {
    await markMatchesCelebrated(userId, ["p1", "p2"]);
    const [query, update] = mockUpdateMany.mock.calls[0];
    expect(query).toMatchObject({ pautaId: { $in: ["p1", "p2"] }, matchedAt: { $ne: null }, celebratedAt: null });
    expect(update.$set.celebratedAt).toBeInstanceOf(Date);
  });

  it("ignora userId inválido ou lista vazia", async () => {
    expect((await markMatchesCelebrated("nope", ["p1"])).ok).toBe(false);
    expect((await markMatchesCelebrated(userId, [])).ok).toBe(false);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});
