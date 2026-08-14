import { render, screen } from "@testing-library/react";
import { CREATOR_WEEKLY_REPORT_DEMO } from "@/app/lib/creatorWeeklyReport/demoReport";
import { CreatorWeeklyReportDetail } from "./CreatorWeeklyReportDetail";

describe("CreatorWeeklyReportDetail", () => {
  it("mantém o sistema editorial do Perfil e identifica a demonstração", () => {
    const detail = CREATOR_WEEKLY_REPORT_DEMO.details[0]!;
    const { container } = render(
      <CreatorWeeklyReportDetail detail={detail} isDemo onBack={jest.fn()} />,
    );

    expect(container.querySelector("main")).toHaveClass("ds-notebook-page", "ds-analysis-editorial");
    expect(screen.getByText("Dados de exemplo")).toHaveClass("ds-badge", "ds-badge--neutral");
    expect(screen.getByText("Quanto dá para confiar").closest("details")).toHaveClass("bg-[var(--ds-color-surface)]");
    expect(container.querySelectorAll(".ds-notebook-section .ds-notebook-section")).toHaveLength(0);
  });
});
