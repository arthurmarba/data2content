import { describeScriptAdjustTarget, detectScriptAdjustScope } from "./adjustScope";

describe("scripts/adjustScope", () => {
  it("detects scoped scene adjustments", () => {
    const scope = detectScriptAdjustScope("Ajuste apenas a Cena 2 para ficar mais curta.");
    expect(scope.mode).toBe("patch");
    expect(scope.target).toEqual({ type: "scene", index: 2 });
    expect(scope.isPartialEdit).toBe(true);
    expect(describeScriptAdjustTarget(scope.target)).toBe("Cena 2");
  });

  it("detects paragraph and first/last paragraph intents", () => {
    const byNumber = detectScriptAdjustScope("Melhore o parágrafo 3.");
    expect(byNumber.target).toEqual({ type: "paragraph", index: 3 });

    const first = detectScriptAdjustScope("otimize o primeiro parágrafo");
    expect(first.target).toEqual({ type: "first_paragraph" });

    const last = detectScriptAdjustScope("Ajuste o último parágrafo do roteiro");
    expect(last.target).toEqual({ type: "last_paragraph" });
  });

  it("detects explicit full rewrite/new script when no target is provided", () => {
    const rewrite = detectScriptAdjustScope("Reescreva tudo do zero com outra abordagem");
    expect(rewrite.mode).toBe("rewrite_full");
    expect(rewrite.target.type).toBe("none");

    const newScript = detectScriptAdjustScope("Crie um novo roteiro para esse tema");
    expect(newScript.mode).toBe("new_script");
    expect(newScript.target.type).toBe("none");
  });
});
