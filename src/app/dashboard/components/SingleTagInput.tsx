// SingleTagInput.tsx
"use client";

import React, { useState } from "react";

interface SingleTagInputProps {
  label: string;
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
  variant?: string;
}

const SingleTagInput: React.FC<SingleTagInputProps> = ({
  label,
  value,
  onChange,
  placeholder = "Digite e pressione Enter",
  variant = "bg-gray-100 text-gray-800 border-gray-100",
}) => {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const handleBlur = () => {
    setEditing(false);
    onChange(tempValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setEditing(false);
      onChange(tempValue);
    }
  };

  const clearValue = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setTempValue("");
    onChange("");
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {editing ? (
        <input
          type="text"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 text-base placeholder-gray-400"
          placeholder={placeholder}
        />
      ) : (
        <div
          onClick={() => setEditing(true)}
          className={`flex items-center px-3 py-1 rounded-md text-sm cursor-pointer border shadow-sm ${variant}`}
        >
          {value ? (
            <span>{typeof value === "string" ? value : JSON.stringify(value)}</span>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
          {value && (
            <button onClick={clearValue} className="ml-2 focus:outline-none">
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SingleTagInput;
