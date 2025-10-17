// src/app/dashboard/home/components/HomeGrid.tsx
// Grid responsivo utilizado pela Home.

"use client";

import React from "react";

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

interface HomeGridProps extends React.HTMLAttributes<HTMLDivElement> {}

export default function HomeGrid({ children, className, ...rest }: HomeGridProps) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-4 sm:gap-5 lg:gap-5 md:grid-cols-2 xl:grid-cols-3", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
