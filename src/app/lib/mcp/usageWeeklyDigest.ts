// E-mail semanal interno com o uso do conector. Destinatários em
// MCP_USAGE_REPORT_TO (separados por vírgula); sem a variável, não envia.

import { buildMcpUsageReport } from "./usageReport";
import { getMcpAdminServerUrl } from "./config";

const DAY_MS = 86_400_000;

/** Semana fechada anterior, de segunda a domingo, em dias civis de São Paulo. */
export function previousClosedWeek(now = new Date()): { startDate: string; endDate: string } {
  const saoPauloNoon = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const weekday = (saoPauloNoon.getUTCDay() + 6) % 7; // segunda = 0
  const lastSunday = new Date(saoPauloNoon.getTime() - (weekday + 1) * DAY_MS);
  const lastMonday = new Date(lastSunday.getTime() - 6 * DAY_MS);
  return { startDate: lastMonday.toISOString().slice(0, 10), endDate: lastSunday.toISOString().slice(0, 10) };
}

export async function sendMcpUsageWeeklyDigest(now = new Date()) {
  const recipients = (process.env.MCP_USAGE_REPORT_TO ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
  if (!recipients.length) return { sent: 0, reason: "no_recipients" as const };
  const week = previousClosedWeek(now);
  const report = await buildMcpUsageReport({ ...week, includeRequests: true, requestLimit: 30 });
  const { sendMcpUsageWeeklyEmail } = await import("@/app/lib/emailService");
  for (const to of recipients) await sendMcpUsageWeeklyEmail(to, report, getMcpAdminServerUrl());
  return { sent: recipients.length, activeCreators: report.summary.activeCreators, ...week };
}
