// src/app/dashboard/home/components/ActionButton.tsx
// Botão padronizado utilizado nos cards da Home.

"use client";

import React from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost";

interface BaseProps {
  label: string;
  icon?: React.ReactNode;
  variant?: Variant;
  className?: string;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  "aria-label"?: string;
}

interface ButtonProps extends BaseProps {
  href?: undefined;
}

interface LinkProps extends BaseProps {
  href: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

function getVariantClasses(variant: Variant, disabled?: boolean) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed";

  if (disabled) {
    return cn(base, "border-slate-200 bg-slate-100 text-slate-400");
  }

  switch (variant) {
    case "primary":
      return cn(base, "border-brand-purple bg-brand-purple text-white hover:bg-brand-magenta");
    case "secondary":
      return cn(base, "border-slate-200 bg-white text-brand-purple hover:border-brand-purple/50 hover:bg-brand-purple/5");
    default:
      return cn(base, "border-transparent bg-transparent text-brand-purple hover:bg-brand-purple/10");
  }
}

function renderContent(label: string, icon?: React.ReactNode) {
  return (
    <>
      {icon ? <span className="flex items-center text-base">{icon}</span> : null}
      <span>{label}</span>
    </>
  );
}

export default function ActionButton(props: ButtonProps | LinkProps) {
  const { label, icon, variant = "primary", className, disabled, ...rest } = props;
  const classes = cn(getVariantClasses(variant, disabled), className);

  if ("href" in props && props.href) {
    const { href, onClick, ...linkRest } = rest as LinkProps;
    return (
      <Link href={href} onClick={onClick} className={classes} aria-label={linkRest["aria-label"]}>
        {renderContent(label, icon)}
      </Link>
    );
  }

  const { onClick, ...buttonRest } = rest as ButtonProps;
  return (
    <button type="button" onClick={onClick} className={classes} disabled={disabled} aria-label={buttonRest["aria-label"]}>
      {renderContent(label, icon)}
    </button>
  );
}
