import { redirect } from "next/navigation";

import LegacyProposalsPage from "./page";

jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

const redirectMock = redirect as unknown as jest.Mock;

describe("LegacyProposalsPage", () => {
  beforeEach(() => redirectMock.mockReset());

  it("redireciona a rota legada para Campanhas", () => {
    LegacyProposalsPage({});

    expect(redirectMock).toHaveBeenCalledWith("/campaigns");
  });

  it("preserva os parâmetros de busca existentes", () => {
    LegacyProposalsPage({
      searchParams: { proposalId: "proposal-1", status: ["novo", "negociacao"] },
    });

    expect(redirectMock).toHaveBeenCalledWith(
      "/campaigns?proposalId=proposal-1&status=novo&status=negociacao"
    );
  });
});
