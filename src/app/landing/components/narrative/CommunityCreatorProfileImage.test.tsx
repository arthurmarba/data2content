import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, forwardRef } from "react";

import { CommunityCreatorProfileImage } from "./CommunityCreatorProfileImage";

jest.mock("next/image", () => ({
  __esModule: true,
  default: forwardRef<HTMLImageElement, Record<string, unknown>>(function MockNextImage(
    { fill: _fill, unoptimized: _unoptimized, ...props },
    ref,
  ) {
    return createElement("img", { ...props, ref, "data-unoptimized": String(Boolean(_unoptimized)) });
  }),
}));

describe("CommunityCreatorProfileImage", () => {
  it("can eagerly load portraits used in the moving community rail", () => {
    render(
      <CommunityCreatorProfileImage
        name="Creator em destaque"
        mediaKitSlug="creator-em-destaque"
        src="/images/community/avatars/creator-em-destaque.jpg"
        eager
      />,
    );

    expect(screen.getByAltText("Foto de perfil de Creator em destaque")).toHaveAttribute("loading", "eager");
  });

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
    expect(image).toHaveAttribute("data-unoptimized", "true");
  });

  it("tries the production avatar before using the generic profile", () => {
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

    expect(image).toHaveAttribute(
      "src",
      "https://data2content.ai/api/mediakit/creator-publico/avatar?v=20260722-community-fallback-v2",
    );

    fireEvent.error(image);

    expect(image).toHaveAttribute("src", "/images/default-profile.png");
  });
});
