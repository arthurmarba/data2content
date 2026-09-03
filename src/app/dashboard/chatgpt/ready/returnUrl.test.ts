import { resolveChatGptPluginReturnUrl } from "./returnUrl";

describe("resolveChatGptPluginReturnUrl", () => {
  it("accepts an exact HTTPS plugin URL", () => {
    expect(resolveChatGptPluginReturnUrl("https://chatgpt.com/apps/data2content"))
      .toBe("https://chatgpt.com/apps/data2content");
  });

  it.each([undefined, "", "https://chatgpt.com/", "http://chatgpt.com/apps/data2content", "not-a-url"])(
    "rejects a missing, generic, or unsafe return URL: %p",
    (value) => {
      expect(resolveChatGptPluginReturnUrl(value)).toBeNull();
    },
  );
});
