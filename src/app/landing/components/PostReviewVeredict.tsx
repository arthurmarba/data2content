"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, XCircle, Bell } from 'lucide-react';

const notifications = [
    {
        id: 1,
        status: 'do' as const,
        title: 'Keep Doing',
        message: "Sua narrativa de 'bastidores' converte 3x mais. Continue mostrando o processo de criação de conteúdo.",
        icon: <CheckCircle2 className="w-4 h-4" />,
        color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        dot: 'bg-emerald-500',
        stats: { likes: 12400, comments: 842, shares: 320, saved: 156, reach: 45000 },
        image: "/images/post-preview-1.jpg"
    },
    {
        id: 2,
        status: 'almost' as const,
        title: 'Pivot / Adjust',
        message: "O gancho deste vídeo está longo demais. Corte os primeiros 2 segundos para prender a atenção mais rápido.",
        icon: <Bell className="w-4 h-4" />,
        color: 'bg-amber-50 border-amber-200 text-amber-700',
        dot: 'bg-amber-500',
        stats: { likes: 3200, comments: 124, shares: 15, saved: 42, reach: 12000 },
        image: "/images/post-preview-2.jpg"
    },
    {
        id: 3,
        status: 'dont' as const,
        title: 'Stop Doing',
        message: "Este formato de dancinha genérica está atraindo o público errado para o seu nicho de gastronomia.",
        icon: <AlertCircle className="w-4 h-4" />,
        color: 'bg-rose-50 border-rose-200 text-rose-700',
        dot: 'bg-rose-500',
        stats: { likes: 840, comments: 210, shares: 2, saved: 8, reach: 3500 },
        image: "/images/post-preview-3.jpg"
    }
];

export default function PostReviewVeredict() {
    const [index, setIndex] = React.useState(0);

    React.useEffect(() => {
        const timer = setInterval(() => {
            setIndex((prev) => (prev + 1) % notifications.length);
        }, 4000);
        return () => clearInterval(timer);
    }, []);

    return (
        <section className="py-24 bg-white relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[600px] h-[600px] bg-brand-primary/5 rounded-full blur-[120px] -z-10" />

            <div className="landing-section__inner relative">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8">
                        <motion.span
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="landing-chip bg-brand-primary/10 text-brand-primary border-brand-primary/20"
                        >
                            O Veredito do Especialista
                        </motion.span>
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="text-4xl md:text-5xl font-black text-brand-dark leading-[1.1]"
                        >
                            Nunca mais poste <br />
                            <span className="text-brand-primary">no escuro.</span>
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="text-xl text-brand-text-secondary font-medium leading-relaxed max-w-lg"
                        >
                            Nossa IA e nossos estrategistas analisam seu conteúdo post a post.
                            Você recebe feedback real sobre o que te valoriza para as marcas.
                        </motion.p>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3 }}
                            className="flex items-start gap-4 p-6 rounded-3xl bg-brand-surface border border-brand-glass shadow-glass-sm"
                        >
                            <div className="mt-1 bg-brand-primary/10 p-2 rounded-xl text-brand-primary">
                                <Bell className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-brand-dark">Notas táticas exclusivas</h4>
                                <p className="text-sm text-brand-text-secondary leading-relaxed">
                                    Explicamos o &quot;porquê&quot; de cada sugestão para que você aprenda a criar com intenção e estratégia.
                                </p>
                            </div>
                        </motion.div>
                    </div>

                    <div className="relative flex justify-center lg:justify-end py-10 lg:py-0">
                        {/* Mobile Simulation Frame */}
                        <div className="relative w-[320px] h-[640px] rounded-[3.5rem] border-[12px] border-brand-dark bg-white shadow-2xl overflow-hidden">
                            {/* Mobile Notch */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-brand-dark rounded-b-2xl z-20" />

                            <div className="absolute inset-0 p-6 pt-16 flex flex-col gap-4 bg-gray-50/50">
                                <AnimatePresence mode="popLayout">
                                    {notifications.slice(0, index + 1).map((notif, i) => (
                                        <motion.div
                                            key={notif.id}
                                            initial={{ opacity: 0, y: 20, scale: 0.9 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{
                                                type: "spring",
                                                stiffness: 400,
                                                damping: 30
                                            }}
                                            className="relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg backdrop-blur-md"
                                        >
                                            {/* Status Header */}
                                            <div className={`flex items-center gap-2 border-b px-4 py-2 ${notif.color} border-b`}>
                                                {notif.icon}
                                                <span className="text-[10px] font-bold uppercase tracking-wider">
                                                    {notif.title}
                                                </span>
                                            </div>

                                            {/* Body */}
                                            <div className="p-4 space-y-3">
                                                <p className="text-[11px] font-medium leading-relaxed text-slate-800">
                                                    {notif.message}
                                                </p>

                                                {/* Metrics Grid Mock */}
                                                <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-50 p-2">
                                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                                        <span className="text-[9px] font-bold text-slate-600">{(notif.stats.likes / 1000).toFixed(1)}k</span>
                                                        <span className="text-[7px] text-slate-400 uppercase">Likes</span>
                                                    </div>
                                                    <div className="flex flex-col items-center justify-center gap-0.5 border-l border-slate-200">
                                                        <span className="text-[9px] font-bold text-slate-600">{notif.stats.comments}</span>
                                                        <span className="text-[7px] text-slate-400 uppercase">Comm</span>
                                                    </div>
                                                    <div className="flex flex-col items-center justify-center gap-0.5 border-l border-slate-200">
                                                        <span className="text-[9px] font-bold text-slate-600">{(notif.stats.reach / 1000).toFixed(1)}k</span>
                                                        <span className="text-[7px] text-slate-400 uppercase">Reach</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Footer Mock */}
                                            <div className="bg-slate-50/50 p-2 border-t border-slate-100 flex items-center gap-2">
                                                <div className="w-8 h-8 rounded bg-slate-200 shrink-0 overflow-hidden relative">
                                                    {/* Image placeholder or real image if available */}
                                                    <div className="absolute inset-0 bg-brand-primary/10 flex items-center justify-center text-[10px] text-brand-primary">
                                                        ▶
                                                    </div>
                                                </div>
                                                <span className="text-[9px] font-bold text-brand-primary truncate">Original Content Preview</span>
                                            </div>
                                        </motion.div>
                                    )).reverse()}
                                </AnimatePresence>

                                {/* Visual interface filler */}
                                <div className="mt-auto space-y-4 opacity-10">
                                    <div className="h-40 bg-brand-dark rounded-3xl" />
                                    <div className="h-4 w-2/3 bg-brand-dark rounded-full" />
                                    <div className="h-4 w-1/2 bg-brand-dark rounded-full" />
                                </div>
                            </div>
                        </div>

                        {/* Abstract Background Decorative */}
                        <div className="absolute -z-10 -top-10 -right-10 w-96 h-96 bg-brand-primary/10 rounded-full blur-[100px]" />
                    </div>
                </div>
            </div>
        </section>
    );
}
