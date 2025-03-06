"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface SearchBarProps {
  placeholder?: string;
  inputClassName?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ placeholder, inputClassName = "" }) => {
  const [value, setValue] = useState("");
  const router = useRouter();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim() !== "") {
      router.push(`/answer/${encodeURIComponent(value.trim())}`);
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`w-full h-10 px-4 py-2 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 ${inputClassName}`}
      />
    </div>
  );
};

export default SearchBar;
