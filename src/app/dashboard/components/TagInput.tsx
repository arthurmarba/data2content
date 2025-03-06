// src/app/dashboard/components/TagInput.tsx
"use client";

import React, { useState } from "react";

interface TagInputProps {
  tags: any[];
  setTags: (tags: any[]) => void;
  placeholder?: string;
  variant?: string;
}

const TagInput: React.FC<TagInputProps> = ({
  tags,
  setTags,
  placeholder = "Digite e pressione Enter",
  variant = "bg-gray-100 text-gray-800 border-gray-100",
}) => {
  const [input, setInput] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim() !== "") {
      e.preventDefault();
      if (!tags.includes(input.trim())) {
        setTags([...tags, input.trim()]);
      }
      setInput("");
    }
    if (e.key === "Backspace" && input === "" && tags.length > 0) {
      e.preventDefault();
      const newTags = tags.slice(0, tags.length - 1);
      setTags(newTags);
    }
  };

  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-md shadow-sm bg-white">
      {tags.map((tag, index) => (
        <div
          key={index}
          className={`flex items-center ${variant} px-3 py-1 rounded-full text-sm`}
        >
          <span>{typeof tag === "string" ? tag : JSON.stringify(tag)}</span>
          <button onClick={() => removeTag(index)} className="ml-1 focus:outline-none">
            ×
          </button>
        </div>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-grow outline-none text-sm placeholder-gray-400"
      />
    </div>
  );
};

export default TagInput;
