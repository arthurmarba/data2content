// Tela de chegada de quem clicou num link vindo do ChatGPT ou do Claude.
//
// É a página informativa que a regra da OpenAI permite linkar: mostra o que a
// pessoa pediu (as pautas dela, a narrativa dela) e descreve o que o plano
// inclui. A assinatura só começa se a pessoa clicar.

import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { getMcpAccountState } from "@/app/lib/mcp/accountState";
import { loadMcpCreatorMap } from "@/app/lib/mcp/creatorMap";
import { logUsageEvent } from "@/app/lib/dataService/usageEventService";
import CreatorContentIdeaModel from "@/app/models/CreatorContentIdea";
import { requestFirstContentIdeas } from "./firstIdeas";
import type { PluginClient, PluginIntent } from "./pluginClient";

export interface PluginArrivalIdea {
  id: string;
  title: string;
  territory: string | null;
  hook: string | null;
}

export interface PluginArrivalData {
  accessLevel: "free" | "pro";
  instagramConnected: boolean;
  narrative: string | null;
  territories: string[];
  narrativeIsFirm: boolean;
  ideas: PluginArrivalIdea[];
  /** ready: há pautas; preparing: a amostra está na fila; waiting_map: o mapa ainda não sustenta pauta. */
  ideasState: "ready" | "preparing" | "waiting_map" | "unavailable";
}

function compact(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export async function loadPluginArrival(params: {
  userId: string;
  client: PluginClient;
  intent: PluginIntent | null;
}): Promise<PluginArrivalData | null> {
  if (!Types.ObjectId.isValid(params.userId)) return null;
  const accountState = await getMcpAccountState(params.userId);
  if (!accountState.accountAvailable) return null;

  await connectToDatabase();
  const [map, ideaDocs] = await Promise.all([
    loadMcpCreatorMap(params.userId).catch(() => null),
    CreatorContentIdeaModel.find({
      userId: new Types.ObjectId(params.userId),
      status: { $in: ["active", "saved"] },
    })
      .sort({ generatedAt: -1 })
      .limit(3)
      .select("_id title territory hook")
      .lean(),
  ]);

  const ideas: PluginArrivalIdea[] = ideaDocs.map((idea) => ({
    id: String(idea._id),
    title: compact(idea.title, 160) ?? "Pauta",
    territory: compact(idea.territory, 80),
    hook: compact(idea.hook, 220),
  }));

  // Pauta nasce de narrativa + território: sem os dois, não adianta pedir a amostra.
  const mapSupportsIdeas = Boolean(map?.narrative) && (map?.territories.length ?? 0) > 0;
  let ideasState: PluginArrivalData["ideasState"] = "ready";
  if (!ideas.length) {
    if (!mapSupportsIdeas) {
      ideasState = "waiting_map";
    } else {
      const request = await requestFirstContentIdeas(params.userId);
      ideasState = request.state === "unavailable" ? "unavailable" : "preparing";
    }
  }

  logUsageEvent(params.userId, "plugin_arrival_viewed", "plugin", {
    client: params.client,
    intent: params.intent,
    accessLevel: accountState.accessLevel,
    ideasState,
  });

  return {
    accessLevel: accountState.accessLevel,
    instagramConnected: accountState.instagramConnected,
    narrative: map?.narrative ?? null,
    territories: map?.territories.slice(0, 4) ?? [],
    narrativeIsFirm: map?.narrativeIsFirm ?? false,
    ideas,
    ideasState,
  };
}
