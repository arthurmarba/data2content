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

  it("keeps technical wrapper when merging a technical scene block", () => {
    const technicalScript = [
      "[ROTEIRO_TECNICO_V1]",
      "[CENA 1: GANCHO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 00-03s | Close | Abertura | Gancho | Frase de abertura | Ritmo alto |",
      "[CENA 2: CONTEXTO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 03-10s | Médio | Contexto | Dor | Frase de contexto | Tom didático |",
      "[CENA 3: DEMONSTRAÇÃO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 10-20s | Médio | Demonstração | Passos | Frase de demonstração | Cadência firme |",
      "[CENA 4: CTA]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 20-30s | Close | Final | CTA | Frase de CTA | Tom final |",
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");

    const resolved = resolveScopedSegment(technicalScript, { type: "scene", index: 2 });
    expect(resolved).not.toBeNull();

    const merged = mergeScopedSegment(
      technicalScript,
      resolved!,
      "[CENA 2: CONTEXTO]\n| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n| 03-10s | Médio | Contexto novo | Dor central | Frase de contexto revisada | Tom firme |"
    );

    expect(merged).toContain("[ROTEIRO_TECNICO_V1]");
    expect(merged).toContain("[/ROTEIRO_TECNICO_V1]");
    expect(merged).toContain("Frase de contexto revisada");
    expect(merged).toContain("Frase de CTA");
  });
});
