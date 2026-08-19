// src/app/dashboard/boards/videoUpload/territoryContext.ts
//
// Liga o TERRITÓRIO do mapa do criador ("Maternidade", "Bem-estar") ao CONTEXTO
// canônico da classificação ("parenting", "health_wellness"), que é a chave pela
// qual os posts de toda a base D2C são filtrados.
//
// São dois vocabulários diferentes por bom motivo: o território é escrito pela
// própria criadora, com as palavras dela; o contexto é uma gaveta fechada usada
// para comparar gente diferente. A ponte é determinística — rótulo, palavras-chave
// e descrição do registro de classificação —, sem IA no caminho.

import { getCategoryById, contextCategories } from "@/app/lib/classification";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

/** Todos os contextos, inclusive os de segundo nível, com rótulo e palavras-chave. */
function flatContexts(): Array<{ id: string; label: string; keywords: string[] }> {
  const flat: Array<{ id: string; label: string; keywords: string[] }> = [];
  const walk = (nodes: readonly any[]) => {
    for (const node of nodes ?? []) {
      if (node?.id && node?.label) {
        flat.push({
          id: String(node.id),
          label: String(node.label),
          keywords: Array.isArray(node.keywords) ? node.keywords.map(String) : [],
        });
      }
      if (Array.isArray(node?.subcategories)) walk(node.subcategories);
    }
  };
  walk(contextCategories as unknown as readonly any[]);
  return flat;
}

/**
 * O contexto que melhor representa o território.
 *
 * Ordem de tentativa: rótulo idêntico → palavra-chave idêntica → rótulo ou
 * palavra-chave contida no território (e vice-versa). Sem casamento, devolve null
 * — e a seção de inspiração simplesmente não aparece, em vez de mostrar o
 * conteúdo mais visto de um assunto que não é o da pessoa.
 */
export function resolveTerritoryContextId(territory: string | null | undefined): string | null {
  const target = normalize(territory ?? "");
  if (target.length < 3) return null;

  const contexts = flatContexts();

  const exactLabel = contexts.find((context) => normalize(context.label) === target);
  if (exactLabel) return exactLabel.id;

  const exactKeyword = contexts.find((context) =>
    context.keywords.some((keyword) => normalize(keyword) === target),
  );
  if (exactKeyword) return exactKeyword.id;

  const partial = contexts.find((context) => {
    const label = normalize(context.label);
    if (label.length >= 4 && (target.includes(label) || label.includes(target))) return true;
    return context.keywords.some((keyword) => {
      const normalized = normalize(keyword);
      return normalized.length >= 4 && (target.includes(normalized) || normalized.includes(target));
    });
  });

  return partial?.id ?? null;
}

/** O primeiro território do mapa que tem contexto correspondente. */
export function resolveFirstTerritoryContext(
  territories: Array<string | null | undefined>,
): { territory: string; contextId: string } | null {
  for (const territory of territories) {
    const contextId = resolveTerritoryContextId(territory);
    if (contextId && territory) return { territory, contextId };
  }
  return null;
}

/** Rótulo do contexto para a tela ("Parentalidade"), quando precisar nomear a gaveta. */
export function contextLabel(contextId: string): string | null {
  return getCategoryById(contextId, "context")?.label ?? null;
}
