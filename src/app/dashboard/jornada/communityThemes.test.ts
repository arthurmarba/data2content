import { communityThemes, creatorThemeKeys } from "./communityThemes";

const creators = [
  { niches: ["BELEZA;estética;cursos", "40anos"] },
  { niches: ["beleza", "Guia-gastronômico"] },
  { niches: ["Guia gastronômico", "Creatorr"] },
  { brandTerritories: ["Estética"], niches: ["ignorado"] },
  { niches: ["🌸✨", "Estilodevid"] },
];

it("separa, junta variações e esconde erro de digitação isolado e emoji", () => {
  expect(communityThemes(creators)).toEqual([
    { key: "beleza", label: "Beleza" },
    { key: "estetica", label: "Estética" },
    { key: "guiagastronomico", label: "Guia gastronômico" },
  ]);
});

it("filtra o criador pelas mesmas chaves normalizadas do filtro", () => {
  expect(creatorThemeKeys(creators[0]!)).toEqual(["beleza", "estetica", "cursos", "40anos"]);
  expect(creatorThemeKeys(creators[3]!)).toEqual(["estetica"]);
  expect(creatorThemeKeys(creators[4]!)).toEqual(["estilodevid"]);
});
