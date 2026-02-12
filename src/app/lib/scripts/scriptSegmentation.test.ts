import { mergeScopedSegment, resolveScopedSegment } from "./scriptSegmentation";

const SCENE_SCRIPT = `
[CENA 1: ABERTURA]
Chegada com energia e apresentação.

[CENA 2: DESENVOLVIMENTO]
Explica a dor principal com exemplo real.

[CENA 3: FECHAMENTO]
Finaliza com CTA para comentar.
`.trim();

describe("scripts/scriptSegmentation", () => {
  it("resolves and merges scene-specific changes preserving other scenes", () => {
    const resolved = resolveScopedSegment(SCENE_SCRIPT, { type: "scene", index: 2 });
    expect(resolved).not.toBeNull();
    expect(resolved?.segment.text).toContain("CENA 2");

    const merged = mergeScopedSegment(
      SCENE_SCRIPT,
      resolved!,
      "Nova explicação da dor principal com linguagem mais curta."
    );

    expect(merged).toContain("CENA 1");
    expect(merged).toContain("CENA 2");
    expect(merged).toContain("CENA 3");
    expect(merged).toContain("Nova explicação da dor principal");
    expect(merged).toContain("Finaliza com CTA para comentar.");
  });

  it("resolves paragraph targeting when there are no scene headings", () => {
    const paragraphScript = [
      "Parágrafo de abertura.",
      "Parágrafo de desenvolvimento.",
      "Parágrafo de fechamento.",
    ].join("\n\n");

    const first = resolveScopedSegment(paragraphScript, { type: "first_paragraph" });
    expect(first?.segment.text).toContain("abertura");

    const third = resolveScopedSegment(paragraphScript, { type: "paragraph", index: 3 });
    expect(third?.segment.text).toContain("fechamento");
  });
});
