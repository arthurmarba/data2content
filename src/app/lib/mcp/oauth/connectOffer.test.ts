/** @jest-environment node */
import McpOAuthConsentRequestModel from "@/app/models/McpOAuthConsentRequest";
import UserModel from "@/app/models/User";
import { getMcpAccountState } from "../accountState";
import { loadMcpCreatorMap } from "../creatorMap";
import { prepareClaudeConnectOffer } from "./connectOffer";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/McpOAuthConsentRequest", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), updateOne: jest.fn(async () => ({ modifiedCount: 1 })) },
}));
jest.mock("@/app/models/User", () => ({ __esModule: true, default: { updateOne: jest.fn() } }));
jest.mock("../accountState", () => ({ getMcpAccountState: jest.fn() }));
jest.mock("../creatorMap", () => ({ loadMcpCreatorMap: jest.fn() }));
jest.mock("../config", () => ({ isMcpAdminResource: (resource: string) => resource.includes("/admin") }));

const userId = "507f1f77bcf86cd799439011";
const claudeConsent = {
  _id: "c1",
  userId,
  clientName: "Claude",
  redirectUri: "https://claude.ai/api/mcp/auth_callback",
  resource: "https://data2content.ai/api/mcp",
};

function consentReturns(value: unknown) {
  jest.mocked(McpOAuthConsentRequestModel.findOne).mockReturnValue({ lean: async () => value } as never);
}

describe("oferta na conexão do Claude", () => {
  const original = process.env.MCP_CLAUDE_CONNECT_OFFER_ENABLED;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MCP_CLAUDE_CONNECT_OFFER_ENABLED = "1";
    consentReturns(claudeConsent);
    jest.mocked(getMcpAccountState).mockResolvedValue({ accountAvailable: true, accessLevel: "free" } as never);
    jest.mocked(loadMcpCreatorMap).mockResolvedValue({ narrative: "Minha narrativa", territories: ["Maternidade"] } as never);
    jest.mocked(UserModel.updateOne).mockResolvedValue({ modifiedCount: 1 } as never);
  });
  afterAll(() => {
    if (original === undefined) delete process.env.MCP_CLAUDE_CONNECT_OFFER_ENABLED;
    else process.env.MCP_CLAUDE_CONNECT_OFFER_ENABLED = original;
  });

  it("mostra a oferta uma vez e segura o pedido aberto por 30 minutos", async () => {
    const now = new Date("2026-09-26T12:00:00.000Z");
    const result = await prepareClaudeConnectOffer("tok", userId, now);
    expect(result).toEqual({ show: true, path: "/mcp/conectado?request=tok" });
    expect(McpOAuthConsentRequestModel.updateOne).toHaveBeenCalledWith(
      { _id: "c1", consumedAt: null },
      { $set: { expiresAt: new Date("2026-09-26T12:30:00.000Z") } },
    );
  });

  it("fica desligada sem a chave", async () => {
    process.env.MCP_CLAUDE_CONNECT_OFFER_ENABLED = "0";
    expect(await prepareClaudeConnectOffer("tok", userId)).toEqual({ show: false });
    expect(McpOAuthConsentRequestModel.findOne).not.toHaveBeenCalled();
  });

  it("nunca aparece no ChatGPT, cuja regra proíbe mostrar planos", async () => {
    consentReturns({ ...claudeConsent, clientName: "ChatGPT", redirectUri: "https://chatgpt.com/connector/oauth/x" });
    expect(await prepareClaudeConnectOffer("tok", userId)).toEqual({ show: false });
  });

  it("não vende antes de mostrar valor: sem narrativa, sem oferta", async () => {
    jest.mocked(loadMcpCreatorMap).mockResolvedValue({ narrative: null, territories: [] } as never);
    expect(await prepareClaudeConnectOffer("tok", userId)).toEqual({ show: false });
  });

  it("não aparece para quem já é Pro nem para quem já viu", async () => {
    jest.mocked(getMcpAccountState).mockResolvedValueOnce({ accountAvailable: true, accessLevel: "pro" } as never);
    expect(await prepareClaudeConnectOffer("tok", userId)).toEqual({ show: false });
    jest.mocked(UserModel.updateOne).mockResolvedValueOnce({ modifiedCount: 0 } as never);
    expect(await prepareClaudeConnectOffer("tok", userId)).toEqual({ show: false });
  });

  it("qualquer falha segue o login de sempre", async () => {
    jest.mocked(McpOAuthConsentRequestModel.findOne).mockImplementation(() => { throw new Error("db down"); });
    expect(await prepareClaudeConnectOffer("tok", userId)).toEqual({ show: false });
  });
});
