import {
  analyzeLegacyCategoryValues,
  buildMetricClassificationMigrationPlan,
  buildMetricClassificationQuarantinePlan,
  inspectStoredCategoryValue,
} from "@/app/lib/classificationLegacy";

describe("classification legacy migration", () => {
  it("classifies canonical ids, labels and aliases correctly", () => {
    expect(inspectStoredCategoryValue("fashion_style", "context").bucket).toBe("canonical_id");
    expect(inspectStoredCategoryValue("Moda/Estilo", "context").bucket).toBe("canonical_label");
    expect(inspectStoredCategoryValue("lifestyle_and_wellbeing/fashion_style", "context")).toMatchObject({
      canonicalId: "fashion_style",
      bucket: "alias",
    });
    expect(inspectStoredCategoryValue("desconhecido", "context").bucket).toBe("unknown");
  });

  it("analyzes legacy values and detects safe deterministic migrations", () => {
    expect(analyzeLegacyCategoryValues(["Moda/Estilo", "lifestyle_and_wellbeing.fashion_style"], "context")).toMatchObject({
      canonicalValues: ["fashion_style"],
      unknownValues: [],
      canMigrateDeterministically: true,
      isAlreadyCanonical: false,
      hasChanges: true,
    });

    expect(analyzeLegacyCategoryValues(["reel"], "format")).toMatchObject({
      canonicalValues: ["reel"],
      unknownValues: [],
      canMigrateDeterministically: true,
      isAlreadyCanonical: true,
      hasChanges: false,
    });
  });

  it("blocks deterministic migration when unknown values exist in the same dimension", () => {
    expect(analyzeLegacyCategoryValues(["Reel", "announcement"], "format")).toMatchObject({
      canonicalValues: ["reel"],
      unknownValues: ["announcement"],
      canMigrateDeterministically: false,
      isAlreadyCanonical: false,
      hasChanges: true,
    });
  });

  it("builds partial per-field migration plans safely", () => {
    const plan = buildMetricClassificationMigrationPlan({
      format: ["Reel", "announcement"],
      proposal: ["Chamada"],
      context: ["lifestyle_and_wellbeing/fashion_style"],
      tone: ["promotional (Promocional/Comercial)"],
      references: ["geography.city"],
    });

    expect(plan.update).toEqual({
      proposal: [],
      context: ["fashion_style"],
      tone: ["promotional"],
      references: ["city"],
    });
    expect(plan.changedFields).toEqual(["proposal", "context", "tone", "references"]);
    expect(plan.blockedFields).toEqual(["format"]);
  });

  it("builds quarantine plans by preserving recognized values and isolating unknown residue", () => {
    const plan = buildMetricClassificationQuarantinePlan({
      format: ["Reel", "announcement"],
      proposal: ["Chamada"],
      classificationQuarantine: {
        format: ["legacy_value"],
      },
    });

    expect(plan.update).toEqual({
      format: ["reel"],
      proposal: [],
    });
    expect(plan.quarantineUpdate).toEqual({
      format: ["legacy_value", "announcement"],
    });
    expect(plan.changedFields).toEqual(["format", "proposal"]);
    expect(plan.quarantinedFields).toEqual(["format"]);
  });

  it("keeps quarantine planning idempotent when residue is already isolated", () => {
    const plan = buildMetricClassificationQuarantinePlan({
      format: ["reel"],
      classificationQuarantine: {
        format: ["announcement"],
      },
    });

    expect(plan.update).toEqual({});
    expect(plan.quarantineUpdate).toEqual({});
    expect(plan.changedFields).toEqual([]);
    expect(plan.quarantinedFields).toEqual([]);
  });
});
