"use client";

import { motion } from "framer-motion";
import heroQuestions from "@/data/heroQuestions";

interface MarqueeProps {
  direction?: "left" | "right";
}

export default function Marquee({ direction = "left" }: MarqueeProps) {
  const questions = [...heroQuestions, ...heroQuestions];
  const animateFrom = direction === "left" ? "0%" : "-100%";
  const animateTo = direction === "left" ? "-100%" : "0%";

  return (
    <div className="overflow-hidden whitespace-nowrap">
      <motion.div
        className="flex gap-8"
        animate={{ x: [animateFrom, animateTo] }}
        transition={{ repeat: Infinity, ease: "linear", duration: 30 }}
      >
        {questions.map((q, idx) => (
          <span key={idx} className="text-sm md:text-base text-gray-600">
            {q}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

