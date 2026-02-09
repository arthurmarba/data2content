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
  disabled?: boolean;
}

const baseClasses =
  "group inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

const variantClasses: Record<ButtonVariant, string> = {
  brand:
    "bg-brand-primary text-white hover:bg-brand-primary-dark focus-visible:outline-brand-primary",
  solid:
    "bg-brand-accent text-white hover:bg-brand-accent-dark focus-visible:outline-brand-accent",
  outline:
    "border border-brand-primary/30 bg-white text-brand-primary hover:border-brand-primary hover:bg-brand-magenta-soft focus-visible:outline-brand-primary/40",
  ghost:
    "bg-transparent text-brand-primary hover:bg-brand-sun/15 focus-visible:outline-brand-primary/30",
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
  disabled = false,
}: ButtonPrimaryProps) {
  const composedClasses = composeClasses(
    variant,
    size,
    `${className ?? ""} ${disabled ? "pointer-events-none opacity-60" : ""}`.trim()
  );

  const handleClick = (e?: React.MouseEvent) => {
    if (disabled) {
      e?.preventDefault();
      return;
    }
    event("select_content", {
      content_type: "button",
      item_id: "button_primary",
    });
    onClick?.();
  };

  // Se a prop 'href' for fornecida, renderiza um componente Link do Next.js
  if (href) {
    return (
      <Link
        href={href}
        className={composedClasses}
        rel={rel}
        onClick={handleClick}
        aria-disabled={disabled}
      >
        {children}
      </Link>
    );
  }

  return (
    <button onClick={handleClick} className={composedClasses} disabled={disabled}>
      {children}
    </button>
  );
}
