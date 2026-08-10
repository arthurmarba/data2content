/**
 * CPF/CNPJ do cliente.
 *
 * A nota fiscal de serviço precisa identificar quem recebeu o serviço, então
 * sem documento não há nota. Validamos o dígito verificador aqui em vez de só
 * conferir o tamanho: um número com 11 dígitos que não fecha a conta é rejeitado
 * pela prefeitura na hora de emitir — e aí o erro aparece um mês depois, longe
 * da pessoa que poderia corrigir.
 */

export type TaxIdType = "cpf" | "cnpj";

export type TaxId = {
  /** Só dígitos — é assim que guardamos e mandamos para o Stripe. */
  value: string;
  type: TaxIdType;
};

/** Tipos de tax ID do Stripe correspondentes. */
export const STRIPE_TAX_ID_TYPE: Record<TaxIdType, "br_cpf" | "br_cnpj"> = {
  cpf: "br_cpf",
  cnpj: "br_cnpj",
};

export function stripTaxIdFormatting(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

function hasRepeatedDigits(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

export function isValidCpf(input: unknown): boolean {
  const digits = stripTaxIdFormatting(input);
  if (digits.length !== 11 || hasRepeatedDigits(digits)) return false;

  for (const [length, position] of [[9, 10], [10, 11]] as const) {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(digits[i]) * (position - i);
    }
    const remainder = (sum * 10) % 11;
    const check = remainder === 10 || remainder === 11 ? 0 : remainder;
    if (check !== Number(digits[length])) return false;
  }

  return true;
}

export function isValidCnpj(input: unknown): boolean {
  const digits = stripTaxIdFormatting(input);
  if (digits.length !== 14 || hasRepeatedDigits(digits)) return false;

  const check = (length: number) => {
    let sum = 0;
    let weight = length - 7;
    for (let i = 0; i < length; i++) {
      sum += Number(digits[i]) * weight;
      weight = weight - 1 < 2 ? 9 : weight - 1;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return check(12) === Number(digits[12]) && check(13) === Number(digits[13]);
}

/**
 * Devolve o documento normalizado, ou null se não for um CPF nem um CNPJ
 * válido. O tipo é inferido pelo tamanho — quem digita não precisa escolher.
 */
export function parseTaxId(input: unknown): TaxId | null {
  const digits = stripTaxIdFormatting(input);
  if (digits.length === 11) {
    return isValidCpf(digits) ? { value: digits, type: "cpf" } : null;
  }
  if (digits.length === 14) {
    return isValidCnpj(digits) ? { value: digits, type: "cnpj" } : null;
  }
  return null;
}

/** 123.456.789-09 / 12.345.678/0001-95 — só para exibir. */
export function formatTaxId(input: unknown): string {
  const digits = stripTaxIdFormatting(input);
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return digits;
}

/** Máscara progressiva, para o campo formatar enquanto a pessoa digita. */
export function maskTaxIdInput(input: unknown): string {
  const digits = stripTaxIdFormatting(input).slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

export const TAX_ID_INVALID_MESSAGE = "Informe um CPF ou CNPJ válido.";
