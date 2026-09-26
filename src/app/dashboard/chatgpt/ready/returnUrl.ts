import { resolvePluginReturnUrl } from "@/app/lib/plugin/pluginClient";

export function resolveChatGptPluginReturnUrl(value: unknown): string | null {
  return resolvePluginReturnUrl("chatgpt", value);
}
