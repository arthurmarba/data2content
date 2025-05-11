// src/app/components/auth/FullPageLoader.tsx
"use client";

import React from 'react';

const FullPageLoader: React.FC<{ message?: string }> = ({ message = "A carregar..." }) => (
  <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100">
    {/* Você pode usar seu próprio spinner/loader aqui se preferir */}
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mb-4"></div>
    <p className="text-gray-700 text-lg">{message}</p>
  </div>
);

export default FullPageLoader;