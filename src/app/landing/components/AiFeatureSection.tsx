import React from "react";

type AiFeatureSectionProps = {
    onCreatorCta: () => void;
    onBrandCta: () => void;
};

type ChatMeta = {
    label: string;
    value: string;
};

type ChatSchedule = {
    label: string;
    items: string[];
};

type ChatMessage = {
    id: string;
    sender: "user" | "ai";
    text: string;
    meta?: ChatMeta[];
    schedule?: ChatSchedule;
    bullets?: string[];
    footer?: string;
};

const chatMessages: ChatMessage[] = [
    {
        id: "user-1",
        sender: "user",
        text: "Quero um planejamento baseado em categorias.",
    },
    {
        id: "ai-1",
        sender: "ai",
        text: "Claro! Analisei seus últimos 30 dias. Sua melhor combinação F/P/C (Formato/Proposta/Contexto) para conversão é Reels + Educacional + Rotina.",
        meta: [
            { label: "F/P/C Vencedor", value: "Reels • Educacional • Rotina" },
            { label: "Taxa de Conversão", value: "1.8% (vs 0.5% média)" },
            { label: "Custo por Lead", value: "R$ 4,20" },
        ],
        footer: "Base: Análise de 14 posts recentes + benchmarks do seu nicho.",
    },
    {
        id: "user-2",
        sender: "user",
        text: "Qual o melhor dia/hora pra postar por formato?",
    },
    {
        id: "ai-2",
        sender: "ai",
        text: "Pra você, o padrão é bem claro. Segue o ranking dos seus horários nobres:",
        schedule: {
            label: "Melhores Horários (Conversão)",
            items: ["Ter 12h (Reels)", "Qui 18h (Carrossel)", "Dom 20h (Stories)"],
        },
        footer: "Postar nesses horários aumenta seu alcance em média 20%.",
    },
];

