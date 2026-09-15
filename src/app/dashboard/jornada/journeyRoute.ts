import { redirect } from "next/navigation";
import { JOURNEY_ROUTE } from "@/constants/routes";

type SearchParams = Record<string, string | string[] | undefined> | undefined;

/**
 * Endereços antigos (Home, Perfil responsivo, Perfil mobile) abrem a Jornada sem
 * perder o contexto: retorno de checkout, Instagram, ações e origem continuam na
 * query. Os dois pedidos de aba das telas antigas viram a aba equivalente.
 */
export function buildJourneyHref(params: SearchParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
    for (const item of values) query.append(key, item);
  }
  if (!query.has("view")) {
    if (query.get("tab") === "collabs") query.set("view", "collabs");
    if (query.get("openCommunity") === "1") query.set("view", "comunidade");
  }
  query.delete("tab");
  query.delete("openCommunity");
  const search = query.toString();
  return search ? `${JOURNEY_ROUTE}?${search}` : JOURNEY_ROUTE;
}

export async function redirectToJourney(searchParams?: Promise<SearchParams> | SearchParams): Promise<never> {
  redirect(buildJourneyHref(await searchParams));
}
