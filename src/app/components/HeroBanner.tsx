"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

const HeroBanner: React.FC = () => {
  return (
    <section className="bg-gradient-to-r from-blue-500 to-purple-600 text-white py-12 px-6 text-center">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-4xl font-bold mb-4"
      >
        Ask Huberman Lab
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="text-lg mb-6 max-w-2xl mx-auto"
      >
        Huberman Lab discusses neuroscience: how our brain and its connections with the organs of our body shape our behavior and performance.
      </motion.p>
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Link
          href="/auth/signup"
          className="inline-block bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-full shadow-lg transition transform hover:scale-105"
        >
          Cadastre-se Agora
        </Link>
      </motion.div>
    </section>
  );
};

export default HeroBanner;
