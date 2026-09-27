/** @jest-environment node */
import { getClaudeConnectionStatus } from "./claudeConnection";
import McpOAuthClientModel from "@/app/models/McpOAuthClient";
import McpOAuthRefreshTokenModel from "@/app/models/McpOAuthRefreshToken";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/McpOAuthRefreshToken", () => ({ __esModule: true, default: { distinct: jest.fn() } }));
jest.mock("@/app/models/McpOAuthClient", () => ({ __esModule: true, default: { find: jest.fn() } }));

const USER_ID = "507f1f77bcf86cd799439011";
const distinct = McpOAuthRefreshTokenModel.distinct as jest.Mock;
const find = McpOAuthClientModel.find as jest.Mock;

function clients(list: Array<{ clientName: string; redirectUris: string[] }>) {
  find.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(list) }) });
}

describe("getClaudeConnectionStatus", () => {
  beforeEach(() => jest.clearAllMocks());

  it("conectado quando há autorização ativa de um cliente Claude", async () => {
    distinct.mockResolvedValue(["c1"]);
    clients([{ clientName: "Claude", redirectUris: ["https://claude.ai/api/mcp/auth_callback"] }]);
    await expect(getClaudeConnectionStatus(USER_ID)).resolves.toEqual({ connected: true });
    expect(distinct).toHaveBeenCalledWith("clientId", expect.objectContaining({ revokedAt: null }));
  });

  it("ChatGPT conectado não conta como Claude", async () => {
    distinct.mockResolvedValue(["c2"]);
    clients([{ clientName: "ChatGPT", redirectUris: ["https://chatgpt.com/connector_platform_oauth_redirect"] }]);
    await expect(getClaudeConnectionStatus(USER_ID)).resolves.toEqual({ connected: false });
  });

  it("sem autorização ativa, nem consulta os clientes", async () => {
    distinct.mockResolvedValue([]);
    await expect(getClaudeConnectionStatus(USER_ID)).resolves.toEqual({ connected: false });
    expect(find).not.toHaveBeenCalled();
  });

  it("id inválido não vai ao banco", async () => {
    await expect(getClaudeConnectionStatus("x")).resolves.toEqual({ connected: false });
    expect(distinct).not.toHaveBeenCalled();
  });
});
