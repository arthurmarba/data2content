import { isCreatorWeeklyProfileExperienceEnabled } from "./creatorWeeklyProfileFeatureFlag";

describe("isCreatorWeeklyProfileExperienceEnabled", () => {
  it("fica ativo por padrão e aceita rollback explícito", () => {
    expect(isCreatorWeeklyProfileExperienceEnabled({})).toBe(true);
    expect(isCreatorWeeklyProfileExperienceEnabled({ MOBILE_PROFILE_WEEKLY_REPORT_EXPERIENCE_ENABLED: "1" })).toBe(true);
    expect(isCreatorWeeklyProfileExperienceEnabled({ MOBILE_PROFILE_WEEKLY_REPORT_EXPERIENCE_ENABLED: "0" })).toBe(false);
  });
});
