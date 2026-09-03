import {
  campaignRadarSourceRegistry,
  isSourceApprovedForPlugin,
  pluginDistributionValidationIssues,
  sourceRegistryEntry,
} from "./sourceRegistry";

describe("campaign radar source registry", () => {
  test("uses unique ids and valid public entry URLs", () => {
    const ids = campaignRadarSourceRegistry.map((entry) => entry.sourceId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of campaignRadarSourceRegistry) {
      expect(new URL(entry.publicCheckUrl).protocol).toBe("https:");
      expect(new URL(entry.creatorEntryUrl).protocol).toBe("https:");
      expect(entry.expectedPublicSignals.length).toBeGreaterThan(0);
    }
  });

  test("does not mark authenticated inventories as directly eligible without evidence", () => {
    for (const sourceId of ["influency-me", "comu-delas", "noovid"]) {
      expect(sourceRegistryEntry(sourceId)).toMatchObject({
        inventoryVisibility: "authenticated",
        reportPolicy: "campaign_evidence_required",
      });
    }
  });

  test("records Creators LLC public programs separately from its authenticated jobs", () => {
    const creators = sourceRegistryEntry("creators-llc");
    expect(creators).toMatchObject({
      inventoryVisibility: "authenticated",
      reportPolicy: "programs_require_review",
    });
    expect(creators?.notes.join(" ")).toContain("Druid Creator Hub");
  });

  test("registers new public sources as automated and campaign-eligible", () => {
    for (const sourceId of [
      "ninety-nine-freelas-public",
      "animextreme-public-creators",
      "upabc-public-coverage",
      "tijuca-geek-public-coverage",
    ]) {
      expect(sourceRegistryEntry(sourceId)).toMatchObject({
        inventoryVisibility: "public",
        collectionModes: ["automated_public"],
        reportPolicy: "campaigns_eligible",
      });
    }
  });

  test("blocks sources whose public terms explicitly prohibit automated collection", () => {
    for (const sourceId of [
      "influencer-brasil",
      "creator-ads-public-calls",
      "animextreme-public-creators",
    ]) {
      expect(sourceRegistryEntry(sourceId)?.pluginDistribution).toMatchObject({
        status: "blocked",
        authorizationBasis: null,
        reviewedAt: "2026-09-01",
        reviewedBy: "public-terms-audit",
      });
      expect(isSourceApprovedForPlugin(sourceId)).toBe(false);
    }
  });

  test("keeps every source out of the plugin until distribution is explicitly approved", () => {
    for (const entry of campaignRadarSourceRegistry) {
      expect(entry.pluginDistribution.status).not.toBe("approved");
    }
  });

  test("has an internally consistent distribution decision for every source", () => {
    for (const entry of campaignRadarSourceRegistry) {
      expect(pluginDistributionValidationIssues(entry)).toEqual([]);
    }
  });
});
