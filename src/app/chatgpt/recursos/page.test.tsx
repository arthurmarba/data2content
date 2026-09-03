import { render, screen } from "@testing-library/react";
import ChatGptResourcesPage from "./page";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
    const { fill: _fill, priority: _priority, ...imgProps } = props as React.ImgHTMLAttributes<HTMLImageElement> & {
      fill?: boolean;
      priority?: boolean;
    };
    return <img alt={alt} {...imgProps} />;
  },
}));
jest.mock("@/app/chatgpt/ChatGptFunnelTracker", () => ({
  ChatGptFunnelTracker: () => null,
}));

describe("ChatGptResourcesPage", () => {
  it("preserva a origem ChatGPT ao abrir o perfil", () => {
    render(<ChatGptResourcesPage />);

    expect(screen.getByRole("link", { name: /Abrir minha conta/i })).toHaveAttribute(
      "href",
      "/dashboard/profile?source=chatgpt",
    );
  });
});
