import { surfaceFromClientRegistration } from "./clientSurface";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/McpOAuthClient", () => ({ __esModule: true, default: { findOne: jest.fn() } }));

describe("origem da conexão MCP", () => {
  it("reconhece o Claude pelo retorno em claude.ai", () => {
    expect(surfaceFromClientRegistration({
      clientName: "Claude",
      redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
    })).toBe("claude");
  });

  it("reconhece o ChatGPT pelo retorno em chatgpt.com", () => {
    expect(surfaceFromClientRegistration({
      clientName: "ChatGPT",
      redirectUris: ["https://chatgpt.com/connector/oauth/xe3aXfSdnASB"],
    })).toBe("chatgpt");
  });

  it("usa o nome quando o retorno é local (Claude Code)", () => {
    expect(surfaceFromClientRegistration({
      clientName: "Claude Code (plugin:data2content:data2content)",
      redirectUris: ["http://localhost:53123/callback"],
    })).toBe("claude");
  });

  it("sem sinal claro, mantém o comportamento anterior", () => {
    expect(surfaceFromClientRegistration({ clientName: "Outro", redirectUris: [] })).toBe("chatgpt");
  });
});
