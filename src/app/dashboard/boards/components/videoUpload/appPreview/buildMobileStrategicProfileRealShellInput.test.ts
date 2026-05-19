import { buildMobileStrategicProfileRealShellInput } from "./buildMobileStrategicProfileRealShellInput";

describe("buildMobileStrategicProfileRealShellInput", () => {
  it("generates an anonymous state with auth gate when session is absent", () => {
    const input = buildMobileStrategicProfileRealShellInput({
      session: null,
    });

    expect(input.state.authState).toBe("anonymous");
    expect(input.state.profileAvailability).toBe("auth_gate");
    expect(input.loginHref).toContain("/login");
  });

  it("generates authenticated profile in construction/account_only state when no diagnosis is persisted", () => {
    const session = {
      user: {
        id: "123",
        name: "Arthur Teste",
        email: "arthur@test.com",
        instagramConnected: true,
        instagramUsername: "arthur.test",
        planStatus: "premium",
      },
    };

    const input = buildMobileStrategicProfileRealShellInput({
      session,
    });

    expect(input.state.authState).toBe("authenticated");
    expect(input.state.profileAvailability).toBe("construction");
    expect(input.state.displayName).toBe("Arthur Teste");
    expect(input.state.displayHandle).toBe("@arthur.test");
    expect(input.state.instagramState).toBe("connected");
    expect(input.state.subscriptionState).toBe("premium");
  });

  it("handles free users without instagram connection correctly", () => {
    const session = {
      user: {
        id: "123",
        name: "Ana Free",
        email: "ana@test.com",
        instagramConnected: false,
        planStatus: "inactive",
      },
    };

    const input = buildMobileStrategicProfileRealShellInput({
      session,
    });

    expect(input.state.authState).toBe("authenticated");
    expect(input.state.profileAvailability).toBe("construction");
    expect(input.state.displayName).toBe("Ana Free");
    expect(input.state.displayHandle).toBeNull();
    expect(input.state.instagramState).toBe("disconnected");
    expect(input.state.subscriptionState).toBe("inactive");
  });

  it("supports overriding state via query parameter for testing/QA purposes", () => {
    const session = {
      user: {
        id: "123",
        name: "Arthur Teste",
      },
    };

    const input = buildMobileStrategicProfileRealShellInput({
      session,
      stateQuery: "instagram_optimized",
    });

    expect(input.state.authState).toBe("authenticated");
    expect(input.state.instagramState).toBe("connected");
  });
});
