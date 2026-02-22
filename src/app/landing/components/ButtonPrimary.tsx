"use client";

import Link from "next/link";
import React, { useRef, useState, useEffect } from "react";
import { event } from "@/lib/gtag";
import { motion, useMotionValue, useSpring, useMotionTemplate } from "framer-motion";

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
  magnetic?: boolean;
}

const MagneticWrapper = ({
  children,
  className,
  magnetic = true,
}: {
  children: React.ReactNode;
  className: string;
  magnetic?: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Magnetic values
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { stiffness: 150, damping: 15, mass: 0.1 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  // Glow values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();

    // Magnetic logic (relative to center)
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const localX = e.clientX - rect.left - centerX;
    const localY = e.clientY - rect.top - centerY;

    if (magnetic) {
      x.set(localX * 0.2); // Magnetic strength
      y.set(localY * 0.2);
    }

    // Glow logic (exact mouse position)
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (magnetic) {
      x.set(0);
      y.set(0);
    }
  };

  const glowStyle = useMotionTemplate`
    radial-gradient(
      120px circle at ${mouseX}px ${mouseY}px,
      rgba(255, 255, 255, 0.4),
      transparent 80%
    )
  `;

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        x: springX,
        y: springY,
      }}
      className={`relative inline-block ${className}`}
    >
      {/* Glow Effect */}
      {isHovered && magnetic && (
        <motion.div
          className="pointer-events-none absolute -inset-[2px] z-0 rounded-full opacity-60 mix-blend-overlay transition-opacity duration-300"
          style={{
            background: glowStyle,
          }}
        />
      )}

      {/* Content wrapper */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {children}
      </div>
    </motion.div>
  );
};

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
  magnetic,
}: ButtonPrimaryProps) {
  // Default magnetic effect to true for primary/solid buttons, false otherwise
  const isMagnetic = magnetic ?? (variant === "brand" || variant === "solid" || variant === "outline");

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
      <MagneticWrapper className="" magnetic={isMagnetic && !disabled}>
        <Link
          href={href}
          className={composedClasses}
          rel={rel}
          onClick={handleClick}
          aria-disabled={disabled}
        >
          {children}
        </Link>
      </MagneticWrapper>
    );
  }

  return (
    <MagneticWrapper className="" magnetic={isMagnetic && !disabled}>
      <button onClick={handleClick} className={composedClasses} disabled={disabled}>
        {children}
      </button>
    </MagneticWrapper>
  );
}
