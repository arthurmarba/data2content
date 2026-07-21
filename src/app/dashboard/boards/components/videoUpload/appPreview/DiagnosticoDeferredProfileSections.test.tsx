import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { DiagnosticoDeferredProfileSections } from "./DiagnosticoDeferredProfileSections";

describe("DiagnosticoDeferredProfileSections", () => {
  it("preserva os CTAs de audiência e expansão no chunk abaixo da dobra", () => {
    const onConnectInstagram = jest.fn();
    const onOpenBrands = jest.fn();

    render(
      <DiagnosticoDeferredProfileSections
        audienceInsights={null}
        instagramConnected={false}
        isPro
        isMapReadyForExpansion
        brandName="Marca Exemplo"
        brandSubtitle="Fit alto com sua narrativa"
        onConnectInstagram={onConnectInstagram}
        onOpenBrands={onOpenBrands}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /conectar instagram/i }));
    expect(onConnectInstagram).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /marca exemplo/i }));
    expect(onOpenBrands).toHaveBeenCalledTimes(1);
  });
});
