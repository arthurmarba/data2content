"use client";
import { FaCheckCircle, FaCircle } from "react-icons/fa";

interface StepIndicatorProps {
  planActive: boolean;
  instagramConnected: boolean;
  whatsappConnected: boolean;
}

export default function StepIndicator({ planActive, instagramConnected, whatsappConnected }: StepIndicatorProps) {
  const steps = [
    { title: "Assinar Plano", completed: planActive },
    { title: "Conectar Instagram", completed: instagramConnected },
    { title: "Vincular WhatsApp", completed: whatsappConnected },
  ];
  const currentIndex = steps.findIndex((s) => !s.completed);
  return (
    <ol className="flex items-center space-x-4 text-sm mb-6">
      {steps.map((step, idx) => (
        <li key={step.title} className="flex items-center">
          {step.completed ? (
            <FaCheckCircle className="text-green-600 w-4 h-4 mr-1" />
          ) : (
            <FaCircle className={`w-3 h-3 mr-1 ${idx === currentIndex ? 'text-brand-pink' : 'text-gray-400'}`} />
          )}
          <span className={idx === currentIndex ? "font-semibold text-brand-pink" : "text-gray-600"}>{step.title}</span>
          {idx < steps.length - 1 && <span className="mx-2 text-gray-400">/</span>}
        </li>
      ))}
    </ol>
  );
}
