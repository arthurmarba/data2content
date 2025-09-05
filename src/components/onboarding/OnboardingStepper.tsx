"use client";

import React from "react";
import { FaCheckCircle, FaCircle, FaRegClock } from "react-icons/fa";

export type StepState = "completed" | "current" | "pending";

export interface StepItem {
  key: string;
  title: string;
  description?: string;
  state: StepState;
}

interface OnboardingStepperProps {
  steps: StepItem[];
}

export default function OnboardingStepper({ steps }: OnboardingStepperProps) {
  return (
    <ol className="space-y-4">
      {steps.map((step, idx) => {
        const isCompleted = step.state === "completed";
        const isCurrent = step.state === "current";
        const Icon = isCompleted ? FaCheckCircle : isCurrent ? FaRegClock : FaCircle;
        const color = isCompleted ? "text-green-600" : isCurrent ? "text-blue-600" : "text-gray-400";
        return (
          <li key={step.key} className="flex items-start">
            <div className={`mt-1 mr-3 ${color}`}>
              <Icon aria-hidden="true" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{idx + 1}. {step.title}</p>
              {step.description && (
                <p className="text-sm text-gray-600 mt-1">{step.description}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

