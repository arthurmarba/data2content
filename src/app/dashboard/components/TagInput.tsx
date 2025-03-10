"use client";

import React, { useState } from "react";

/**
 * Definimos o tipo da Tag como string.
 * Se quiser aceitar qualquer estrutura, altere para `unknown`.
 */
type Tag = string;

interface TagInputProps {
  tags: Tag[];
  setTags: (tags: Tag[]) => void;
  placeholder?: string;
  variant?: string;
}

/**
 * Componente TagInput:
 * Permite adicionar/remover tags (strings) pressionando Enter.
 * @param tags       Array de strings que representam as tags
 * @param setTags    Função para atualizar o array de tags
 * @param placeholder Texto de placeholder do input
 * @param variant     Classes de estilo opcionais para personalizar a aparência das tags
 */
const TagInput: React.FC<TagInputProps> = ({
  tags,
  setTags,
  placeholder = "Digite e pressione Enter",
  variant = "bg-gray-100 text-gray-800 border-gray-100",
}) => {
  const [input, setInput] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Ao pressionar Enter, adiciona a tag (se não for vazia)
    if (e.key === "Enter" && input.trim() !== "") {
      e.preventDefault();
      const trimmed = input.trim();

      // Checa se a tag já existe antes de inserir
      if (!tags.includes(trimmed)) {
        setTags([...tags, trimmed]);
      }
      setInput("");
    }
    // Ao pressionar Backspace com input vazio, remove a última tag
    else if (e.key === "Backspace" && input === "" && tags.length > 0) {
      e.preventDefault();
      const newTags = tags.slice(0, -1);
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
          <span>{tag}</span>
          <button
            onClick={() => removeTag(index)}
            className="ml-1 focus:outline-none"
          >
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
