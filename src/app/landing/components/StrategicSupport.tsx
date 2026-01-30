"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { MessagesSquare, Video, Zap } from 'lucide-react';

export default function StrategicSupport() {
    return (
        <section className="py-24 bg-brand-surface relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-brand-sun/5 rounded-full blur-[120px] -z-10" />

            <div className="landing-section__inner relative">
                <div className="flex flex-col lg:flex-row gap-16 items-center">
                    <div className="lg:w-1/2 space-y-10">
                        <motion.span
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="landing-chip bg-brand-sun/10 text-brand-sun-dark border-brand-sun/20"
                        >
                            O Apoio que Não Te Deixa Só
                        </motion.span>
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="text-4xl md:text-5xl font-black text-brand-dark leading-[1.1]"
                        >
                            IA para a velocidade, <br />
                            <span className="text-brand-sun-dark">Arthur para a estratégia.</span>
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="text-xl text-brand-text-secondary leading-relaxed font-medium"
                        >
                            Além da revisão constante pela plataforma, temos reuniões semanais
                            para afinar sua rota e um canal direto via WhatsApp para acelerar seu crescimento.
                        </motion.p>

                        <div className="space-y-6">
                            {[
                                { icon: <Zap className="w-6 h-6" />, title: "Alertas em Tempo Real", desc: "Notificações automáticas de review assim que você posta." },
                                { icon: <Video className="w-6 h-6" />, title: "Reuniões Semanais", desc: "Encontros ao vivo para analisar métricas e ajustar o planejamento." },
                                { icon: <MessagesSquare className="w-6 h-6" />, title: "Suporte Direto", desc: "WhatsApp liberado para mentorias rápidas e estratégicas." }
                            ].map((item, i) => (
                                <motion.div
                                    key={item.title}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: 0.3 + (i * 0.1) }}
                                    className="flex gap-5 group"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-white shadow-glass-sm flex items-center justify-center text-brand-sun-dark shrink-0 transition-all group-hover:scale-110 group-hover:shadow-glass-md">
                                        {item.icon}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-brand-dark text-lg group-hover:text-brand-sun-dark transition-colors">{item.title}</h4>
                                        <p className="text-sm text-brand-text-secondary leading-relaxed">{item.desc}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        <motion.p
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.6 }}
                            className="text-xl font-black text-brand-dark pt-4 border-t border-brand-glass italic"
                        >
                            &quot;Você foca na frente da câmera, nós cuidamos de todo o resto.&quot;
                        </motion.p>
                    </div>

                    <div className="lg:w-1/2 relative flex justify-center">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            className="relative w-full max-w-md aspect-[4/5] rounded-[3.5rem] overflow-hidden shadow-glass-lg border-[12px] border-white bg-white"
                        >
                            <div className="absolute inset-0 bg-gradient-to-tr from-brand-primary/10 via-transparent to-brand-sun/20 z-10" />
                            <div className="absolute inset-0 bg-brand-surface flex items-center justify-center">
                                <div className="text-center p-8 bg-white/40 backdrop-blur-md rounded-[2.5rem] border border-white/60 mx-6">
                                    <div className="w-20 h-20 rounded-full bg-brand-sun/20 mx-auto mb-6 flex items-center justify-center text-brand-sun-dark shadow-inner">
                                        <UserIcon className="w-10 h-10" />
                                    </div>
                                    <h5 className="text-brand-dark font-black text-2xl mb-2">Estratégia <br /> Individual</h5>
                                    <p className="text-brand-text-secondary text-sm font-bold tracking-tight uppercase">Foco no crescimento real</p>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            animate={{ y: [0, -12, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute -top-4 -right-2 p-4 rounded-3xl bg-white shadow-glass-lg border border-brand-glass z-20 flex items-center gap-3"
                        >
                            <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                                <MessagesSquare className="w-5 h-5" />
                            </div>
                            <div className="pr-2">
                                <p className="text-[10px] uppercase tracking-widest font-black text-emerald-600">Time Ativo</p>
                                <p className="text-sm font-black text-brand-dark">WhatsApp Online</p>
                            </div>
                        </motion.div>

                        <motion.div
                            animate={{ y: [0, 12, 0] }}
                            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                            className="absolute -bottom-4 -left-2 p-4 rounded-3xl bg-brand-dark shadow-2xl border border-white/10 z-20 flex items-center gap-3"
                        >
                            <div className="w-10 h-10 rounded-2xl bg-brand-primary flex items-center justify-center text-white shadow-lg shadow-brand-primary/20">
                                <Video className="w-5 h-5" />
                            </div>
                            <div className="pr-2">
                                <p className="text-[10px] uppercase tracking-widest font-black text-white/40">VIP Meeting</p>
                                <p className="text-sm font-black text-white">Segunda · 19h</p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function UserIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
    );
}
