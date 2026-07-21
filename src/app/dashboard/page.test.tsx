import { redirect } from "next/navigation";

import DashboardHomePage from "./page";

jest.mock("next/navigation", () => ({ redirect: jest.fn() }));
jest.mock("./home/HomeClientPage", () => ({
  __esModule: true,
  default: () => <div>Authenticated Home</div>,
}));

const redirectMock = redirect as unknown as jest.Mock;

describe("DashboardHomePage", () => {
  beforeEach(() => redirectMock.mockReset());

  it("renders the authenticated Home instead of redirecting to the public landing page", async () => {
    const page = await DashboardHomePage({ searchParams: Promise.resolve({}) });

    expect(page).toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("preserves the legacy post creation deep link", async () => {
    await DashboardHomePage({
      searchParams: Promise.resolve({ board: "post-creation", draft: "draft-1" }),
    });

    expect(redirectMock).toHaveBeenCalledWith("/calendar?draft=draft-1");
  });
});
