import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { loadPluginArrival } from "@/app/lib/plugin/arrival";
import {
  parsePluginClient,
  parsePluginIntent,
  resolvePluginReturnUrl,
} from "@/app/lib/plugin/pluginClient";
import { PluginArrivalClient } from "./PluginArrivalClient";

export const dynamic = "force-dynamic";

export default async function PluginArrivalPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; intent?: string }>;
}) {
  const params = await searchParams;
  const client = parsePluginClient(params.source) ?? "chatgpt";
  const intent = parsePluginIntent(params.intent);
  const selfPath = `/dashboard/plugin?source=${client}${intent ? `&intent=${intent}` : ""}`;

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect(`/login?callbackUrl=${encodeURIComponent(selfPath)}`);
  }

  const data = await loadPluginArrival({ userId, client, intent });
  // Quem já é Pro não precisa desta página: vai ao perfil de sempre.
  if (!data || data.accessLevel === "pro") {
    redirect(`/dashboard/profile?source=${client}`);
  }

  return (
    <PluginArrivalClient
      client={client}
      intent={intent}
      data={data}
      returnUrl={resolvePluginReturnUrl(
        client,
        client === "claude" ? process.env.NEXT_PUBLIC_CLAUDE_CONNECTOR_URL : process.env.NEXT_PUBLIC_CHATGPT_PLUGIN_URL,
      )}
    />
  );
}
