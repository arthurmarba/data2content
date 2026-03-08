import React from "react";
import { render, screen } from "@testing-library/react";

import HeroModern from "./HeroModern";

jest.mock("framer-motion", () => {
  const React = require("react");
  const MotionTag = (tag: string) => {
    const MockMotionComponent = React.forwardRef(({
      initial,
      whileInView,
      viewport,
      transition,
      whileHover,
      whileTap,
      animate,
      exit,
      ...rest
    }: any, ref: any) => React.createElement(tag as any, { ...rest, ref }, rest.children));
    MockMotionComponent.displayName = `MockMotion(${tag})`;
    return MockMotionComponent;
  };

  return {
    motion: new Proxy(
      {},
      {
        get: (_, prop) => MotionTag(prop as string),
      },
    ),
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useScroll: () => ({ scrollY: 0 }),
    useTransform: () => 0,
    useMotionValue: () => 0,
    useSpring: () => 0,
    useMotionTemplate: () => "",
  };
});

describe("HeroModern", () => {
  it("shows mobile proof and the current value pillars for visitors", () => {
    render(
      <HeroModern
        onCreatorCta={jest.fn()}
        metrics={{
          activeCreators: 130,
          combinedFollowers: 2_400_000,
          totalPostsAnalyzed: 42_000,
          postsLast30Days: 1_200,
          newMembersLast7Days: 37,
          viewsLast30Days: 1_900_000,
          viewsAllTime: 45_000_000,
          reachLast30Days: 2_500_000,
          reachAllTime: 64_000_000,
          followersGainedLast30Days: 18_500,
          followersGainedAllTime: 320_000,
          interactionsLast30Days: 820_000,
          interactionsAllTime: 14_500_000,
        }}
      />,
    );

    expect(screen.getByRole("button", { name: /quero entrar na d2c/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /ver membros da comunidade/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("hero-mobile-subtitle")).toBeInTheDocument();
    const mobileProof = screen.getByTestId("hero-mobile-proof");
    expect(mobileProof).toBeInTheDocument();
    expect(screen.getByText("Criadores")).toBeInTheDocument();
    expect(screen.getByText("Alcance 30d")).toBeInTheDocument();
    expect(screen.getByText("Seguidores")).toBeInTheDocument();
    const valuePillars = screen.getByTestId("hero-mobile-value-pillars");
    expect(valuePillars).toBeInTheDocument();
    expect(screen.getByText(/reunião de roteiro/i)).toBeInTheDocument();
    expect(screen.getByText(/reunião de conteúdo/i)).toBeInTheDocument();
    expect(screen.getAllByText(/banco de talentos/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/networking ativo/i)).toBeInTheDocument();
  });

  it("shows account access CTA for authenticated users", () => {
    render(
      <HeroModern
        onCreatorCta={jest.fn()}
        isAuthenticated
      />,
    );

    expect(screen.getByRole("button", { name: /acessar consultoria/i })).toBeInTheDocument();
    expect(screen.queryByText(/entre para revisar conteudo, posicionamento e proximas oportunidades/i)).not.toBeInTheDocument();
  });
});
