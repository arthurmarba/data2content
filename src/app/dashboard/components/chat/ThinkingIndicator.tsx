import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const THINKING_STEPS = [
    'Analisando métricas...',
    'Consultando estratégias...',
    'Buscando referências...',
    'Verificando melhores horários...',
    'Escrevendo resposta...',
];

export const ThinkingIndicator = () => {
    const [stepIndex, setStepIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setStepIndex((prev) => (prev + 1) % THINKING_STEPS.length);
        }, 2200); // Change step every 2.2s

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-center gap-3 rounded-2xl border border-brand-primary/10 bg-brand-primary/5 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-brand-primary animate-bounce [animation-delay:-0.3s]" />
                <span className="h-2 w-2 rounded-full bg-brand-primary animate-bounce [animation-delay:-0.15s]" />
                <span className="h-2 w-2 rounded-full bg-brand-primary animate-bounce" />
            </div>
            <div className="h-[20px] overflow-hidden relative w-[180px]">
                <AnimatePresence mode="wait">
                    <motion.span
                        key={stepIndex}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="absolute left-0 top-0 text-xs font-semibold uppercase tracking-wide text-brand-primary"
                    >
                        {THINKING_STEPS[stepIndex]}
                    </motion.span>
                </AnimatePresence>
            </div>
        </div>
    );
};
