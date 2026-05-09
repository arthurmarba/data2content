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

    expect(screen.getByText("O que você quer criar, validar ou resolver hoje?")).toBeInTheDocument();
  });

  it("renders the subtitle", () => {
    renderStage();

    expect(
      screen.getByText(
        "Escreva uma pauta, objetivo, dúvida, comentário da audiência, marca ou collab. A partir disso, eu monto o caminho estratégico.",
      ),
    ).toBeInTheDocument();
  });

  it("renders default examples", () => {
    renderStage();

    expect(screen.getByRole("button", { name: "Quero validar uma pauta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Não sei o que postar essa semana" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quero atrair marcas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quero transformar um comentário em post" })).toBeInTheDocument();
  });

  it("uses custom examples when provided", () => {
    renderStage({ examples: ["Quero vender mais", "Preciso responder uma dúvida"] });

    expect(screen.getByRole("button", { name: "Quero vender mais" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preciso responder uma dúvida" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quero validar uma pauta" })).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Quero atrair marcas" }));

    expect(onChange).toHaveBeenCalledWith("Quero atrair marcas");
  });

  it("does not call onSubmit when clicking an example", () => {
    const onSubmit = jest.fn();
    renderStage({ onSubmit });

    fireEvent.click(screen.getByRole("button", { name: "Quero atrair marcas" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit when clicking the button and canSubmit is true", () => {
    const onSubmit = jest.fn();
    renderStage({ onSubmit, canSubmit: true });

    fireEvent.click(screen.getByRole("button", { name: "Começar estratégia" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not call onSubmit when canSubmit is false", () => {
    const onSubmit = jest.fn();
    renderStage({ onSubmit, canSubmit: false });

    fireEvent.click(screen.getByRole("button", { name: "Começar estratégia" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables the button when loading", () => {
    renderStage({ loading: true });

    expect(screen.getByRole("button", { name: "Lendo sua intenção..." })).toBeDisabled();
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

    expect(screen.getByRole("button", { name: "Lendo sua intenção..." })).toBeInTheDocument();
  });
});
