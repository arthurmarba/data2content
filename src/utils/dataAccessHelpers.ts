// src/utils/dataAccessHelpers.ts

/**
 * Safely retrieves a nested numeric value from an object using a dot-separated path.
 * @param obj The object to traverse.
 * @param path A dot-separated string representing the path to the nested value.
 * @returns The numeric value if found and is a number, otherwise null.
 */
export function getNestedValue(obj: any, path: string): number | null {
  if (!obj || typeof path !== 'string') {
    return null;
  }
  const parts = path.split('.');
  let value = obj;
  for (const part of parts) {
    if (value === null || typeof value !== 'object' || !value.hasOwnProperty(part)) {
      return null;
    }
    value = value[part];
  }
  return typeof value === 'number' ? value : null;
}

// Outras funções auxiliares de acesso a dados ou manipulação podem ser adicionadas aqui no futuro.
