import { act, fireEvent, render, screen } from "@testing-library/react";

import { CREATOR_WEEKLY_DIAGNOSIS_DEMO } from "@/app/lib/creatorWeeklyReport/demoDiagnosis";
import { D2C_MCP_URL, buildClaudeHandoffPrompt } from "@/app/lib/creatorWeeklyReport/claudeHandoff";
import type { CreatorWeeklyDiagnosisView } from "@/app/lib/creatorWeeklyReport/types";

import { ProfileWeeklyDiagnosis, diagnosisStatusLine, formatDiagnosisDue } from "./ProfileWeeklyDiagnosis";

const ENTRY = CREATOR_WEEKLY_DIAGNOSIS_DEMO.shown!;
const writeText = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeText.mockClear();
  Object.assign(navigator, { clipboard: { writeText } });
});

describe("diagnóstico da semana no Perfil", () => {
  it("é enxuto: manchete, evidência com o multiplicador em destaque, pergunta e amostra", () => {
    render(<ProfileWeeklyDiagnosis view={CREATOR_WEEKLY_DIAGNOSIS_DEMO} isDemo={false} tag={null} claudeConnected />);

    expect(screen.getByRole("heading", { name: ENTRY.headline })).toBeTruthy();
    expect(screen.getByText(ENTRY.question)).toBeTruthy();
    expect(screen.getByText(ENTRY.sampleLine)).toBeTruthy();
    expect(screen.getByText("2,4×").tagName).toBe("B");
    // O teste da semana não ocupa a tela: ele vai junto para o Claude.
    expect(screen.queryByText(ENTRY.nextTest)).toBeNull();
    expect(screen.queryByText(/exemplo/i)).toBeNull();
  });

  it("conectado: um botão só, que leva o próprio diagnóstico para o Claude", async () => {
    const onOpenClaude = jest.fn();
    render(
      <ProfileWeeklyDiagnosis
        view={CREATOR_WEEKLY_DIAGNOSIS_DEMO}
        isDemo={false}
        tag={null}
        claudeConnected
        onOpenClaude={onOpenClaude}
      />,
    );

    expect(screen.getByText("Claude conectado")).toBeTruthy();
    expect(screen.queryByText(/Adicionar conector personalizado/)).toBeNull();
    const link = screen.getByRole("link", { name: /Continuar no Claude/ });
    expect(link.getAttribute("href")).toBe("https://claude.ai/new");
    expect(link.getAttribute("target")).toBe("_blank");

    await act(async () => {
      fireEvent.click(link);
    });
    expect(onOpenClaude).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(buildClaudeHandoffPrompt(ENTRY));
    expect(screen.getByText("Pergunta copiada. No Claude, cole e envie.")).toBeTruthy();
  });

  it("sem conexão: o passo a passo aparece no próprio card, com o endereço para copiar", async () => {
    const onCopyConnector = jest.fn();
    render(
      <ProfileWeeklyDiagnosis
        view={CREATOR_WEEKLY_DIAGNOSIS_DEMO}
        isDemo={false}
        tag={null}
        onCopyConnector={onCopyConnector}
      />,
    );

    expect(screen.getByRole("list", { name: "Como conectar a Data2Content ao Claude" })).toBeTruthy();
    expect(screen.getByText(D2C_MCP_URL)).toBeTruthy();
    expect(screen.queryByText("Claude conectado")).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    });
    expect(onCopyConnector).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(D2C_MCP_URL);
    expect(screen.getByRole("link", { name: /Continuar no Claude/ })).toBeTruthy();
  });

  it("avisa quando é exemplo", () => {
    render(<ProfileWeeklyDiagnosis view={CREATOR_WEEKLY_DIAGNOSIS_DEMO} isDemo tag="Exemplo" />);
    expect(screen.getByText(/diagnóstico de exemplo/)).toBeTruthy();
    expect(screen.getByText("Exemplo")).toBeTruthy();
  });

  it("enquanto o novo não sai, mostra o anterior com a data dele e diz quando chega", () => {
    const view: CreatorWeeklyDiagnosisView = {
      state: "waiting",
      shown: ENTRY,
      upcomingRangeLabel: "10 a 16 de agosto",
      dueAt: "2026-08-17T15:00:00.000Z",
    };
    render(<ProfileWeeklyDiagnosis view={view} isDemo={false} tag={null} />);

    expect(screen.getByText(`Semana de ${ENTRY.rangeLabel}`)).toBeTruthy();
    expect(screen.getByText("O diagnóstico da semana de 10 a 16 de agosto sai segunda-feira, a partir das 12h.")).toBeTruthy();
  });

  it("sem diagnóstico ainda, a porta para o Claude continua lá", () => {
    render(
      <ProfileWeeklyDiagnosis
        view={{ state: "writing", shown: null, upcomingRangeLabel: "10 a 16 de agosto", dueAt: null }}
        isDemo={false}
        tag={null}
      />,
    );
    expect(screen.getByRole("heading", { name: "Seu diagnóstico está a caminho." })).toBeTruthy();
    expect(screen.getByText(/está sendo escrito/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Continuar no Claude/ })).toBeTruthy();
  });

  it("diz o motivo de cada espera", () => {
    const base = { shown: null, upcomingRangeLabel: "10 a 16 de agosto", dueAt: null };
    expect(diagnosisStatusLine({ ...base, state: "delayed" })).toBe(
      "O diagnóstico da semana de 10 a 16 de agosto atrasou. A leitura tenta de novo sozinha.",
    );
    expect(diagnosisStatusLine({ ...base, state: "unavailable" })).toContain("começa quando houver pelo menos 3 posts");
    expect(diagnosisStatusLine({ ...base, shown: ENTRY, state: "unavailable" })).toContain("volta quando");
    expect(diagnosisStatusLine({ ...base, state: "missed" })).toBe(
      "O diagnóstico da semana de 10 a 16 de agosto não saiu. O próximo chega na segunda.",
    );
    expect(diagnosisStatusLine({ ...base, state: "ready" })).toBeNull();
    expect(formatDiagnosisDue("não é data")).toBeNull();
  });
});
