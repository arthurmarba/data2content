import { render, screen, waitFor } from "@testing-library/react";

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

  it("does not render mobile marketplace metrics cards at the top", async () => {
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

    expect(screen.queryByText("Ativos")).not.toBeInTheDocument();
    expect(screen.queryByText("Alcance")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps filter container configured as hidden on mobile breakpoint", async () => {
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

    const mobileSearch = screen.getByPlaceholderText("Buscar");
    const filterContainer = mobileSearch.closest("div.sticky");
    expect(filterContainer).toBeTruthy();
    expect(filterContainer?.className).toContain("hidden");
    expect(filterContainer?.className).toContain("sm:block");

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

    const firstCard = screen.getByText("Creator 1").closest("article");
    expect(firstCard).toBeTruthy();
    expect(firstCard?.className).toContain("w-[var(--market-card-width)]");
    expect(firstCard?.className).toContain("min-w-[var(--market-card-width)]");
    expect(screen.getAllByText("Seg.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Eng.").length).toBeGreaterThan(0);

    const railScroller = firstCard?.parentElement;
    expect(railScroller).toBeTruthy();
    expect(railScroller?.getAttribute("style")).toContain("clamp(100px, calc((100% - 1.875rem) / 3.25), 112px)");

    const mobileCtas = screen.getAllByText("Enviar Proposta");
    expect(mobileCtas.length).toBeGreaterThan(0);
    expect(mobileCtas[0]?.className).toContain("whitespace-nowrap");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
