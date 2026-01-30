"use client";

import React from 'react';
import { Check, X } from 'lucide-react';

const rows = [
    {
        label: "Decisão de Conteúdo",
        alone: "Baseada em 'achismos'",
        d2c: "Check de Ouro post a post"
    },
    {
        label: "Visibilidade",
        alone: "Esperando o Direct tocar",
        d2c: "Vitrine ativa para marcas"
    },
    {
        label: "Organização",
        alone: "Caos em planilhas/notas",
        d2c: "Painel de Publis profissional"
    },
    {
        label: "Ganhos",
        alone: "Desconhece o valor real",
        d2c: "Sabe exatamente quanto cobrar"
    }
];

export default function D2CComparison() {
    return (
        <section className="py-24 bg-white">
            <div className="landing-section__inner">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-3xl md:text-4xl font-black text-brand-dark mb-4">
                        O Jeito D2C de Crescer
                    </h2>
                    <p className="text-brand-text-secondary font-medium">
                        Por que continuar tentando sozinho quando você pode ter o suporte dos melhores?
                    </p>
                </div>

                <div className="max-w-4xl mx-auto overflow-hidden rounded-[2rem] border border-brand-glass shadow-glass-lg">
                    <div className="grid grid-cols-3 bg-brand-dark text-white p-6 font-bold text-center border-b border-white/10">
                        <div className="text-left">Característica</div>
                        <div>Postando Sozinho</div>
                        <div className="text-brand-primary">Com a Data2Content</div>
                    </div>

                    <div className="divide-y divide-brand-glass">
                        {rows.map((row) => (
                            <div key={row.label} className="grid grid-cols-3 p-6 text-center items-center hover:bg-gray-50 transition-colors">
                                <div className="text-left font-bold text-brand-dark text-sm md:text-base">{row.label}</div>
                                <div className="text-brand-text-secondary text-sm flex flex-col items-center gap-2">
                                    <X className="w-5 h-5 text-rose-500 opacity-50" />
                                    <span>{row.alone}</span>
                                </div>
                                <div className="font-bold text-brand-dark text-sm flex flex-col items-center gap-2">
                                    <Check className="w-6 h-6 text-emerald-500" />
                                    <span className="bg-brand-primary/5 text-brand-primary px-3 py-1 rounded-lg">
                                        {row.d2c}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-gray-50 p-8 text-center border-t border-brand-glass">
                        <p className="text-sm font-semibold text-brand-text-secondary">
                            &quot;A Data2Content é o braço direito que você sempre quis, mas nenhum serviço ofereceu.&quot;
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
