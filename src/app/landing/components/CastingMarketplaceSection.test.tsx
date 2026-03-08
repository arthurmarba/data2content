import { render, screen, waitFor, within } from "@testing-library/react";

import CastingMarketplaceSection from "./CastingMarketplaceSection";
import type { LandingCreatorHighlight } from "@/types/landing";

jest.mock("@/hooks/useUtmAttribution", () => ({
  useUtmAttribution: () => ({
    appendUtm: (url: string) => url,
    utm: {},
  }),
}));

jest.mock("@/lib/track", () => ({
  track: jest.fn(),
}));

function makeCreator(id: string, name: string): LandingCreatorHighlight {
  return {
    id,
    name,
    username: name.toLowerCase().replace(/\s+/g, "_"),
    followers: 1000,
    niches: ["Beleza"],
    brandTerritories: ["Skincare"],
    contexts: ["Beleza e cuidados pessoais"],
    totalInteractions: 5000,
    totalReach: 20000,
    postCount: 12,
    avgInteractionsPerPost: 416.6,
    avgReachPerPost: 1666.6,
    rank: 1,
    mediaKitSlug: `mk-${id}`,
  };
}

function mockMobileViewport() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 767px)",
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

describe("CastingMarketplaceSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMobileViewport();
  });

  it("syncs creators when initialCreators changes from fallback to real", async () => {
    const fallbackCreators = [makeCreator("fallback-1", "Fallback Creator")];
    const realCreators = [
      makeCreator("real-1", "Real Creator 1"),
      makeCreator("real-2", "Real Creator 2"),
    ];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        creators: fallbackCreators,
        total: 1,
        offset: 0,
        limit: 12,
        hasMore: false,
      }),
    }) as unknown as typeof fetch;

    const { rerender } = render(
      <CastingMarketplaceSection initialCreators={fallbackCreators} metrics={null} />,
    );

    expect(screen.getByText("Fallback Creator")).toBeInTheDocument();

    rerender(<CastingMarketplaceSection initialCreators={realCreators} metrics={null} />);

    await waitFor(() => {
      expect(screen.getByText("Real Creator 1")).toBeInTheDocument();
    });
    expect(screen.queryByText("Fallback Creator")).not.toBeInTheDocument();
  });

  it("requests full mode and renders returned creators without showing 'ver mais'", async () => {
    const initialCreators = Array.from({ length: 12 }, (_, index) =>
      makeCreator(`creator-${index + 1}`, `Creator ${index + 1}`),
    );

    const moreCreators = [makeCreator("creator-13", "Creator 13"), makeCreator("creator-14", "Creator 14")];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        creators: moreCreators,
        total: 14,
        offset: 12,
        limit: 12,
        hasMore: false,
      }),
    }) as unknown as typeof fetch;

    render(<CastingMarketplaceSection initialCreators={initialCreators} metrics={null} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("mode=full");
    expect(calledUrl).toContain("offset=0");
    expect(calledUrl).not.toContain("limit=");

    await waitFor(() => {
      expect(screen.getByText("Creator 13")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /ver mais criadores/i })).not.toBeInTheDocument();
  });

  it("renders the marketplace integrated into the mobile free-flow section", async () => {
    const initialCreators = Array.from({ length: 4 }, (_, index) =>
      makeCreator(`creator-${index + 1}`, `Creator ${index + 1}`),
    );

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        creators: initialCreators,
        total: 4,
        offset: 0,
        limit: 4,
        hasMore: false,
      }),
    }) as unknown as typeof fetch;

    render(<CastingMarketplaceSection initialCreators={initialCreators} metrics={null} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const integratedLayout = screen.getByTestId("marketplace-mobile-integrated-layout");
    const mobileBridge = within(integratedLayout).getByTestId("mobile-gallery-bridge");
    expect(integratedLayout).toBeInTheDocument();
    expect(integratedLayout.className).not.toContain("rounded-[1.7rem]");
    expect(integratedLayout.className).not.toContain("shadow-[0_18px_38px_rgba(20,33,61,0.05)]");
    expect(within(integratedLayout).queryByText(/nossa comunidade/i)).not.toBeInTheDocument();
    expect(within(mobileBridge).queryByText("Beleza")).not.toBeInTheDocument();
    expect(within(integratedLayout).queryByText(/nosso banco de talentos/i)).not.toBeInTheDocument();
  });

  it("does not render the filter bar on the mobile integrated marketplace", async () => {
    const initialCreators = Array.from({ length: 4 }, (_, index) =>
      makeCreator(`creator-${index + 1}`, `Creator ${index + 1}`),
    );

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        creators: initialCreators,
        total: 4,
        offset: 0,
        limit: 4,
        hasMore: false,
      }),
    }) as unknown as typeof fetch;

    render(<CastingMarketplaceSection initialCreators={initialCreators} metrics={null} />);

    expect(screen.queryByTestId("marketplace-filter-bar")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  it("still renders creators immediately while full data request happens in background", async () => {
    const initialCreators = Array.from({ length: 4 }, (_, index) =>
      makeCreator(`creator-${index + 1}`, `Creator ${index + 1}`),
    );

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        creators: initialCreators,
        total: 4,
        offset: 0,
        limit: 4,
        hasMore: false,
      }),
    }) as unknown as typeof fetch;

    render(<CastingMarketplaceSection initialCreators={initialCreators} metrics={null} />);

    expect(screen.getByText("Creator 1")).toBeInTheDocument();
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  it("uses compact mobile rail width class for marketplace cards", async () => {
    const initialCreators = Array.from({ length: 4 }, (_, index) =>
      makeCreator(`creator-${index + 1}`, `Creator ${index + 1}`),
    );

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        creators: initialCreators,
        total: 4,
        offset: 0,
        limit: 4,
        hasMore: false,
      }),
    }) as unknown as typeof fetch;

    render(<CastingMarketplaceSection initialCreators={initialCreators} metrics={null} />);

    expect(screen.getByTestId("marketplace-mobile-integrated-layout")).toBeInTheDocument();
    expect(screen.queryByText(/nosso banco de talentos/i)).not.toBeInTheDocument();

    const firstCard = screen.getByText("Creator 1").closest("article");
    expect(firstCard).toBeTruthy();
    expect(firstCard?.className).toContain("w-[var(--market-card-width)]");
    expect(firstCard?.className).toContain("min-w-[var(--market-card-width)]");
    expect(screen.getAllByText("Seguidores").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Taxa de Eng.").length).toBeGreaterThan(0);

    const railScroller = screen.getByTestId("marketplace-mobile-rail");
    expect(railScroller).toBeTruthy();
    expect(railScroller.className).toContain("snap-mandatory");
    expect(railScroller.getAttribute("style")).toContain("clamp(112px, calc((100% - 2.75rem) / 2.95), 126px)");

    const mobileCtas = screen.getAllByText("Conhecer");
    expect(mobileCtas.length).toBeGreaterThan(0);
    expect(mobileCtas[0]?.className).toContain("whitespace-nowrap");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
