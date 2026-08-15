import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import CollabsPinnedBoard from "./CollabsPinnedBoard";

const mockPush = jest.fn();
const mockBilling = {
  hasPremiumAccess: true,
  hasResolvedOnce: true,
};

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "user-1" } },
    status: "authenticated",
  }),
}));

jest.mock("@/app/hooks/useBillingStatus", () => ({
  __esModule: true,
  default: () => mockBilling,
}));

jest.mock("@/app/dashboard/components/Board", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/app/dashboard/boards/videoUpload/contentIdeaLocalDecisions", () => ({
  contentIdeaLocalDecisionStorageKey: () => "collabs-test",
  forgetContentIdeaLocalDecision: jest.fn(),
  readContentIdeaLocalDecisions: () => new Map(),
  rememberContentIdeaLocalDecision: jest.fn(),
}));

jest.mock("@/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoCollabsFeed", () => ({
  DiagnosticoCollabsFeed: (props: {
    bootstrapStatus: string;
    bootstrapError?: string | null;
    pautaCollabs?: Map<string, unknown>;
    onRetryBootstrap?: () => void;
  }) => (
    <div>
      <span data-testid="bootstrap-status">{props.bootstrapStatus}</span>
      <span data-testid="match-count">{props.pautaCollabs?.size ?? 0}</span>
      {props.bootstrapError ? <span>{props.bootstrapError}</span> : null}
      <button type="button" onClick={props.onRetryBootstrap}>Retry</button>
    </div>
  ),
}));

function response(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("CollabsPinnedBoard — bootstrap real", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBilling.hasPremiumAccess = true;
    global.fetch = jest.fn();
  });

  it("mantém o deck bloqueado até os matches de collab terminarem", async () => {
    let resolveMatches!: (value: Response) => void;
    const matchesPending = new Promise<Response>((resolve) => {
      resolveMatches = resolve;
    });
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/content-ideas")) return Promise.resolve(response({ ideas: [{ id: "pauta-1", opportunityBrief: { kind: "collab_optional" } }] }));
      if (url.endsWith("/strategic-map/summary")) return Promise.resolve(response({ summary: { narrative: "Autonomia" } }));
      if (url.endsWith("/collabs/interest")) return Promise.resolve(response({ ok: true, decisions: [], matches: [] }));
      if (url.endsWith("/collabs/per-pauta")) return matchesPending;
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<CollabsPinnedBoard />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(4));
    expect(screen.getByTestId("bootstrap-status")).toHaveTextContent("loading");
    expect(screen.getByTestId("match-count")).toHaveTextContent("0");

    await act(async () => {
      resolveMatches(response({ ok: true, matches: { "pauta-1": { id: "creator-1" } } }));
    });

    await waitFor(() => expect(screen.getByTestId("bootstrap-status")).toHaveTextContent("ready"));
    expect(screen.getByTestId("match-count")).toHaveTextContent("1");
    const matchRequest = (global.fetch as jest.Mock).mock.calls.find(([url]) => String(url).endsWith("/collabs/per-pauta"));
    expect(JSON.parse(matchRequest?.[1]?.body as string).pautas[0].opportunityKind).toBe("collab_optional");
  });

  it("expõe falha de bootstrap e permite tentar novamente", async () => {
    let ideasAttempts = 0;
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/content-ideas")) {
        ideasAttempts += 1;
        return Promise.resolve(ideasAttempts === 1 ? response({}, false) : response({ ideas: [] }));
      }
      if (url.endsWith("/strategic-map/summary")) return Promise.resolve(response({ summary: { narrative: "Autonomia" } }));
      if (url.endsWith("/collabs/interest")) return Promise.resolve(response({ ok: true, decisions: [], matches: [] }));
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<CollabsPinnedBoard />);

    await waitFor(() => expect(screen.getByTestId("bootstrap-status")).toHaveTextContent("error"));
    expect(screen.getByText("Não foi possível carregar suas ideias e parcerias.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByTestId("bootstrap-status")).toHaveTextContent("ready"));
    expect(global.fetch).toHaveBeenCalledTimes(6);
  });

  it("não chama a rota Pro de matches para usuário free", async () => {
    mockBilling.hasPremiumAccess = false;
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/content-ideas")) return Promise.resolve(response({ ideas: [{ id: "pauta-1" }] }));
      if (url.endsWith("/strategic-map/summary")) return Promise.resolve(response({ summary: { narrative: "Autonomia" } }));
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<CollabsPinnedBoard />);

    await waitFor(() => expect(screen.getByTestId("bootstrap-status")).toHaveTextContent("ready"));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
