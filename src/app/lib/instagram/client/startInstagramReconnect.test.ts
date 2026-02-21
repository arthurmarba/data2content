import { startInstagramReconnect } from "./startInstagramReconnect";

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
}));

jest.mock("@/lib/track", () => ({
  track: jest.fn(),
}));

import { signIn } from "next-auth/react";
import { track } from "@/lib/track";

describe("startInstagramReconnect", () => {
  const mockSignIn = signIn as jest.Mock;
  const mockTrack = track as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = jest.fn();
  });

  it("starts reconnect flow and forwards flowId to canonical callback", async () => {
    (global as any).fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ flowId: "igrc_test_123" }),
    });

    await startInstagramReconnect({
      nextTarget: "media-kit",
      source: "media_kit_page",
    });

    expect((global as any).fetch).toHaveBeenCalledWith(
      "/api/auth/iniciar-vinculacao-fb",
      expect.objectContaining({ method: "POST" })
    );
    expect(mockSignIn).toHaveBeenCalledWith("facebook", {
      callbackUrl:
        "/dashboard/instagram/connecting?instagramLinked=true&next=media-kit&flowId=igrc_test_123",
    });
    expect(mockTrack).toHaveBeenCalledWith("ig_reconnect_started", {
      source: "media_kit_page",
    });
    expect(mockTrack).not.toHaveBeenCalledWith(
      "ig_reconnect_failed",
      expect.anything()
    );
  });

  it("throws and tracks failure when start endpoint returns non-ok", async () => {
    (global as any).fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Falha ao preparar a vinculação." }),
    });

    await expect(
      startInstagramReconnect({
        nextTarget: "chat",
        source: "chat_panel",
      })
    ).rejects.toThrow("Falha ao preparar a vinculação.");

    expect(mockTrack).toHaveBeenCalledWith("ig_reconnect_started", {
      source: "chat_panel",
    });
    expect(mockTrack).toHaveBeenCalledWith("ig_reconnect_failed", {
      source: "chat_panel",
      error_code: "UNKNOWN",
    });
    expect(mockSignIn).not.toHaveBeenCalled();
  });
});
