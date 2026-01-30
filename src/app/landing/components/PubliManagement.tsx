"use client";

import React from 'react';
import { Calendar, Wallet, FileText, ClipboardList } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PubliManagement() {
    return (
        <section className="py-24 bg-white relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px] -z-10" />

            <div className="landing-section__inner relative">
                <div className="flex flex-col lg:flex-row gap-16 items-center">
                    <div className="lg:w-1/2 relative order-2 lg:order-1">
                        {/* Visual representation of the dashboard */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="relative p-8 rounded-[3rem] bg-brand-dark shadow-2xl overflow-hidden border border-white/10"
                        >
                            <div className="flex items-center justify-between mb-10">
                                <div className="flex gap-2">
                                    <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]" />
                                    <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]" />
                                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
                                </div>
                                <div className="px-4 py-1.5 rounded-full bg-white/10 text-[10px] text-white font-bold uppercase tracking-wider backdrop-blur-md">
                                    Painel Pro D2C
                                </div>
                            </div>

                            <div className="space-y-5">
                                {[
                                    {
                                        title: "Campanha Skincare",
                                        sub: "24 de Janeiro, 2025",
                                        tag: "Classificado",
                                        tagColor: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                                        stats: "12.4k views · 842 comments"
                                    },
                                    {
                                        title: "Roteiro Lifestyle",
                                        sub: "28 de Janeiro, 2025",
                                        tag: "Pendente",
                                        tagColor: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                                        stats: "Aguardando análise IA..."
                                    }
                                ].map((job, i) => (
                                    <motion.div
                                        key={job.title}
                                        initial={{ opacity: 0, y: 10 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: 0.2 + (i * 0.1) }}
                                        className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3 hover:bg-white/10 transition-colors group"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-white/10 overflow-hidden relative">
                                                    <div className="absolute inset-0 bg-brand-primary/20 flex items-center justify-center text-[10px]">▶</div>
                                                </div>
                                                <div>
                                                    <p className="text-white font-bold text-sm">{job.title}</p>
                                                    <p className="text-white/40 text-[10px]">{job.sub}</p>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full ${job.tagColor} text-[9px] font-bold uppercase tracking-wider`}>
                                                {job.tag}
                                            </span>
                                        </div>

                                        <div className="pt-2 border-t border-white/5 flex gap-2">
                                            <div className="flex-1 h-7 rounded-lg bg-white/10 flex items-center justify-center text-[9px] font-bold text-white/60">
                                                Analisar
                                            </div>
                                            <div className="flex-1 h-7 rounded-lg bg-brand-primary text-white flex items-center justify-center text-[9px] font-bold">
                                                Share
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Decorative glow */}
                            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-brand-primary/20 rounded-full blur-[100px]" />
                        </motion.div>
                    </div>

                    <div className="lg:w-1/2 space-y-10 order-1 lg:order-2">
                        <motion.span
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="landing-chip bg-emerald-50 text-emerald-600 border-emerald-100"
                        >
                            Paz de Espírito
                        </motion.span>
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="text-4xl md:text-5xl font-black text-brand-dark leading-[1.1]"
                        >
                            Gerencie suas publis <br />
                            <span className="text-emerald-600">como um profissional de elite.</span>
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="text-xl text-brand-text-secondary leading-relaxed font-medium"
                        >
                            Chega de conversas perdidas no Direct ou planilhas desatualizadas.
                            Organize todos os seus contratos, prazos e briefings no seu próprio Painel de Campanhas.
                        </motion.p>

                        <div className="grid sm:grid-cols-2 gap-8">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.3 }}
                                className="space-y-4 p-6 rounded-[2rem] bg-emerald-50/30 border border-emerald-100/50 hover:bg-emerald-50/50 transition-colors"
                            >
                                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-emerald-600">
                                    <ClipboardList className="w-6 h-6" />
                                </div>
                                <h4 className="font-black text-brand-dark text-lg">Controle Total</h4>
                                <p className="text-sm text-brand-text-secondary leading-normal font-medium">
                                    Nunca mais perca um prazo ou esqueça de cobrar um pagamento pendente.
                                </p>
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.4 }}
                                className="space-y-4 p-6 rounded-[2rem] bg-emerald-50/30 border border-emerald-100/50 hover:bg-emerald-50/50 transition-colors"
                            >
                                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-emerald-600">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <h4 className="font-black text-brand-dark text-lg">Central de Briefing</h4>
                                <p className="text-sm text-brand-text-secondary leading-normal font-medium">
                                    Tudo o que a marca pediu, salvo e acessível em um único lugar seguro.
                                </p>
                            </motion.div>
                        </div>

                        <motion.blockquote
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.5 }}
                            className="p-8 rounded-[2.5rem] bg-gray-50 border-l-[6px] border-emerald-500 italic text-xl font-medium text-brand-text-secondary shadow-sm"
                        >
                            &quot;O criador foca em criar; a Data2Content cuida da estrutura de negócios.&quot;
                        </motion.blockquote>
                    </div>
                </div>
            </div>
        </section>
    );
}
