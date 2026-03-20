import { groupOptionsByDisplay } from "@/app/discover/components/DiscoverChips";

describe("DiscoverChips", () => {
  it("groups leaf-only filter options by display group when there is no visible root", () => {
    const grouped = groupOptionsByDisplay([
      {
        id: "fashion_style",
        label: "Moda/Estilo",
        depth: 1,
        groupId: "lifestyle_and_wellbeing",
        groupLabel: "Estilo de Vida e Bem-Estar",
        hasChildren: false,
      },
      {
        id: "beauty_personal_care",
        label: "Beleza/Cuidados Pessoais",
        depth: 1,
        groupId: "lifestyle_and_wellbeing",
        groupLabel: "Estilo de Vida e Bem-Estar",
        hasChildren: false,
      },
    ]);

    expect(grouped).toEqual([
      {
        key: "lifestyle_and_wellbeing",
        label: "Estilo de Vida e Bem-Estar",
        root: null,
        children: [
          expect.objectContaining({ id: "fashion_style" }),
          expect.objectContaining({ id: "beauty_personal_care" }),
        ],
      },
    ]);
  });
});
