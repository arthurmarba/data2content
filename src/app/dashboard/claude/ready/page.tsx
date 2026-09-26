import { PluginReadyScreen } from "@/app/dashboard/plugin/PluginReadyScreen";

export default async function ClaudeReadyPage({
  searchParams,
}: {
  searchParams: Promise<{ instagramLinked?: string }>;
}) {
  const params = await searchParams;
  return <PluginReadyScreen client="claude" instagramLinked={params.instagramLinked === "true"} />;
}
