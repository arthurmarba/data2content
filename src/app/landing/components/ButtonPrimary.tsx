"use client";

import Link from "next/link";
import React from "react";
import { event } from "@/lib/gtag";

// Define as props que o componente aceita
type ButtonVariant = "brand" | "solid" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonPrimaryProps {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  rel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const baseClasses =
  "group inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

const variantClasses: Record<ButtonVariant, string> = {
  brand:
    "bg-brand-magenta text-white shadow-brand-magenta hover:bg-brand-magenta-dark focus-visible:outline-brand-magenta",
  solid:
    "bg-brand-blue text-white shadow-brand-blue hover:bg-brand-blue-dark focus-visible:outline-brand-blue",
  outline:
    "border border-brand-dark/15 bg-neutral-0 text-brand-dark hover:border-brand-dark/40 hover:bg-neutral-0/90 focus-visible:outline-brand-dark/40",
  ghost:
    "bg-transparent text-brand-dark hover:bg-brand-light focus-visible:outline-brand-dark/25",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-5 py-2.5 text-sm",
  md: "px-7 py-3 text-sm",
  lg: "px-8 py-4 text-base",
};

function composeClasses(variant: ButtonVariant, size: ButtonSize, extra?: string) {
  return [baseClasses, variantClasses[variant], sizeClasses[size], extra ?? ""]
    .filter(Boolean)
    .join(" ");
}

export default function ButtonPrimary({
  href,
  onClick,
  children,
  className,
  rel,
  variant = "brand",
  size = "md",
}: ButtonPrimaryProps) {
  const composedClasses = composeClasses(variant, size, className);

  const handleClick = () => {
    event("select_content", {
      content_type: "button",
      item_id: "button_primary",
    });
    onClick?.();
  };

  // Se a prop 'href' for fornecida, renderiza um componente Link do Next.js
  if (href) {
    return (
      <Link href={href} className={composedClasses} rel={rel} onClick={handleClick}>
        {children}
      </Link>
    );
  }

  return (
    <button onClick={handleClick} className={composedClasses}>
      {children}
    </button>
  );
}
