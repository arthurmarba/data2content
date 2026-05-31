import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DiagnosticoReadingCard } from "./DiagnosticoReadingCard";
import { buildDiagnosticoReadingItemFixture } from "./diagnosticoTestFixtures";

describe("DiagnosticoReadingCard", () => {
  it("renders the reading title", () => {
    const reading = buildDiagnosticoReadingItemFixture({ rememberedAs: "Vídeo de review de produto" });
    render(<DiagnosticoReadingCard reading={reading} onTap={jest.fn()} />);
    expect(screen.getByText("Vídeo de review de produto")).toBeInTheDocument();
  });

  it("shows enriched label when confirms_existing_pattern and mainNarrativeLabel provided", () => {
    const reading = buildDiagnosticoReadingItemFixture({ contributionType: "confirms_existing_pattern" });
    render(
      <DiagnosticoReadingCard reading={reading} mainNarrativeLabel="Humor com Identificação" onTap={jest.fn()} />,
    );
    expect(screen.getByText("Reforçou · Humor com Identificação")).toBeInTheDocument();
  });

  it("falls back to contributionLabel when no mainNarrativeLabel", () => {
    const reading = buildDiagnosticoReadingItemFixture({
      contributionType: "confirms_existing_pattern",
      contributionLabel: "Narrativa reforçada",
    });
    render(<DiagnosticoReadingCard reading={reading} onTap={jest.fn()} />);
    expect(screen.getByText("Narrativa reforçada")).toBeInTheDocument();
  });

  it("shows relative timestamp for recent reading", () => {
    const reading = buildDiagnosticoReadingItemFixture({
      createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    });
    render(<DiagnosticoReadingCard reading={reading} onTap={jest.fn()} />);
    expect(screen.getByText("2 dias atrás")).toBeInTheDocument();
  });

  it("falls back to dateLabel when createdAt is null", () => {
    const reading = buildDiagnosticoReadingItemFixture({ createdAt: null, dateLabel: "15/05" });
    render(<DiagnosticoReadingCard reading={reading} onTap={jest.fn()} />);
    expect(screen.getByText("15/05")).toBeInTheDocument();
  });

  it("shows play icon placeholder when no thumbnail", () => {
    const reading = buildDiagnosticoReadingItemFixture({ thumbnailUrl: null });
    const { container } = render(<DiagnosticoReadingCard reading={reading} onTap={jest.fn()} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("renders thumbnail img when thumbnailUrl is set", () => {
    const reading = buildDiagnosticoReadingItemFixture({ thumbnailUrl: "https://example.com/thumb.jpg" });
    const { container } = render(<DiagnosticoReadingCard reading={reading} onTap={jest.fn()} />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "https://example.com/thumb.jpg");
  });

  it("calls onTap when clicked", () => {
    const onTap = jest.fn();
    const reading = buildDiagnosticoReadingItemFixture();
    render(<DiagnosticoReadingCard reading={reading} onTap={onTap} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("shows orange icon bubble for confirms_existing_pattern", () => {
    const reading = buildDiagnosticoReadingItemFixture({ contributionType: "confirms_existing_pattern" });
    const { container } = render(<DiagnosticoReadingCard reading={reading} onTap={jest.fn()} />);
    // The icon bubble div carries bg-orange-500
    const bubble = container.querySelector(".bg-orange-500");
    expect(bubble).toBeInTheDocument();
  });

  it("shows amber icon bubble for creative_deviation", () => {
    const reading = buildDiagnosticoReadingItemFixture({ contributionType: "creative_deviation" });
    const { container } = render(<DiagnosticoReadingCard reading={reading} onTap={jest.fn()} />);
    const bubble = container.querySelector(".bg-amber-500");
    expect(bubble).toBeInTheDocument();
  });
});
