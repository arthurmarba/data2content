import type {
  AssetGroupOverride,
  IMapaData,
  LifeAssetGroupKey,
} from "@/app/models/MapaSeed";

/** Aplica a mesma mutação otimista usada pela API sem alterar o objeto anterior. */
export function applyStrategicMapMutation(
  previous: IMapaData,
  section: string,
  op: "add" | "remove" | "set",
  value: string,
  group?: LifeAssetGroupKey,
): IMapaData {
  const clone = { ...previous } as Record<string, unknown>;

  if (op === "set") {
    clone[section] = value.trim().slice(0, 200);
    return clone as unknown as IMapaData;
  }

  const current = Array.isArray(clone[section]) ? [...(clone[section] as string[])] : [];
  const normalizedValue = value.toLocaleLowerCase("pt-BR").trim();

  clone[section] = op === "add"
    ? current.some((item) => item.toLocaleLowerCase("pt-BR").trim() === normalizedValue)
      ? current
      : [...current, value.trim()]
    : current.filter((item) => item.toLocaleLowerCase("pt-BR").trim() !== normalizedValue);

  if (section === "assets") {
    const groups = (Array.isArray(clone.assetGroups) ? clone.assetGroups : []) as AssetGroupOverride[];
    const remainingGroups = groups.filter(
      (entry) => entry.label.toLocaleLowerCase("pt-BR").trim() !== normalizedValue,
    );
    clone.assetGroups = op === "add" && group
      ? [...remainingGroups, { label: value.trim(), group }]
      : remainingGroups;
  }

  return clone as unknown as IMapaData;
}
