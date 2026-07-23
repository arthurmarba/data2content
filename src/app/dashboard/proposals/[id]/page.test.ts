import { redirect } from "next/navigation";

import LegacyProposalDetailPage from "./page";

jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

const redirectMock = redirect as unknown as jest.Mock;

describe("LegacyProposalDetailPage", () => {
  beforeEach(() => redirectMock.mockReset());

  it("redireciona o detalhe legado para a proposta em Campanhas", async () => {
    await LegacyProposalDetailPage({
      params: Promise.resolve({ id: "proposal/id 123" }),
    });

    expect(redirectMock).toHaveBeenCalledWith(
      "/campaigns?proposalId=proposal%2Fid%20123"
    );
  });
});
