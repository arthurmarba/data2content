import { fireEvent, render, screen } from "@testing-library/react";
import { VideoNarrativeGoalInput } from "./VideoNarrativeGoalInput";

describe("VideoNarrativeGoalInput", () => {
  it("renders placeholder", () => {
    render(<VideoNarrativeGoalInput onSubmit={jest.fn()} />);

    expect(screen.getByPlaceholderText("Ex: quero saber se vale postar, se o gancho está bom ou se pode virar publi.")).toBeInTheDocument();
  });

  it("starts with continue disabled", () => {
    render(<VideoNarrativeGoalInput onSubmit={jest.fn()} />);

    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  });

  it("typing text enables continue", () => {
    render(<VideoNarrativeGoalInput onSubmit={jest.fn()} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Quero melhorar o gancho" } });

    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
  });

  it("quick prompt fills text", () => {
    render(<VideoNarrativeGoalInput onSubmit={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Virar publi" }));

    expect(screen.getByRole("textbox")).toHaveValue("Virar publi");
  });

  it("submit calls callback with text", () => {
    const onSubmit = jest.fn();
    render(<VideoNarrativeGoalInput onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Vale postar?" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(onSubmit).toHaveBeenCalledWith("Vale postar?");
  });

  it("does not render sensitive terms from input", () => {
    const { container } = render(<VideoNarrativeGoalInput onSubmit={jest.fn()} />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: {
        value:
          "AIza123456789012345678901234 GEMINI_API_KEY=secret https://example.com/video.mp4?token=abc AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      },
    });

    const text = container.textContent || "";
    expect(text).not.toContain("AIza");
    expect(text).not.toContain("GEMINI_API_KEY=secret");
    expect(text).not.toContain("token=abc");
    expect(screen.getByRole("textbox")).toHaveValue("[redigido] [redigido] [redigido] [redigido]");
  });
});
