import { AsyncLocalStorage } from "node:async_hooks";
import { collectionPolicyForUrl } from "./collectionPolicy";

const USER_AGENT = "Data2Content-Public-Campaign-Radar/0.2 (+https://data2content.ai; contato@data2content.ai)";
const budget = new AsyncLocalStorage<{ requests: number; deadline: number; robots: Map<string, Promise<string>> }>();

export function withCollectionBudget<T>(work: () => Promise<T>): Promise<T> {
  return budget.run({ requests: 0, deadline: Date.now() + 40_000, robots: new Map() }, work);
}

export function robotsAllows(text: string, path: string): boolean {
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; path: string }> }> = [];
  let group = { agents: [] as string[], rules: [] as Array<{ allow: boolean; path: string }> };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0]?.trim() ?? "";
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      if (group.rules.length) { groups.push(group); group = { agents: [], rules: [] }; }
      group.agents.push(value.toLowerCase());
    } else if ((key === "allow" || key === "disallow") && value && group.agents.length) {
      group.rules.push({ allow: key === "allow", path: value });
    }
  }
  groups.push(group);
  const specific = groups.filter((item) => item.agents.some((agent) => agent !== "*" && USER_AGENT.toLowerCase().startsWith(agent)));
  const selected = specific.length ? specific : groups.filter((item) => item.agents.includes("*"));
  const rules = selected.flatMap((item) => item.rules).filter((rule) => {
    const pattern = rule.path.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${pattern}`).test(path);
  }).sort((a, b) => b.path.replace(/[*$]/g, "").length - a.path.replace(/[*$]/g, "").length || Number(b.allow) - Number(a.allow));
  return rules[0]?.allow ?? true;
}

async function requestText(url: string, timeoutMs: number, robots = false): Promise<string> {
  const state = budget.getStore()!;
  if (++state.requests > 12 || Date.now() >= state.deadline) throw new Error("radar_request_budget_exhausted");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, state.deadline - Date.now()));
  try {
    const response = await fetch(url, {
      headers: { Accept: "text/html,application/xml,text/plain", "User-Agent": USER_AGENT },
      redirect: "manual", signal: controller.signal,
    });
    // Não seguir redirecionamentos para login, hosts pagos ou destinos não revisados.
    if (robots && (response.status === 404 || response.status === 410)) return "";
    if (!response.ok) throw new Error(`radar_http_${response.status}`);
    if (Number(response.headers.get("content-length") ?? 0) > 2_000_000) throw new Error("radar_response_too_large");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("radar_empty_response");
    const decoder = new TextDecoder();
    let result = "", size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > (robots ? 100_000 : 2_000_000)) throw new Error("radar_response_too_large");
        result += decoder.decode(part.value, { stream: true });
      }
      return result + decoder.decode();
    } finally { await reader.cancel().catch(() => undefined); }
  } finally { clearTimeout(timer); }
}

export async function fetchPublicText(url: string, timeoutMs = 10_000): Promise<string> {
  collectionPolicyForUrl(url);
  if (!budget.getStore()) return withCollectionBudget(() => fetchPublicText(url, timeoutMs));
  const parsed = new URL(url);
  const state = budget.getStore()!;
  let robots = state.robots.get(parsed.origin);
  if (!robots) {
    robots = requestText(`${parsed.origin}/robots.txt`, timeoutMs, true);
    state.robots.set(parsed.origin, robots);
  }
  if (!robotsAllows(await robots, parsed.pathname + parsed.search)) throw new Error("radar_robots_blocked");
  return requestText(parsed.href, timeoutMs);
}
