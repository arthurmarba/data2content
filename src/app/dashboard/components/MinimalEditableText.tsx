// src/app/dashboard/components/MinimalEditableText.tsx
"use client";

import React, { useRef, useEffect } from "react";

interface MinimalEditableTextProps {
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
  className?: string;
}

const MinimalEditableText: React.FC<MinimalEditableTextProps> = ({
  value,
  onChange,
  placeholder,
  className = "",
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value;
    }
  }, [value]);

  const handleInput = () => {
    if (ref.current) {
      onChange(ref.current.innerText);
    }
  };

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      className={`outline-none ${className}`}
      data-placeholder={placeholder}
      style={{ minHeight: "1.5rem" }}
    />
  );
};

export default MinimalEditableText;
