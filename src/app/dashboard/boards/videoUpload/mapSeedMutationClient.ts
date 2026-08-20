// src/app/dashboard/boards/videoUpload/mapSeedMutationClient.ts
//
// A regra de mutação do MapaSeed, em um lugar só.
//
// Ela vivia dentro do `DiagnosticoPage`, colada ao `setState` daquela tela. Com
// a tela de narrativa do Perfil editando as MESMAS seções, copiar a função
// produziria duas verdades sobre a mesma regra — e o dia em que uma delas
// mudasse (o de-duplicar por minúsculas, o override de grupo dos assets) a outra
// continuaria com o comportamento antigo, em silêncio.
//
// A parte pura é separada do fetch de propósito: o otimismo tem que ser testável
// sem rede, e a rede não decide nada aqui — o servidor reconcilia no refresh.

import type { AssetGroupOverride, IMapaData, LifeAssetGroupKey } from "@/app/models/MapaSeed";

export const MAP_SEED_ENDPOINT = "/api/dashboard/mobile-strategic-profile/map-seed";

export type MapSeedSection =
  | "narrativa_central"
  | "tom"
  | "territorios"
  | "temas"
  | "assets"
  | "narrativas_adjacentes"
  | "formatos";

export type MapSeedOp = "add" | "remove" | "set";

/** Escalares têm teto no servidor; espelhar aqui evita otimismo maior que a verdade. */
const SCALAR_MAX_LENGTH = 200;

function sameLabel(a: string, b: string) {
  return a.trim().toLocaleLowerCase("pt-BR") === b.trim().toLocaleLowerCase("pt-BR");
}

/**
 * Aplica a mutação no mapa em memória, com a MESMA regra do servidor.
 *
 * Devolve um objeto novo — nunca muta o recebido — para o React enxergar a
 * mudança sem depender de identidade compartilhada entre telas.
 */
export function applyMapSeedMutation(
  mapa: IMapaData | null,
  section: MapSeedSection,
  op: MapSeedOp,
  value: string,
  group?: LifeAssetGroupKey,
): IMapaData | null {
  if (!mapa) return mapa;

  const clone = { ...mapa } as Record<string, unknown>;

  if (op === "set") {
    clone[section] = value.slice(0, SCALAR_MAX_LENGTH);
    return clone as unknown as IMapaData;
  }

  const current = Array.isArray(clone[section]) ? [...(clone[section] as string[])] : [];
  if (op === "add") {
    if (!current.some((item) => sameLabel(item, value))) current.push(value);
    clone[section] = current;
  } else {
    clone[section] = current.filter((item) => !sameLabel(item, value));
  }

  // O grupo de um asset adicionado à mão é escolha do criador, não da heurística
  // de palavra-chave. Espelhar o override localmente faz o chip cair na seção
  // certa na hora, em vez de pular de lugar quando o refresh chegar.
  if (section === "assets") {
    const groups = (Array.isArray(clone.assetGroups) ? clone.assetGroups : []) as AssetGroupOverride[];
    const without = groups.filter((entry) => !sameLabel(entry.label, value));
    clone.assetGroups = op === "add" && group ? [...without, { label: value, group }] : without;
  }

  return clone as unknown as IMapaData;
}

/**
 * Persiste a mutação. Falha de rede é não-fatal por desenho: o estado otimista
 * já está na tela e o próximo carregamento reconcilia com o servidor. Devolve se
 * gravou, para quem quiser avisar — ninguém é obrigado a olhar.
 */
export async function persistMapSeedMutation(
  section: MapSeedSection,
  op: MapSeedOp,
  value: string,
  group?: LifeAssetGroupKey,
): Promise<boolean> {
  try {
    const response = await fetch(MAP_SEED_ENDPOINT, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, op, value, ...(group ? { group } : {}) }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
