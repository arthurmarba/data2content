"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, UserCheck, ShieldCheck, Zap, Search, BarChart3 } from 'lucide-react';

const features = [
    {
        icon: <UserCheck className="w-6 h-6" />,
        title: "Casting de Narrativas",
        desc: "Marcas buscam criadores pela qualidade e nicho auditados pela D2C, não apenas por seguidores."
    },
    {
        icon: <ShieldCheck className="w-6 h-6" />,
        title: "Imagem Auditada",
        desc: "Seu perfil ganha um selo de confiança para o mercado, provando que sua audiência é real e engajada."
    },
    {
        icon: <TrendingUp className="w-6 h-6" />,
        title: "Media Kit Vivo",
        desc: "Dados reais extraídos direto da API do Instagram. Seus números se atualizam sozinhos."
    }
];

export default function BrandVitrine() {
    return (
        <section className="py-24 bg-brand-surface border-y border-brand-glass relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-accent/5 rounded-full blur-[120px] -z-10" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[120px] -z-10" />

            <div className="landing-section__inner">
                <div className="text-center max-w-3xl mx-auto mb-20 space-y-6">
                    <motion.span
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="landing-chip bg-brand-accent/10 text-brand-accent border-brand-accent/20"
                    >
                        Visibilidade & Dados Reais
                    </motion.span>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-5xl font-black text-brand-dark leading-[1.1]"
                    >
                        Sua imagem auditada, <br />
                        <span className="text-brand-accent">seu perfil na vitrine do mercado.</span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="text-xl text-brand-text-secondary font-medium"
                    >
                        Marcas de alto nível buscam narrativas específicas no nosso Casting.
                        Mais do que seguidores, entregamos transparência estratégica.
                    </motion.p>
                </div>

                <div className="grid lg:grid-cols-3 gap-8 mb-20">
                    {features.map((feat, i) => (
                        <motion.div
                            key={feat.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="p-8 rounded-[2rem] bg-white/60 backdrop-blur-md border border-brand-glass shadow-glass-sm hover:shadow-glass-md transition-all group"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-brand-accent/5 text-brand-accent mb-6 flex items-center justify-center transition-colors group-hover:bg-brand-accent group-hover:text-white">
                                {feat.icon}
                            </div>
                            <h3 className="text-xl font-bold text-brand-dark mb-4">{feat.title}</h3>
                            <p className="text-brand-text-secondary leading-relaxed">
                                {feat.desc}
                            </p>
                        </motion.div>
                    ))}
                </div>

                {/* Refocused Media Kit Preview Section */}
                <div className="relative mt-20 p-1 rounded-[3rem] bg-gradient-to-r from-brand-primary/20 via-brand-accent/20 to-brand-sun/20">
                    <div className="bg-white rounded-[2.9rem] p-8 md:p-16 overflow-hidden relative">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            <div className="space-y-8 relative z-10 text-left">
                                <h3 className="text-3xl md:text-4xl font-black text-brand-dark leading-tight">
                                    O fim do Mídia Kit estático em PDF.
                                </h3>
                                <p className="text-lg text-brand-text-secondary font-medium leading-relaxed">
                                    Na D2C, seu mídia kit é uma vitrine viva. As marcas veem seus dados reais, auditados e atualizados em tempo real via API oficial. Chega de prints antigos e dados duvidosos.
                                </p>

                                <div className="space-y-4">
                                    {[
                                        { icon: <Zap className="w-5 h-5" />, text: "Atualização automática post a post" },
                                        { icon: <Search className="w-5 h-5" />, text: "Busca por nichos e narrativas auditadas" },
                                        { icon: <BarChart3 className="w-5 h-5" />, text: "Cálculo automático de valor de publi" }
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-3 text-brand-dark font-bold">
                                            <div className="text-brand-accent">{item.icon}</div>
                                            <span>{item.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="relative">
                                {/* Abstract Visual Representation of a Media Kit Card */}
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
                                    whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                                    viewport={{ once: true }}
                                    className="relative z-10 p-8 rounded-[2.5rem] bg-brand-dark text-white shadow-2xl border border-white/10"
                                >
                                    <div className="flex justify-between items-start mb-8">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-slate-200" />
                                            <div className="text-left">
                                                <div className="h-4 w-24 bg-white/20 rounded-full mb-2" />
                                                <div className="h-3 w-16 bg-white/10 rounded-full" />
                                            </div>
                                        </div>
                                        <div className="px-3 py-1 rounded-full bg-brand-primary/20 text-brand-primary text-[10px] font-black uppercase">
                                            Auditado API
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-8">
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-left">
                                            <p className="text-[10px] uppercase text-white/40 mb-1">Alcance 30d</p>
                                            <p className="text-xl font-black text-brand-primary">+245k</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-left">
                                            <p className="text-[10px] uppercase text-white/40 mb-1">Engajamento</p>
                                            <p className="text-xl font-black text-brand-accent">14.2%</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full w-[80%] bg-brand-accent" />
                                        </div>
                                        <div className="flex justify-between text-[10px] font-bold text-white/30 uppercase tracking-widest">
                                            <span>Narrativas Ativas</span>
                                            <span>8/10 Score</span>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Background elements for the visual */}
                                <div className="absolute -top-10 -right-10 w-64 h-64 bg-brand-accent/20 rounded-full blur-[80px]" />
                                <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-brand-primary/20 rounded-full blur-[80px]" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-16 text-center">
                    <p className="text-sm font-bold text-brand-text-secondary uppercase tracking-[0.2em]">
                        Conectado com <span className="text-brand-dark">Official Instagram API</span>
                    </p>
                </div>
            </div>
        </section>
    );
}
