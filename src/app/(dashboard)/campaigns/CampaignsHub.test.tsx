import { render, waitFor } from "@testing-library/react";

import { track } from "@/lib/track";

import CampaignsHub from "./CampaignsHub";

let searchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

jest.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "creator-1" } },
  }),
}));

jest.mock("@/lib/track", () => ({
  track: jest.fn(),
}));

jest.mock("@/app/dashboard/context/HeaderContext", () => ({
  useHeaderSetup: jest.fn(),
}));

jest.mock("@/app/dashboard/hooks/useBoardMobileViewport", () => ({
  __esModule: true,
  default: () => false,
}));

jest.mock("./CampaignsBoard", () => ({
  __esModule: true,
  default: () => <div>Campanhas</div>,
}));

describe("CampaignsHub analytics", () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    (track as jest.Mock).mockClear();
  });

  it("registra a origem explícita da entrada no CRM", async () => {
    searchParams = new URLSearchParams("proposalId=prop-1&source=email");

    render(<CampaignsHub />);

    await waitFor(() =>
      expect(track).toHaveBeenCalledWith("campaigns_hub_viewed", {
        creator_id: "creator-1",
        source: "email",
      })
    );
  });

  it("classifica um link de proposta sem origem como deep link", async () => {
    searchParams = new URLSearchParams("proposalId=prop-1");

    render(<CampaignsHub />);

    await waitFor(() =>
      expect(track).toHaveBeenCalledWith("campaigns_hub_viewed", {
        creator_id: "creator-1",
        source: "deep_link",
      })
    );
  });
});
