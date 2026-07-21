import { render, screen, waitFor } from "@testing-library/react";

import { FeatureFlagProvider, useFeatureFlag } from "./FeatureFlagsContext";

function FlagProbe() {
  const { enabled, loading } = useFeatureFlag("paywall.modal_enabled");
  return <output>{`${loading ? "loading" : "ready"}:${enabled ? "enabled" : "disabled"}`}</output>;
}

describe("FeatureFlagProvider", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("uses local defaults without requesting remote flags on lightweight public routes", () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    render(
      <FeatureFlagProvider loadRemoteFlags={false}>
        <FlagProbe />
      </FeatureFlagProvider>,
    );

    expect(screen.getByText("ready:enabled")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads remote flags when product infrastructure becomes active", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { "paywall.modal_enabled": false } }),
    });
    global.fetch = fetchMock as typeof fetch;

    const { rerender } = render(
      <FeatureFlagProvider loadRemoteFlags={false}>
        <FlagProbe />
      </FeatureFlagProvider>,
    );

    rerender(
      <FeatureFlagProvider loadRemoteFlags>
        <FlagProbe />
      </FeatureFlagProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("ready:disabled")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
