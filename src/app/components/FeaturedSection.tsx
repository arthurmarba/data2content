// src/app/components/FeaturedSection.tsx
import React from "react";
import Card from "./Card";

const FeaturedSection: React.FC = () => {
  return (
    <section className="px-6 py-10">
      <h2 className="text-2xl font-semibold mb-4">
        Featured episodes, questions, and clips
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card
          title="Dr. Ellen Langer: Using Your Mind to Control Your Physical Health & Longevity"
          description="Answers 2,703 questions"
          buttonText="Explore episode"
          cardClasses="bg-blue-500 text-white"
          buttonClasses="bg-white text-blue-500"
        />
        <Card
          title="Sleep Hygiene Essentials"
          buttonText="Play Clip"
          cardClasses="bg-gray-900 text-white"
          buttonClasses="bg-white text-black"
        />
        <Card
          title="Popular Question"
          description="Asked by 6,556 people"
          buttonText="View answer"
          cardClasses="bg-gray-200 text-black"
          buttonClasses="bg-black text-white"
        />
      </div>
    </section>
  );
};

export default FeaturedSection;
