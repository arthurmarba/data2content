"use client";

import React from "react";

const presetFilters = [
  "me mostre apenas reels",
  "compare reels com fotos",
  "compare os últimos 7 dias com os últimos 30 dias",
];

interface D2CAIFilterProps {
  userQuery: string;
  setUserQuery: (value: string) => void;
}

const D2CAIFilter: React.FC<D2CAIFilterProps> = ({ userQuery, setUserQuery }) => {
  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      <div>
        <label className="block text-sm text-gray-700 mb-1">
          Filtre os indicadores com d2c AI
        </label>
        <input
          type="text"
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          placeholder="Digite um filtro..."
          className="w-full h-10 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <div className="flex gap-2">
        {presetFilters.map((filter, index) => (
          <button
            key={index}
            onClick={() => setUserQuery(filter)}
            className="flex-1 h-10 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition"
          >
            {filter}
          </button>
        ))}
      </div>
    </div>
  );
};

export default D2CAIFilter;
