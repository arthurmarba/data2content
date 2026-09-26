"use client";

import { PluginReturnLink } from "@/app/dashboard/plugin/PluginReturnLink";

export function ChatGptReturnLink({ href }: { href: string | null }) {
  return <PluginReturnLink client="chatgpt" href={href} />;
}
