/** @jest-environment node */
import { loadPluginArrival } from "./arrival";
import { requestFirstContentIdeas } from "./firstIdeas";
import { loadMcpCreatorMap } from "@/app/lib/mcp/creatorMap";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/lib/dataService/usageEventService", () => ({ logUsageEvent: jest.fn() }));
jest.mock("@/app/lib/mcp/accountState", () => ({
  getMcpAccountState: jest.fn(async () => ({ accountAvailable: true, accessLevel: "free", instagramConnected: false })),
}));
jest.mock("@/app/lib/mcp/creatorMap", () => ({ loadMcpCreatorMap: jest.fn() }));
jest.mock("./firstIdeas", () => ({ requestFirstContentIdeas: jest.fn(async () => ({ state: "queued" })) }));
jest.mock("@/app/models/CreatorContentIdea", () => ({
  __esModule: true,
  default: { find: jest.fn(() => ({ sort: () => ({ limit: () => ({ select: () => ({ lean: async () => [] }) }) }) })) },
}));

const userId = "507f1f77bcf86cd799439011";

describe("chegada do plugin", () => {
  beforeEach(() => jest.clearAllMocks());

  it("pede as primeiras pautas quando o mapa já tem narrativa e território", async () => {
    jest.mocked(loadMcpCreatorMap).mockResolvedValue({ narrative: "Minha narrativa", territories: ["Maternidade"], narrativeIsFirm: false } as never);
    const data = await loadPluginArrival({ userId, client: "claude", intent: "pautas" });
    expect(requestFirstContentIdeas).toHaveBeenCalledWith(userId);
    expect(data?.ideasState).toBe("preparing");
  });

  it("não gasta geração quando o mapa ainda não sustenta pauta", async () => {
    jest.mocked(loadMcpCreatorMap).mockResolvedValue({ narrative: null, territories: [], narrativeIsFirm: false } as never);
    const data = await loadPluginArrival({ userId, client: "chatgpt", intent: null });
    expect(requestFirstContentIdeas).not.toHaveBeenCalled();
    expect(data?.ideasState).toBe("waiting_map");
  });
});
