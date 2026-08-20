import {
  MAX_CANCELLATION_COMMENT_LENGTH,
  validateCancellationRequest,
} from "./cancellation";

describe("validateCancellationRequest", () => {
  it("requires at least one known reason", () => {
    expect(validateCancellationRequest({ reasons: [], comment: "Motivo suficiente" })).toEqual({
      ok: false,
      message: "Selecione pelo menos um motivo de cancelamento.",
    });
    expect(validateCancellationRequest({ reasons: ["inventado"], comment: "Motivo suficiente" })).toEqual({
      ok: false,
      message: "Um ou mais motivos de cancelamento são inválidos.",
    });
  });

  it("rejects comments that are too short or too long", () => {
    expect(validateCancellationRequest({ reasons: ["Outro"], comment: "ok" }).ok).toBe(false);
    expect(
      validateCancellationRequest({
        reasons: ["Outro"],
        comment: "x".repeat(MAX_CANCELLATION_COMMENT_LENGTH + 1),
      }).ok,
    ).toBe(false);
  });

  it("normalizes a valid request and maps the Stripe feedback", () => {
    expect(
      validateCancellationRequest({
        reasons: ["Não uso o suficiente", "Não uso o suficiente"],
        comment: "  Estou sem tempo para utilizar.  ",
      }),
    ).toEqual({
      ok: true,
      value: {
        reasons: ["Não uso o suficiente"],
        comment: "Estou sem tempo para utilizar.",
        stripeFeedback: "unused",
      },
    });
  });
});
