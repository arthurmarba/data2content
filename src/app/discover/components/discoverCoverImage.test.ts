import { getDiscoverCoverImageSrc } from "./discoverCoverImage";

describe("getDiscoverCoverImageSrc", () => {
  it("enables strict proxy mode for discover thumbnails", () => {
    expect(
      getDiscoverCoverImageSrc(
        "/api/proxy/thumbnail/https%3A%2F%2Fcdninstagram.com%2Fcover.jpg",
      ),
    ).toBe(
      "/api/proxy/thumbnail/https%3A%2F%2Fcdninstagram.com%2Fcover.jpg?strict=1",
    );
  });

  it("preserves existing thumbnail proxy query params", () => {
    expect(
      getDiscoverCoverImageSrc(
        "/api/proxy/thumbnail/https%3A%2F%2Fcdninstagram.com%2Fcover.jpg?v=2",
      ),
    ).toBe(
      "/api/proxy/thumbnail/https%3A%2F%2Fcdninstagram.com%2Fcover.jpg?v=2&strict=1",
    );
  });

  it("overrides stale strict proxy params", () => {
    expect(
      getDiscoverCoverImageSrc(
        "/api/proxy/thumbnail/https%3A%2F%2Fcdninstagram.com%2Fcover.jpg?strict=0",
      ),
    ).toBe(
      "/api/proxy/thumbnail/https%3A%2F%2Fcdninstagram.com%2Fcover.jpg?strict=1",
    );
  });

  it("does not change non-proxy image urls", () => {
    expect(getDiscoverCoverImageSrc("https://example.com/cover.jpg")).toBe(
      "https://example.com/cover.jpg",
    );
    expect(getDiscoverCoverImageSrc("")).toBeNull();
    expect(getDiscoverCoverImageSrc(null)).toBeNull();
  });
});
