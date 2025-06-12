/**
 * @fileoverview Utilitário para conversão de schemas Zod.
 * @version 1.2.0
 * @description Centraliza a funcionalidade de conversão de um schema Zod
 * para um JSON Schema, que é o formato esperado pela API da OpenAI.
 * Este utilitário utiliza a biblioteca 'zod-to-json-schema'.
 * ## Melhorias na Versão 1.2.0:
 * - **Correção de Erro de Tipo:** Removida a importação do tipo `JSONSchema7`
 * que não possuía um arquivo de declaração, resolvendo o erro de compilação.
 */

import { z } from 'zod';
import { zodToJsonSchema as zodToJsonSchemaLib } from 'zod-to-json-schema';

/**
 * Converte um schema Zod em um JSON Schema compatível com a OpenAI.
 * @param {z.ZodObject<any, any>} schema - O schema Zod a ser convertido.
 * @returns {object} O JSON Schema correspondente.
 */
export function convertZodToJsonSchema(schema: z.ZodObject<any, any>): object {
  const jsonSchema = zodToJsonSchemaLib(schema, "parameters");

  // Garante que o retorno sempre tenha a estrutura esperada pela OpenAI
  if (jsonSchema && typeof jsonSchema === 'object' && 'properties' in jsonSchema) {
    return jsonSchema;
  }
  
  // Retorna um schema vazio válido se a conversão falhar ou não tiver propriedades
  return { type: 'object', properties: {} };
}
