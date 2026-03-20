import {
  contextCategories,
  formatCategories,
  referenceCategories,
  toCanonicalCategoryId,
  type Category,
  type CategoryType,
} from "@/app/lib/classification";
import {
  contentIntentCategories,
  contentSignalCategories,
  narrativeFormCategories,
} from "@/app/lib/classificationV2";
import {
  commercialModeCategories,
  proofStyleCategories,
  stanceCategories,
} from "@/app/lib/classificationV2_5";

type VisibleOption = {
  id: string;
  label: string;
  parentId: string | null;
};

const flattenVisibleOptions = (categories: Category[]): VisibleOption[] => {
  return categories.flatMap((category) => [
    { id: category.id, label: category.label, parentId: null },
    ...((category.subcategories ?? []).map((subcategory) => ({
      id: subcategory.id,
      label: subcategory.label,
      parentId: category.id,
    }))),
  ]);
};

const normalizeLabel = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[_./\\|:>#~\[\]-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("discover filter catalog", () => {
  const discoverTrees: Array<{
    type:
      | CategoryType
      | "contentIntent"
      | "narrativeForm"
      | "contentSignals"
      | "stance"
      | "proofStyle"
      | "commercialMode";
    categories: Array<Category | { id: string; label: string }>;
  }> = [
    { type: "format", categories: formatCategories },
    { type: "contentIntent", categories: contentIntentCategories },
    { type: "context", categories: contextCategories },
    { type: "narrativeForm", categories: narrativeFormCategories },
    { type: "proofStyle", categories: proofStyleCategories },
    { type: "stance", categories: stanceCategories },
    { type: "commercialMode", categories: commercialModeCategories },
    { type: "contentSignals", categories: contentSignalCategories },
    { type: "reference", categories: referenceCategories },
  ];

  const isStrategicFlatType = (type: (typeof discoverTrees)[number]["type"]) =>
    type === "contentIntent" ||
    type === "narrativeForm" ||
    type === "contentSignals" ||
    type === "stance" ||
    type === "proofStyle" ||
    type === "commercialMode";

  it("exposes only canonical ids across all visible discover filter options", () => {
    for (const { type, categories } of discoverTrees) {
      if (isStrategicFlatType(type)) {
        const duplicates = categories.filter((option) => !option.id);
        expect(duplicates).toEqual([]);
        continue;
      }

      const nonCanonical = flattenVisibleOptions(categories as Category[]).filter(
        (option) => toCanonicalCategoryId(option.id, type) !== option.id
      );

      expect(nonCanonical).toEqual([]);
    }
  });

  it("does not expose duplicate visible options that resolve to the same canonical id", () => {
    for (const { type, categories } of discoverTrees) {
      const byCanonicalId = new Map<string, VisibleOption[]>();

      const options =
        isStrategicFlatType(type)
          ? (categories as Array<{ id: string; label: string }>).map((option) => ({
              id: option.id,
              label: option.label,
              parentId: null,
            }))
          : flattenVisibleOptions(categories as Category[]);

      for (const option of options) {
        const canonicalId = isStrategicFlatType(type)
          ? option.id
          : toCanonicalCategoryId(option.id, type);
        if (!canonicalId) continue;
        const group = byCanonicalId.get(canonicalId) ?? [];
        group.push(option);
        byCanonicalId.set(canonicalId, group);
      }

      const duplicates = Array.from(byCanonicalId.values()).filter((group) => group.length > 1);
      expect(duplicates).toEqual([]);
    }
  });

  it("does not expose duplicate-like labels inside the same discover filter dimension", () => {
    for (const { categories } of discoverTrees) {
      const byNormalizedLabel = new Map<string, VisibleOption[]>();

      const options = Array.isArray(categories) && "subcategories" in (categories[0] || {})
        ? flattenVisibleOptions(categories as Category[])
        : (categories as Array<{ id: string; label: string }>).map((option) => ({
            id: option.id,
            label: option.label,
            parentId: null,
          }));

      for (const option of options) {
        const key = normalizeLabel(option.label);
        const group = byNormalizedLabel.get(key) ?? [];
        group.push(option);
        byNormalizedLabel.set(key, group);
      }

      const duplicates = Array.from(byNormalizedLabel.values()).filter((group) => group.length > 1);
      expect(duplicates).toEqual([]);
    }
  });
});
