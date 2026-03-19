import { shouldSidebarIntentPrefetch } from "./hooks";

describe("sidebar prefetch policy", () => {
  it("bloqueia prefetch da descoberta via sidebar", () => {
    expect(shouldSidebarIntentPrefetch("/planning/discover")).toBe(false);
    expect(shouldSidebarIntentPrefetch("/dashboard/discover")).toBe(false);
    expect(shouldSidebarIntentPrefetch("/planning/discover?format=reels")).toBe(false);
  });

  it("mantem prefetch para rotas leves do dashboard", () => {
    expect(shouldSidebarIntentPrefetch("/planning/roteiros")).toBe(true);
    expect(shouldSidebarIntentPrefetch("/planning/planner")).toBe(true);
    expect(shouldSidebarIntentPrefetch("/dashboard/chat")).toBe(true);
  });
});
