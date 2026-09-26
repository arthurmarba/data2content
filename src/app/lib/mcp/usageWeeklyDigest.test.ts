/** @jest-environment node */
import { mcpUsageWeeklyEmail } from "@/emails/mcpUsageWeekly";
import { previousClosedWeek, sendMcpUsageWeeklyDigest } from "./usageWeeklyDigest";
import { buildMcpUsageReport } from "./usageReport";

jest.mock("./usageReport", () => ({ buildMcpUsageReport: jest.fn() }));
jest.mock("./config", () => ({ getMcpAdminServerUrl: () => "https://data2content.ai/api/mcp/admin" }));

describe("resumo semanal do conector", () => {
  it("fecha a semana anterior de segunda a domingo, no horário de São Paulo", () => {
    // Segunda 28/09 às 9h em São Paulo.
    expect(previousClosedWeek(new Date("2026-09-28T12:00:00Z"))).toEqual({ startDate: "2026-09-21", endDate: "2026-09-27" });
    // Domingo 27/09 às 23h em São Paulo (já segunda em UTC): a semana ainda não fechou.
    expect(previousClosedWeek(new Date("2026-09-28T02:00:00Z"))).toEqual({ startDate: "2026-09-14", endDate: "2026-09-20" });
  });

  it("não envia nada sem destinatário configurado", async () => {
    const original = process.env.MCP_USAGE_REPORT_TO;
    delete process.env.MCP_USAGE_REPORT_TO;
    expect(await sendMcpUsageWeeklyDigest()).toEqual({ sent: 0, reason: "no_recipients" });
    expect(buildMcpUsageReport).not.toHaveBeenCalled();
    if (original !== undefined) process.env.MCP_USAGE_REPORT_TO = original;
  });

  it("o e-mail traz adesão, retenção, o mais usado e os pedidos", () => {
    const email = mcpUsageWeeklyEmail({
      schemaVersion: "mcp_usage_report_v1",
      period: { startDate: "2026-09-21", endDate: "2026-09-27", days: 7, timeZone: "America/Sao_Paulo" },
      summary: { activeCreators: 12, activeByClient: { claude: 11, chatgpt: 1 }, calls: 140, sessions: 30, estimatedMinutes: 95, planGates: 3, errors: 1, averageActiveDaysPerCreator: 2.5 },
      retention: { previousPeriod: { startDate: "2026-09-14", endDate: "2026-09-20" }, activeInPreviousPeriod: 10, returnedFromPreviousPeriod: 8, rate: 0.8, newThisPeriod: 4 },
      daily: [],
      perCreator: [{ creatorRef: "creator:1", name: "Ana", username: "ana", plan: "active", clients: ["claude"], activeDays: 4, calls: 40, sessions: 6, estimatedMinutes: 30, planGates: 0, errors: 0, lastUsedAt: "2026-09-27T12:00:00Z", topTools: [] }],
      topTools: [{ tool: "get_script_evidence_pack", calls: 50, creators: 8 }],
      planGates: [{ feature: "analise", hits: 3, creators: 2 }],
      errors: [],
      requests: [{ at: "2026-09-27T12:00:00Z", creatorRef: "creator:1", username: "ana", client: "claude", tool: "get_script_evidence_pack", request: "prompt: Roteiro <sobre> licença", blockedByPlan: null, error: false }],
      notes: [],
    }, "https://data2content.ai/api/mcp/admin");
    expect(email.subject).toBe("Conector D2C: 12 creators ativos (2026-09-21 a 2026-09-27)");
    expect(email.text).toContain("8 de 10 voltaram da semana anterior (80%)");
    expect(email.text).toContain("roteiro com referências próprias: 50 usos, 8 creators");
    expect(email.html).toContain("Roteiro &lt;sobre&gt; licença");
  });
});
