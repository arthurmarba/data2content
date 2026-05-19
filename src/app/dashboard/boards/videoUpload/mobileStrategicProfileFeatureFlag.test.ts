import { isMobileStrategicProfileEnabled } from "./mobileStrategicProfileFeatureFlag";

const originalPublicEnvValue = process.env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_ENABLED;
const originalServerEnvValue = process.env.MOBILE_STRATEGIC_PROFILE_SERVER_ENABLED;

afterEach(() => {
  if (originalPublicEnvValue === undefined) {
    delete process.env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_ENABLED;
  } else {
    process.env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_ENABLED = originalPublicEnvValue;
  }

  if (originalServerEnvValue === undefined) {
    delete process.env.MOBILE_STRATEGIC_PROFILE_SERVER_ENABLED;
  } else {
    process.env.MOBILE_STRATEGIC_PROFILE_SERVER_ENABLED = originalServerEnvValue;
  }
});

describe("mobileStrategicProfileFeatureFlag", () => {
  it("enables the strategic profile when public env flag is 1", () => {
    process.env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_ENABLED = "1";
    expect(isMobileStrategicProfileEnabled()).toBe(true);
  });

  it("enables the strategic profile when server env flag is 1", () => {
    process.env.MOBILE_STRATEGIC_PROFILE_SERVER_ENABLED = "1";
    expect(isMobileStrategicProfileEnabled()).toBe(true);
  });

  it("keeps disabled when both are off or absent", () => {
    delete process.env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_ENABLED;
    delete process.env.MOBILE_STRATEGIC_PROFILE_SERVER_ENABLED;
    expect(isMobileStrategicProfileEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_ENABLED = "0";
    process.env.MOBILE_STRATEGIC_PROFILE_SERVER_ENABLED = "0";
    expect(isMobileStrategicProfileEnabled()).toBe(false);
  });
});
