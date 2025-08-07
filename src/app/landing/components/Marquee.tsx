"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";

interface MarqueeProps {
  items: string[];
  direction?: "left" | "right";
}

export default function Marquee({ items, direction = "left" }: MarqueeProps) {
  const marqueeContent = useMemo(() => [...items, ...items], [items]);
  return (
    <div className="relative w-full overflow-hidden">
      <motion.div
        className="flex gap-4"
        initial={{ x: direction === "left" ? 0 : "-50%" }}
        animate={{ x: direction === "left" ? "-50%" : 0 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      >
        {marqueeContent.map((item, index) => (
          <div
            key={index}
            className="flex-shrink-0 whitespace-nowrap px-6 py-3 rounded-full bg-gray-200/80 text-gray-600 font-medium"
          >
            {item}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

