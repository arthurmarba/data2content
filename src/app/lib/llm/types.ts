// src/app/lib/llm/types.ts
//
// Núcleo provider-agnóstico de acesso a LLM (Fase 0 da migração — ver
// docs/llm-provider-migration-plan.md). Define a interface única que OpenAI e
// Gemini implementam. A seleção de provider e o fallback vivem em index.ts.

export type LlmIntensity = "low" | "medium" | "high";

export type LlmProviderName = "openai" | "gemini";

export interface LlmGenerateParams {
  prompt: string;
  /** Instrução de sistema (system prompt / systemInstruction). */
  system?: string;
  /** Controla qualidade × custo. Cada provider mapeia para seu próprio modelo. */
  intensity?: LlmIntensity;
  maxTokens?: number;
  /**
   * Override de temperatura. Quando ausente, usa o default da intensidade.
   * Útil para call-sites que precisam de controle fino (ex.: classificação a 0.1).
   */
  temperature?: number;
  /**
   * Override de modelo. Quando presente, o provider usa este modelo no lugar do
   * mapeado pela intensidade — desde que pertença àquele provider (o Gemini ignora
   * nomes `gpt-*` e mantém seu Flash). Preserva escolhas de modelo já existentes
   * em call-sites legados sem reespalhar strings pelo código.
   */
  model?: string;
  /** Pede saída JSON (ativa json mode no OpenAI / responseMimeType no Gemini). */
  json?: boolean;
  /**
   * Schema JSON opcional. O Gemini usa como `responseSchema` (saída estrita);
   * o OpenAI ignora além de ligar o json mode. Default: sem schema.
   */
  jsonSchema?: Record<string, unknown>;
}

export interface LlmResult {
  text: string;
  provider: LlmProviderName;
  model: string;
}

export interface LlmProvider {
  readonly name: LlmProviderName;
  /** True se há credencial/condições para usar este provider. */
  available(): boolean;
  generate(params: LlmGenerateParams): Promise<LlmResult>;
}

/** Temperatura por intensidade — compartilhada entre providers. */
export const TEMPERATURE_BY_INTENSITY: Record<LlmIntensity, number> = {
  low: 0.4,
  medium: 0.2,
  high: 0,
};

/** maxTokens default por intensidade — compartilhado entre providers. */
export const DEFAULT_MAX_TOKENS_BY_INTENSITY: Record<LlmIntensity, number> = {
  low: 1024,
  medium: 2048,
  high: 2048,
};
