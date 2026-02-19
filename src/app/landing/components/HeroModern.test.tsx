import React from "react";
import { render, screen } from "@testing-library/react";

import HeroModern from "./HeroModern";

jest.mock("framer-motion", () => {
  const React = require("react");
  const MotionTag = (tag: string) => {
    const MockMotionComponent = ({
      initial,
      whileInView,
      viewport,
      transition,
      whileHover,
      whileTap,
      ...rest
    }: any) => React.createElement(tag as any, rest, rest.children);
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
    useScroll: () => ({ scrollY: 0 }),
    useTransform: () => 0,
  };
});

describe("HeroModern", () => {
  it("shows onboarding CTA for visitors and does not render jump button", () => {
    render(
      <HeroModern
        onCreatorCta={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /quero entrar na d2c/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sou marca/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ver criadores agora/i })).not.toBeInTheDocument();
  });

  it("shows account access CTA for authenticated users", () => {
    render(
      <HeroModern
        onCreatorCta={jest.fn()}
        isAuthenticated
      />,
    );

    expect(screen.getByRole("button", { name: /acessar minha conta/i })).toBeInTheDocument();
  });
});
