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

describe("CollabsPinnedBoard — fontes independentes", () => {
  beforeEach(() => { jest.clearAllMocks(); global.fetch = jest.fn(); });
  it("carrega parceiros persistidos sem depender de ideias ativas nem chamar IA", async () => {
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/content-ideas?')) return Promise.resolve(response({ ideas: [] }));
      if (url.endsWith('/collabs/interest')) return Promise.resolve(response({ ok: true, decisions: [{ pautaId: 'p1', decision: 'interested', collab: { id: 'original' } }], matches: [], suggestions: {}, ideas: [] }));
      throw new Error(url);
    });
    render(<CollabsPinnedBoard />);
    await waitFor(() => expect(screen.getByTestId('bootstrap-status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('match-count')).toHaveTextContent('1');
    expect((global.fetch as jest.Mock).mock.calls.every(([url]) => !String(url).endsWith('/collabs/per-pauta'))).toBe(true);
  });
  it("preserva o histórico se a leitura das ideias falha e permite repetir", async () => {
    let fail = true;
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/content-ideas?')) return Promise.resolve(response({ ideas: [] }, !fail));
      return Promise.resolve(response({ ok: true, decisions: [], matches: [{ pautaId: 'p1', collab: { id: 'original' } }], suggestions: {}, ideas: [] }));
    });
    render(<CollabsPinnedBoard />);
    await waitFor(() => expect(screen.getByTestId('match-count')).toHaveTextContent('1'));
    expect(screen.getByRole('alert')).toHaveTextContent('Uma parte');
    fail = false; fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByTestId('match-count')).toHaveTextContent('1');
  });
});
