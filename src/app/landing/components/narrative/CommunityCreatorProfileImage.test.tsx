import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";

import { CommunityCreatorProfileImage } from "./CommunityCreatorProfileImage";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ fill: _fill, unoptimized: _unoptimized, ...props }: Record<string, unknown>) =>
    createElement("img", props),
}));

describe("CommunityCreatorProfileImage", () => {
  it("falls back from the persistent local image to the Media Kit avatar endpoint", () => {
    render(
      <CommunityCreatorProfileImage
        name="Creator Público"
        mediaKitSlug="creator-publico"
        src="/images/community/avatars/creator-publico.jpg"
      />,
    );

    const image = screen.getByAltText("Foto de perfil de Creator Público");
    fireEvent.error(image);

    expect(image).toHaveAttribute(
      "src",
      "/api/mediakit/creator-publico/avatar?v=20260713-community-fallback-v1",
    );
  });

  it("uses the generic profile only when both real image sources fail", () => {
    render(
      <CommunityCreatorProfileImage
        name="Creator Público"
        mediaKitSlug="creator-publico"
        src="/images/community/avatars/creator-publico.jpg"
      />,
    );

    const image = screen.getByAltText("Foto de perfil de Creator Público");
    fireEvent.error(image);
    fireEvent.error(image);

    expect(image).toHaveAttribute("src", "/images/default-profile.png");
  });
});
