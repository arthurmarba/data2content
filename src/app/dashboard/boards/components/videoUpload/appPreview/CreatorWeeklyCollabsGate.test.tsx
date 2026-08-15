import { fireEvent, render, screen } from "@testing-library/react";
import { CreatorWeeklyCollabsGate } from "./CreatorWeeklyCollabsGate";

jest.mock("@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry", () => ({
  trackMobileNarrativeEvent: jest.fn(),
}));

describe("CreatorWeeklyCollabsGate", () => {
  it("asks a Pro creator to connect Instagram before personalized collabs", () => {
    const onConnectInstagram = jest.fn();
    render(
      <CreatorWeeklyCollabsGate
        accessState="pro_needs_instagram"
        isDemo={false}
        onUpgrade={jest.fn()}
        onConnectInstagram={onConnectInstagram}
        onDemoChange={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Conectar Instagram" }));
    expect(onConnectInstagram).toHaveBeenCalledTimes(1);
  });

  it("keeps the demo inside the creator profile and lets her leave it", () => {
    const onDemoChange = jest.fn();
    render(
      <CreatorWeeklyCollabsGate
        accessState="free_unused"
        isDemo
        onUpgrade={jest.fn()}
        onConnectInstagram={jest.fn()}
        onDemoChange={onDemoChange}
      />,
    );

    expect(screen.getByText("Uma ideia para gravar em parceria")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sair do exemplo" }));
    expect(onDemoChange).toHaveBeenCalledWith(false);
  });
});
