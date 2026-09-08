import { Types } from "mongoose";
import { registerCollabDecision, getCollabInterestState, markMatchesCelebrated } from "./collabInterestService";
import CollabInterest from "@/app/models/CollabInterest";
import UserModel from "@/app/models/User";
import CollabMatch from "@/app/models/CollabMatch";
import { sendWhatsAppMessage } from "@/app/lib/whatsappService";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/CollabInterest", () => ({
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
  updateMany: jest.fn(),
  find: jest.fn(),
}));
jest.mock("@/app/models/User", () => ({ findById: jest.fn(), find: jest.fn() }));
jest.mock("@/app/models/CollabMatch", () => ({ create: jest.fn() }));
jest.mock("./perPautaCollabCache", () => ({
  invalidateCachedPerPautaMatches: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/app/lib/whatsappService", () => ({ sendWhatsAppMessage: jest.fn() }));
jest.mock("@/app/lib/logger", () => ({ logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const mockFindOneAndUpdate = CollabInterest.findOneAndUpdate as jest.Mock;
const mockUpdateOne = CollabInterest.updateOne as jest.Mock;
const mockUpdateMany = CollabInterest.updateMany as jest.Mock;
const mockInterestFind = CollabInterest.find as jest.Mock;
const mockUserFindById = UserModel.findById as jest.Mock;
const mockUserFind = UserModel.find as jest.Mock;
const mockCollabMatchCreate = CollabMatch.create as jest.Mock;
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
  viewerContribution: "Experiência de pai na rotina",
  partnerContribution: "Experiência de mãe que trabalha fora",
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
  mockCollabMatchCreate.mockResolvedValue({ _id: new Types.ObjectId() });
});

describe("registerCollabDecision", () => {
  it("rejeita clientes antigos sem gravar parceiro nem criar confirmação por território", async () => {
    expect(await registerCollabDecision(baseInput)).toEqual({ ok: false, matched: false, match: null, error: 'refresh_required' });
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mockSendWhatsApp).not.toHaveBeenCalled();
  });
});

describe("getCollabInterestState", () => {
  it("separa decisões pendentes de matches e monta o parceiro pro front", async () => {
    const partnerOid = new Types.ObjectId(partnerId);
    const docs = [
      { pautaId: "p-pendente", decision: "interested", matchedAt: null, partner: partnerOid, fitReason: null, sharedSignal: null },
      { pautaId: "p-dispensada", decision: "dismissed", matchedAt: null, partner: partnerOid, fitReason: null, sharedSignal: null },
      { pautaId: "p-casada-vista", pautaTitle: "Rotina e dinheiro", pautaTerritory: "Paternidade", decision: "interested", matchedAt: new Date(), celebratedAt: new Date(), partner: partnerOid, fitReason: "fala de dinheiro sem culpa", sharedSignal: "Paternidade", recordingIdea: "Revezamento sobre paternidade", collabMode: "remoto", viewerContribution: "Experiência do dia a dia", partnerContribution: "Explicação prática" },
      { pautaId: "p-casada-nova", pautaTitle: "Culpa e trabalho", pautaTerritory: "Trabalho", decision: "interested", matchedAt: new Date(), celebratedAt: null, partner: partnerOid, fitReason: "x", sharedSignal: null },
    ];
    mockInterestFind.mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(docs) }) });
    mockUserFind.mockReturnValue(leanChain([partnerUser]));

    const state = await getCollabInterestState(userId);

    expect(state.ok).toBe(true);
    expect(state.decisions).toMatchObject([
      { pautaId: "p-pendente", decision: "interested", collab: { id: partnerId } },
      { pautaId: "p-dispensada", decision: "dismissed" },
    ]);
    expect(state.matches).toHaveLength(2);
    // isNew: casou sem celebratedAt (o outro topou com este criador fora) → festa na volta.
    expect(state.matches.find((m) => m.pautaId === "p-casada-vista")?.isNew).toBe(false);
    expect(state.matches.find((m) => m.pautaId === "p-casada-nova")?.isNew).toBe(true);
    expect(state.matches.find((m) => m.pautaId === "p-casada-vista")?.pautaSnapshot).toEqual({
      id: "p-casada-vista",
      title: "Rotina e dinheiro",
      territory: "Paternidade",
    });
    // "como gravar" + modo sobrevivem ao match e chegam ao payload do pós-match.
    const casadaVista = state.matches.find((m) => m.pautaId === "p-casada-vista")?.collab;
    expect(casadaVista?.collabRecordingIdea).toBe("Revezamento sobre paternidade");
    expect(casadaVista?.collabMode).toBe("remoto");
    expect(casadaVista?.viewerContribution).toBe("Experiência do dia a dia");
    expect(casadaVista?.partnerContribution).toBe("Explicação prática");
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
