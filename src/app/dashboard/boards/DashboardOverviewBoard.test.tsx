import { fireEvent, render, screen } from "@testing-library/react";
import { Map } from "lucide-react";

import DashboardOverviewBoard from "./DashboardOverviewBoard";

describe("DashboardOverviewBoard", () => {
  it("apresenta um resumo sem rolagem interna e uma ação dominante", () => {
    const onAction = jest.fn();
    const { container } = render(
      <DashboardOverviewBoard
        title="Seu Mapa"
        eyebrow="Direção estratégica"
        headline="Autonomia criativa como negócio"
        description="Uma leitura curta e operacional."
        icon={Map}
        tags={["Criatividade", "Negócios"]}
        stats={[
          { label: "Leituras", value: "4" },
          { label: "Evolução", value: "Em evolução" },
        ]}
        actionLabel="Abrir mapa completo"
        onAction={onAction}
      />,
    );

    expect(screen.getByRole("heading", { name: "Seu Mapa" })).toBeInTheDocument();
    expect(screen.getByText("Autonomia criativa como negócio")).toBeInTheDocument();
    expect(container.querySelector("[data-board-scroll-container='true']")?.className).toContain(
      "overflow-hidden",
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir mapa completo" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
