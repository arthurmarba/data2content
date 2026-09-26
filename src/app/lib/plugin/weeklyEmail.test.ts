/** @jest-environment node */
import { Types } from "mongoose";
import CreatorContentIdeaModel from "@/app/models/CreatorContentIdea";
import UserModel from "@/app/models/User";
import { sendPluginWeeklyEmail } from "@/app/lib/emailService";
import { pluginWeeklyEmail } from "@/emails/pluginWeekly";
import {
  isValidPluginWeeklyUnsubscribeToken,
  pluginWeeklyUnsubscribeToken,
  runPluginWeeklyEmails,
} from "./weeklyEmail";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/lib/emailService", () => ({ sendPluginWeeklyEmail: jest.fn() }));
jest.mock("@/app/lib/mcp/creatorMap", () => ({ loadMcpCreatorMap: jest.fn(async () => ({ narrative: "Minha narrativa" })) }));
jest.mock("@/app/lib/mcp/config", () => ({ getMcpAppBaseUrl: () => "https://data2content.ai" }));
jest.mock("@/app/models/User", () => ({ __esModule: true, default: { find: jest.fn(), updateOne: jest.fn() } }));
jest.mock("@/app/models/CreatorContentIdea", () => ({ __esModule: true, default: { findOne: jest.fn() } }));

const freeUser = {
  _id: new Types.ObjectId("507f1f77bcf86cd799439011"),
  email: "creator@example.test",
  name: "Ana Souza",
  planStatus: "inactive",
  pluginOrigin: { client: "claude" },
  pluginWeeklyEmailIdeaIds: [],
};

function candidates(rows: unknown[]) {
  jest.mocked(UserModel.find).mockReturnValue({
    select: () => ({ sort: () => ({ limit: () => ({ lean: async () => rows }) }) }),
  } as never);
}
function nextIdea(value: unknown) {
  jest.mocked(CreatorContentIdeaModel.findOne).mockReturnValue({
    sort: () => ({ select: () => ({ lean: async () => value }) }),
  } as never);
}

describe("e-mail semanal do plugin", () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;
  beforeAll(() => { process.env.NEXTAUTH_SECRET = "segredo-de-teste"; });
  afterAll(() => { process.env.NEXTAUTH_SECRET = originalSecret; });
  beforeEach(() => jest.clearAllMocks());

  it("só aceita o link de saída assinado para a própria conta", () => {
    const token = pluginWeeklyUnsubscribeToken(String(freeUser._id));
    expect(isValidPluginWeeklyUnsubscribeToken(String(freeUser._id), token)).toBe(true);
    expect(isValidPluginWeeklyUnsubscribeToken("507f1f77bcf86cd799439012", token)).toBe(false);
    expect(isValidPluginWeeklyUnsubscribeToken(String(freeUser._id), "0".repeat(32))).toBe(false);
  });

  it("envia uma pauta ainda não mostrada, pelo chat de origem, e guarda qual foi", async () => {
    candidates([freeUser]);
    nextIdea({ _id: new Types.ObjectId("507f1f77bcf86cd799439031"), title: "O café que esfria", hook: "Todo dia", territory: "Maternidade" });
    const result = await runPluginWeeklyEmails({ now: new Date("2026-09-28T12:00:00Z") });
    expect(result.sent).toBe(1);
    expect(sendPluginWeeklyEmail).toHaveBeenCalledWith("creator@example.test", expect.objectContaining({
      clientLabel: "Claude",
      profileUrl: "https://data2content.ai/dashboard/plugin?source=claude&intent=pautas",
    }));
    expect(UserModel.updateOne).toHaveBeenCalledWith(
      { _id: freeUser._id },
      expect.objectContaining({ $push: { pluginWeeklyEmailIdeaIds: { $each: ["507f1f77bcf86cd799439031"], $slice: -10 } } }),
    );
  });

  it("para quando não há pauta nova e não escreve para assinante", async () => {
    candidates([freeUser, { ...freeUser, _id: new Types.ObjectId(), planStatus: "active" }]);
    nextIdea(null);
    const result = await runPluginWeeklyEmails();
    expect(result.sent).toBe(0);
    expect(result.skipped).toEqual({ no_new_idea: 1, already_pro: 1 });
    expect(sendPluginWeeklyEmail).not.toHaveBeenCalled();
  });

  it("a prévia não envia nem grava", async () => {
    candidates([freeUser]);
    nextIdea({ _id: new Types.ObjectId(), title: "Pauta" });
    const result = await runPluginWeeklyEmails({ dryRun: true });
    expect(result.preview).toHaveLength(1);
    expect(sendPluginWeeklyEmail).not.toHaveBeenCalled();
    expect(UserModel.updateOne).not.toHaveBeenCalled();
  });

  it("o e-mail entrega a pauta, fala do Pro numa linha só e tem saída", () => {
    const email = pluginWeeklyEmail({
      name: "Ana Souza",
      clientLabel: "ChatGPT",
      narrative: null,
      idea: { title: "Pauta <teste>", hook: null, territory: null },
      profileUrl: "https://data2content.ai/dashboard/plugin?source=chatgpt&intent=pautas",
      unsubscribeUrl: "https://data2content.ai/api/plugin/weekly-email/unsubscribe?u=1&t=2",
    });
    expect(email.subject).toBe("O que gravar esta semana: Pauta <teste>");
    expect(email.html).toContain("Pauta &lt;teste&gt;");
    expect(email.html).toContain("Não quero mais receber");
    expect(email.text).toContain("Oi, Ana!");
    expect(email.text.match(/Pro/g)).toHaveLength(1);
  });
});
