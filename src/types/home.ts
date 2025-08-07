import React from "react";

export interface FAQItem {
    q: string;
    a: string;
}

export interface Testimonial {
    name: string;
    handle: string;
    quote: string;
    avatarUrl: string;
}

export interface ScreenshotItem {
    title: string;
    imageUrl: string;
    description: string;
}

export interface CreatorType {
    icon: React.ElementType;
    title: string;
    description: string;
}

export type HeroQuestion = string;
