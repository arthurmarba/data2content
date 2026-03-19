import {
  contextCategories,
  formatCategories,
  proposalCategories,
  referenceCategories,
  toCanonicalCategoryId,
  toneCategories,
  type Category,
  type CategoryType,
} from "@/app/lib/classification";

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
    type: CategoryType;
    categories: Category[];
  }> = [
    { type: "format", categories: formatCategories },
    { type: "proposal", categories: proposalCategories },
    { type: "context", categories: contextCategories },
    { type: "tone", categories: toneCategories },
    { type: "reference", categories: referenceCategories },
  ];

  it("exposes only canonical ids across all visible discover filter options", () => {
    for (const { type, categories } of discoverTrees) {
      const nonCanonical = flattenVisibleOptions(categories).filter(
        (option) => toCanonicalCategoryId(option.id, type) !== option.id
      );

      expect(nonCanonical).toEqual([]);
    }
  });

  it("does not expose duplicate visible options that resolve to the same canonical id", () => {
    for (const { type, categories } of discoverTrees) {
      const byCanonicalId = new Map<string, VisibleOption[]>();

      for (const option of flattenVisibleOptions(categories)) {
        const canonicalId = toCanonicalCategoryId(option.id, type);
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

      for (const option of flattenVisibleOptions(categories)) {
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
