import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

import PostCreationAdaptiveNativeIntentStage from "./PostCreationAdaptiveNativeIntentStage";

function renderStage(
  overrides: Partial<ComponentProps<typeof PostCreationAdaptiveNativeIntentStage>> = {},
) {
  const props: ComponentProps<typeof PostCreationAdaptiveNativeIntentStage> = {
    value: "",
    onChange: jest.fn(),
    onSubmit: jest.fn(),
    canSubmit: true,
    ...overrides,
  };

  render(<PostCreationAdaptiveNativeIntentStage {...props} />);

  return props;
}

describe("PostCreationAdaptiveNativeIntentStage", () => {
  it("renders the main title", () => {
    renderStage();

    expect(screen.getByText("Teste sua leitura estratégica")).toBeInTheDocument();
  });

  it("renders the subtitle about crossing with Instagram analysis", () => {
    renderStage();

    expect(
      screen.getByText(
        "Escreva uma ideia, dúvida ou objetivo. A D2C cruza isso com sua análise do Instagram e transforma em um jogo de decisões para você tentar acertar o caminho mais forte.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the microcopy near the composer", () => {
    renderStage();

    expect(screen.getByText("Pode escrever do seu jeito. Eu transformo isso em perguntas estratégicas.")).toBeInTheDocument();
  });

  it("renders the strategic game CTA", () => {
    renderStage();

    expect(screen.getByRole("button", { name: "Montar meu jogo estratégico" })).toBeInTheDocument();
  });

  it("renders default examples", () => {
    renderStage();

    expect(screen.getByRole("button", { name: "Tenho uma pauta e quero validar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Não sei o que postar essa semana" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quero saber qual formato usar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quero transformar um comentário em post" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quero abrir espaço para marcas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quero uma ideia de collab" })).toBeInTheDocument();
  });

  it("uses custom examples when provided", () => {
    renderStage({ examples: ["Quero vender mais", "Preciso responder uma dúvida"] });

    expect(screen.getByRole("button", { name: "Quero vender mais" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preciso responder uma dúvida" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tenho uma pauta e quero validar" })).not.toBeInTheDocument();
  });

  it("calls onChange when typing in the textarea", () => {
    const onChange = jest.fn();
    renderStage({ onChange });

    fireEvent.change(screen.getByRole("textbox", { name: "Intenção estratégica" }), {
      target: { value: "Quero gravar um post" },
    });

    expect(onChange).toHaveBeenCalledWith("Quero gravar um post");
  });

  it("calls onChange when clicking an example", () => {
    const onChange = jest.fn();
    renderStage({ onChange });

    fireEvent.click(screen.getByRole("button", { name: "Quero abrir espaço para marcas" }));

    expect(onChange).toHaveBeenCalledWith("Quero abrir espaço para marcas");
  });

  it("does not call onSubmit when clicking an example", () => {
    const onSubmit = jest.fn();
    renderStage({ onSubmit });

    fireEvent.click(screen.getByRole("button", { name: "Quero abrir espaço para marcas" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit when clicking the button and canSubmit is true", () => {
    const onSubmit = jest.fn();
    renderStage({ onSubmit, canSubmit: true });

    fireEvent.click(screen.getByRole("button", { name: "Montar meu jogo estratégico" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not call onSubmit when canSubmit is false", () => {
    const onSubmit = jest.fn();
    renderStage({ onSubmit, canSubmit: false });

    fireEvent.click(screen.getByRole("button", { name: "Montar meu jogo estratégico" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables the button when canSubmit is false", () => {
    renderStage({ canSubmit: false });

    expect(screen.getByRole("button", { name: "Montar meu jogo estratégico" })).toBeDisabled();
  });

  it("disables the button when loading", () => {
    renderStage({ loading: true });

    expect(screen.getByRole("button", { name: "Montando seu jogo..." })).toBeDisabled();
  });

  it("disables the textarea when disabled", () => {
    renderStage({ disabled: true });

    expect(screen.getByRole("textbox", { name: "Intenção estratégica" })).toBeDisabled();
  });

  it("calls onSubmit on Cmd+Enter", () => {
    const onSubmit = jest.fn();
    renderStage({ onSubmit, canSubmit: true });

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Intenção estratégica" }), {
      key: "Enter",
      metaKey: true,
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("calls onSubmit on Ctrl+Enter", () => {
    const onSubmit = jest.fn();
    renderStage({ onSubmit, canSubmit: true });

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Intenção estratégica" }), {
      key: "Enter",
      ctrlKey: true,
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not call onSubmit on plain Enter", () => {
    const onSubmit = jest.fn();
    renderStage({ onSubmit, canSubmit: true });

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Intenção estratégica" }), {
      key: "Enter",
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows an error when error exists", () => {
    renderStage({ error: "Não consegui ler sua intenção." });

    expect(screen.getByText("Não consegui ler sua intenção.")).toBeInTheDocument();
  });

  it("shows loading text in the button", () => {
    renderStage({ loading: true });

    expect(screen.getByRole("button", { name: "Montando seu jogo..." })).toBeInTheDocument();
  });

  it("renders copy about content signals", () => {
    renderStage();

    expect(
      screen.getByText("Seu quiz usa sinais do seu conteúdo, como formatos, narrativas, horários e posts de referência."),
    ).toBeInTheDocument();
  });

  it("does not break with an empty value", () => {
    renderStage({ value: "" });

    expect(screen.getByRole("textbox", { name: "Intenção estratégica" })).toHaveValue("");
  });

  it("keeps aria-label on the textarea", () => {
    renderStage();

    expect(screen.getByRole("textbox", { name: "Intenção estratégica" })).toBeInTheDocument();
  });
});
