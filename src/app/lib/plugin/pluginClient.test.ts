import {
  parsePluginClient,
  parsePluginIntent,
  pluginClientFromNextTarget,
  pluginFunnelEventName,
  resolvePluginReturnUrl,
} from "./pluginClient";

describe("origem do plugin", () => {
  it("só aceita os dois chats conhecidos", () => {
    expect(parsePluginClient("claude")).toBe("claude");
    expect(parsePluginClient("chatgpt")).toBe("chatgpt");
    expect(parsePluginClient("gemini")).toBeNull();
    expect(parsePluginIntent("pautas")).toBe("pautas");
    expect(parsePluginIntent("checkout")).toBeNull();
  });

  it("mantém o Claude fora do evento que alimenta os anúncios da OpenAI", () => {
    expect(pluginFunnelEventName("claude")).toBe("claude_funnel_event");
    expect(pluginFunnelEventName("chatgpt")).toBe("chatgpt_funnel_event");
    expect(pluginClientFromNextTarget("claude-plugin")).toBe("claude");
  });

  it("volta ao Claude mesmo sem URL configurada, mas não à home genérica do ChatGPT", () => {
    expect(resolvePluginReturnUrl("claude", undefined)).toBe("https://claude.ai/new");
    expect(resolvePluginReturnUrl("chatgpt", undefined)).toBeNull();
    expect(resolvePluginReturnUrl("chatgpt", "https://chatgpt.com/")).toBeNull();
    expect(resolvePluginReturnUrl("chatgpt", "https://chatgpt.com/g/data2content")).toBe("https://chatgpt.com/g/data2content");
  });
});
