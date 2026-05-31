/** @jest-environment jsdom */
import { buildNextUrl } from "./page";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

jest.mock("@/lib/track", () => ({
  track: jest.fn(),
}));

describe("Instagram connecting return target", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("volta ao Perfil Narrativo com instagramLinked=true quando veio do paywall", () => {
    window.sessionStorage.setItem(
      "d2c.paywall.return",
      JSON.stringify({
        returnTo: "/dashboard/boards/mobile-strategic-profile",
      }),
    );

    expect(buildNextUrl("narrative-map")).toBe(
      "/dashboard/boards/mobile-strategic-profile?instagramLinked=true",
    );
    expect(window.sessionStorage.getItem("d2c.paywall.return")).toBeNull();
  });

  it("usa o Perfil Narrativo como fallback canônico para next=narrative-map", () => {
    expect(buildNextUrl("narrative-map")).toBe(
      "/dashboard/boards/mobile-strategic-profile?instagramLinked=true",
    );
  });
});