export default function AiFeatureSection({ onCreatorCta, onBrandCta }: AiFeatureSectionProps) {
    return (
        <section className="landing-section landing-section--plain bg-white relative overflow-hidden">
            <div className="landing-section__inner landing-section__inner--wide flex flex-col items-center gap-10 md:gap-12">
                {/* Text Section */}
                <div className="flex w-full flex-col items-center text-center gap-6">
                    <div className="flex flex-col gap-3">
                        <span className="landing-chip self-center">
                            Inteligência Artificial
                        </span>
                        <h2 className="text-display-lg text-brand-dark">
                            Sua estratégia, guiada por dados.
                        </h2>
                        <p className="text-body-lg font-normal text-brand-text-secondary max-w-4xl mx-auto">
                            O Chat IA é sua inteligência vinculada ao Instagram. Crie planejamentos, tire dúvidas e defina estratégias com base nos seus próprios números.
                        </p>
                    </div>
                </div>

                {/* Visual Section (Chat Demo) */}
                <div className="relative w-full mx-auto">
                    {/* Decorative background glow */}
                    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_40%,rgba(255,44,126,0.08),transparent_60%)]" />

                    <div className="relative z-10 flex flex-col gap-4 px-2 sm:px-0">
                        {/* Conversation */}
                        <div className="flex flex-col gap-3 sm:gap-4">
                            {chatMessages.map((message) => {
                                const isUser = message.sender === "user";
                                const bubbleBase = "rounded-2xl px-3.5 py-3 shadow-sm transition";
                                const bubbleColor = isUser
                                    ? "self-end max-w-[88%] md:max-w-[68%] rounded-tr-sm bg-brand-primary text-white shadow-brand-primary/25"
                                    : "max-w-[92%] md:max-w-[78%] rounded-tl-sm border border-gray-100 bg-gray-100/80 text-gray-800";

                                return (
                                    <div
                                        key={message.id}
                                        className={`flex flex-col ${isUser ? "items-end text-right" : "items-start"} gap-1`}
                                    >
                                        <div className={`${bubbleBase} ${bubbleColor}`}>
                                            <p className="text-sm sm:text-base leading-relaxed font-medium">{message.text}</p>

                                            {message.meta?.length ? (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {message.meta.map((meta) => (
                                                        <span
                                                            key={`${message.id}-${meta.label}`}
                                                            className={`inline-flex items-center gap-2 rounded-full px-3 py-[6px] text-[0.78rem] font-semibold shadow-[0_6px_14px_rgba(0,0,0,0.05)] ${isUser
                                                                ? "border border-white/30 bg-white/10 text-white"
                                                                : "border border-gray-200 bg-white text-gray-900"
                                                                }`}
                                                        >
                                                            <span
                                                                className={`text-[0.7rem] uppercase tracking-[0.12em] ${isUser ? "text-white/80" : "text-gray-600"
                                                                    }`}
                                                            >
                                                                {meta.label}
                                                            </span>
                                                            <span>{meta.value}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : null}

                                            {message.schedule ? (
                                                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-3 text-[0.85rem] text-gray-800 shadow-[0_6px_14px_rgba(0,0,0,0.04)]">
                                                    <span className="rounded-md bg-gray-50 px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-gray-600">
                                                        {message.schedule.label}
                                                    </span>
                                                    {message.schedule.items.map((item) => (
                                                        <span
                                                            key={`${message.id}-${item}`}
                                                            className="rounded-full bg-gray-50 px-3 py-[6px] text-[0.8rem] font-semibold text-gray-900 shadow-[0_6px_14px_rgba(0,0,0,0.03)]"
                                                        >
                                                            {item}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : null}

                                            {message.bullets?.length ? (
                                                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-gray-800">
                                                    {message.bullets.map((bullet, index) => (
                                                        <li key={`${message.id}-bullet-${index}`} className="flex gap-2">
                                                            <span aria-hidden="true" className="mt-[6px] h-[6px] w-[6px] rounded-full bg-brand-primary" />
                                                            <span>{bullet}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : null}

                                            {message.footer ? (
                                                <p className={`mt-3 text-[12px] ${isUser ? "text-white/90" : "text-gray-600"}`}>
                                                    {message.footer}
                                                </p>
                                            ) : null}
                                        </div>
                                        <span className={`${isUser ? "pr-1" : "pl-1"} text-[11px] font-medium text-gray-500`}>
                                            {isUser ? "Você" : "Mobi IA"}
                                        </span>
                                    </div>
                                );
                            })}

                            {/* IA output style card */}
                            <div className="max-w-[92%] md:max-w-[78%] rounded-2xl border border-gray-100 bg-white px-4 py-3 text-gray-800 shadow-sm">
                                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                                    <span>Plano semanal IA — estética facial</span>
                                    <span className="text-brand-primary">Base: 14 posts + comunidade</span>
                                </div>
                                <div className="mt-2 space-y-2 text-[13px] sm:text-sm">
                                    <div className="grid grid-cols-2 sm:grid-cols-[70px_1.1fr_1.1fr_1.1fr_110px] gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">
                                        <span>Dia</span>
                                        <span>Formato</span>
                                        <span>Tema</span>
                                        <span>CTA</span>
                                        <span className="hidden sm:block text-right">Meta</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-[70px_1.1fr_1.1fr_1.1fr_110px] gap-2 items-start rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2">
                                        <span className="text-[12px] font-semibold text-gray-700">Ter</span>
                                        <span className="text-gray-800">Reel 30s (educacional) 12h30</span>
                                        <span className="text-gray-800">3 erros que irritam a pele sensível</span>
                                        <span className="text-gray-800">“Salva e agenda consulta express”</span>
                                        <span className="hidden sm:block text-right font-semibold text-emerald-700">+18% salv.</span>
                                        <span className="sm:hidden col-span-2 text-right text-[12px] font-semibold text-emerald-700">+18% salv.</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-[70px_1.1fr_1.1fr_1.1fr_110px] gap-2 items-start rounded-xl border border-gray-100 bg-white px-3 py-2">
                                        <span className="text-[12px] font-semibold text-gray-700">Qui</span>
                                        <span className="text-gray-800">Carrossel 5p (prova social) 12h</span>
                                        <span className="text-gray-800">Antes/depois + print de DM</span>
                                        <span className="text-gray-800">“Marca quem quer fazer”</span>
                                        <span className="hidden sm:block text-right font-semibold text-emerald-700">+16% mensagens</span>
                                        <span className="sm:hidden col-span-2 text-right text-[12px] font-semibold text-emerald-700">+16% mensagens</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-[70px_1.1fr_1.1fr_1.1fr_110px] gap-2 items-start rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2">
                                        <span className="text-[12px] font-semibold text-gray-700">Sex</span>
                                        <span className="text-gray-800">Stories sequência 19h</span>
                                        <span className="text-gray-800">FAQ rápido + enquete dor</span>
                                        <span className="text-gray-800">“Responde e te mando o mini plano”</span>
                                        <span className="hidden sm:block text-right font-semibold text-emerald-700">+12% replies</span>
                                        <span className="sm:hidden col-span-2 text-right text-[12px] font-semibold text-emerald-700">+12% replies</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-[70px_1.1fr_1.1fr_1.1fr_110px] gap-2 items-start rounded-xl border border-gray-100 bg-white px-3 py-2">
                                        <span className="text-[12px] font-semibold text-gray-700">Dom</span>
                                        <span className="text-gray-800">Reel 30s (roteiro noite) 18h30</span>
                                        <span className="text-gray-800">“Checklist de skincare”</span>
                                        <span className="text-gray-800">“Envia NOITE pra receber lista”</span>
                                        <span className="hidden sm:block text-right font-semibold text-emerald-700">+17% salv.</span>
                                        <span className="sm:hidden col-span-2 text-right text-[12px] font-semibold text-emerald-700">+17% salv.</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-[70px_1.1fr_1.1fr_1.1fr_110px] gap-2 items-start rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2">
                                        <span className="text-[12px] font-semibold text-gray-700">Seg</span>
                                        <span className="text-gray-800">Stories (quiz) 12h</span>
                                        <span className="text-gray-800">Mitos x verdades skincare</span>
                                        <span className="text-gray-800">“Responde e mando avaliação grátis”</span>
                                        <span className="hidden sm:block text-right font-semibold text-emerald-700">+10% replies</span>
                                        <span className="sm:hidden col-span-2 text-right text-[12px] font-semibold text-emerald-700">+10% replies</span>
                                    </div>
                                </div>
                                <p className="mt-3 text-[12px] text-gray-500">
                                    Varia as capas e CTA por tom. A IA agenda as versões vencedoras nos horários fortes sem repetir categoria 3x seguidas.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
