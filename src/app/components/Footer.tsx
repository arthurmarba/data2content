"use client";

import React from "react";

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-800 py-4 px-6 text-center">
      <p className="text-sm text-gray-400">
        &copy; {new Date().getFullYear()} D2C Academy. Todos os direitos reservados.
      </p>
    </footer>
  );
};

export default Footer;
