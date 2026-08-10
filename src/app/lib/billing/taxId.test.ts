import {
  formatTaxId,
  isValidCnpj,
  isValidCpf,
  maskTaxIdInput,
  parseTaxId,
  stripTaxIdFormatting,
} from "./taxId";

// Documentos sinteticamente válidos (dígito verificador fecha), não são de
// pessoas ou empresas reais.
const CPF = "52998224725";
const CNPJ = "11222333000181";

describe("isValidCpf", () => {
  it("accepts a CPF whose check digits close", () => {
    expect(isValidCpf(CPF)).toBe(true);
    expect(isValidCpf("529.982.247-25")).toBe(true);
  });

  it("rejects a CPF with the right length but wrong check digits", () => {
    expect(isValidCpf("52998224726")).toBe(false);
  });

  it("rejects repeated digits, which pass the naive check", () => {
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCpf("00000000000")).toBe(false);
  });

  it("rejects the wrong length", () => {
    expect(isValidCpf("5299822472")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });
});

describe("isValidCnpj", () => {
  it("accepts a CNPJ whose check digits close", () => {
    expect(isValidCnpj(CNPJ)).toBe(true);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
  });

  it("rejects wrong check digits and repeated digits", () => {
    expect(isValidCnpj("11222333000182")).toBe(false);
    expect(isValidCnpj("11111111111111")).toBe(false);
  });
});

describe("parseTaxId", () => {
  it("infers the type from the length, so nobody has to choose", () => {
    expect(parseTaxId("529.982.247-25")).toEqual({ value: CPF, type: "cpf" });
    expect(parseTaxId("11.222.333/0001-81")).toEqual({ value: CNPJ, type: "cnpj" });
  });

  it("returns null for anything that would be refused by the city", () => {
    expect(parseTaxId("12345678900")).toBeNull();
    expect(parseTaxId("123")).toBeNull();
    expect(parseTaxId(null)).toBeNull();
    expect(parseTaxId(undefined)).toBeNull();
    expect(parseTaxId(12345678900 as unknown)).toBeNull();
  });
});

describe("formatting", () => {
  it("strips every non-digit", () => {
    expect(stripTaxIdFormatting("529.982.247-25")).toBe(CPF);
  });

  it("formats for display", () => {
    expect(formatTaxId(CPF)).toBe("529.982.247-25");
    expect(formatTaxId(CNPJ)).toBe("11.222.333/0001-81");
  });

  it("masks progressively while typing", () => {
    expect(maskTaxIdInput("529")).toBe("529");
    expect(maskTaxIdInput("5299")).toBe("529.9");
    expect(maskTaxIdInput("52998224725")).toBe("529.982.247-25");
    expect(maskTaxIdInput("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("never lets the field grow past a CNPJ", () => {
    expect(stripTaxIdFormatting(maskTaxIdInput("112223330001819999"))).toHaveLength(14);
  });
});
