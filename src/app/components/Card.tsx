// src/app/components/Card.tsx
import React from "react";
import { FaArrowRight } from "react-icons/fa";

interface CardProps {
  title: string;
  description?: string;
  buttonText: string;
  cardClasses: string;
  buttonClasses: string;
}

const Card: React.FC<CardProps> = ({
  title,
  description,
  buttonText,
  cardClasses,
  buttonClasses,
}) => {
  return (
    <div className={`p-6 rounded-lg shadow-lg ${cardClasses}`}>
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      {description && <p className="text-sm mb-4">{description}</p>}
      <button className={`mt-4 px-4 py-2 rounded-lg flex items-center ${buttonClasses}`}>
        {buttonText}
        <FaArrowRight className="ml-2" />
      </button>
    </div>
  );
};

export default Card;
