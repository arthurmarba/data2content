"use client";

import React, { useState, useEffect } from "react";
import { ChevronUpIcon } from "@heroicons/react/24/outline";

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 200) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };
    window.addEventListener("scroll", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <button
      aria-label="Voltar ao topo"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 p-2 rounded-full bg-indigo-600 text-white shadow-md hover:bg-indigo-700"
    >
      <ChevronUpIcon className="w-5 h-5" />
    </button>
  );
}
