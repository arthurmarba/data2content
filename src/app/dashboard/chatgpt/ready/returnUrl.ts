export function resolveChatGptPluginReturnUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;

    const isGenericChatGptHome =
      (url.hostname === "chatgpt.com" || url.hostname === "www.chatgpt.com")
      && url.pathname === "/"
      && !url.search
      && !url.hash;
    if (isGenericChatGptHome) return null;

    return url.toString();
  } catch {
    return null;
  }
}
