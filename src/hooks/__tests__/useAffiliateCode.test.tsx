import { renderHook, waitFor } from "@testing-library/react";
import { useAffiliateCode } from "../useAffiliateCode";

jest.mock("next-auth/react", () => ({
  useSession: () => ({ data: null }),
}));

function setLocation(search: string) {
  Object.defineProperty(window, "location", {
    value: new URL(`http://localhost${search}`),
    writable: true,
  });
}

describe("useAffiliateCode", () => {
  beforeEach(() => {
    setLocation("");
    document.cookie = "d2c_ref=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    localStorage.clear();
  });

  it("reads code from query string and stores to localStorage", async () => {
    setLocation("?ref=abc123");
    const { result } = renderHook(() => useAffiliateCode());
    await waitFor(() => expect(result.current).toBe("ABC123"));
    expect(localStorage.getItem("d2c_ref")).toBe("ABC123");
  });

  it("falls back to cookie when no query", async () => {
    document.cookie = "d2c_ref=XYZ789";
    const { result } = renderHook(() => useAffiliateCode());
    await waitFor(() => expect(result.current).toBe("XYZ789"));
  });

  it("uses localStorage when no query or cookie", async () => {
    localStorage.setItem("d2c_ref", "lsCode");
    const { result } = renderHook(() => useAffiliateCode());
    await waitFor(() => expect(result.current).toBe("LSCODE"));
  });
});

