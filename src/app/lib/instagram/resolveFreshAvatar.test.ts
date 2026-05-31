import { profilePictureExpiry, isProfilePictureStale } from "./resolveFreshAvatar";

// URL estilo fbcdn com parâmetro oe (hex epoch) controlável.
const urlWithOe = (epochSeconds: number) =>
  `https://scontent.fstu2-1.fna.fbcdn.net/v/t51.2885-15/pic.jpg?oe=${epochSeconds.toString(16).toUpperCase()}`;

const nowSec = () => Math.floor(Date.now() / 1000);

describe("profilePictureExpiry", () => {
  it("parses the oe param (hex epoch) into a Date", () => {
    const exp = nowSec() + 5 * 86400;
    const d = profilePictureExpiry(urlWithOe(exp));
    expect(d).toBeInstanceOf(Date);
    expect(Math.abs(d!.getTime() - exp * 1000)).toBeLessThan(1000);
  });

  it("returns null for url without oe", () => {
    expect(profilePictureExpiry("https://x.fbcdn.net/pic.jpg")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(profilePictureExpiry(null)).toBeNull();
    expect(profilePictureExpiry(undefined)).toBeNull();
  });
});

describe("isProfilePictureStale", () => {
  it("fresh when oe is comfortably in the future (>2 days)", () => {
    expect(isProfilePictureStale(urlWithOe(nowSec() + 5 * 86400))).toBe(false);
  });

  it("stale when oe is within the 2-day threshold", () => {
    expect(isProfilePictureStale(urlWithOe(nowSec() + 12 * 3600))).toBe(true);
  });

  it("stale when oe is already in the past", () => {
    expect(isProfilePictureStale(urlWithOe(nowSec() - 3600))).toBe(true);
  });

  it("stale when url is missing or has no oe", () => {
    expect(isProfilePictureStale(null)).toBe(true);
    expect(isProfilePictureStale("https://x.fbcdn.net/pic.jpg")).toBe(true);
  });
});
