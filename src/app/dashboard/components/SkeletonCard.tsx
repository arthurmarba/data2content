// src/app/dashboard/components/SkeletonCard.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";

const SkeletonCard: React.FC = () => {
  return (
    <motion.div
      className="bg-gray-200 rounded-lg p-4 h-full"
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, repeat: Infinity, repeatType: "mirror" }}
    >
      <div className="h-5 bg-gray-300 rounded w-3/4 mb-4"></div>
      <div className="h-32 bg-gray-300 rounded mb-4"></div>
      <div className="h-4 bg-gray-300 rounded w-5/6"></div>
    </motion.div>
  );
};

export default SkeletonCard;
