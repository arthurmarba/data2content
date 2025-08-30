// src/app/dashboard/ChatPanel.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession, signIn } from "next-auth/react";
import {
  FaPaperPlane, FaInstagram, FaPlus, FaExternalLinkAlt,
  FaTimes, FaLightbulb, FaChartLine, FaQuestionCircle, FaCheckCircle, FaExclamationTriangle
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import WhatsAppConnectInline from './WhatsAppConnectInline';

interface SessionUserWithId {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}
interface Message {
  sender: "user" | "consultant";
  text: string;
  cta?: { label: string; action: 'connect_instagram' | 'go_to_billing' };
}

function PromptSuggestionCard({ icon, title, text, onClick }: { icon: React.ReactNode; title: string; text: string; onClick: () => void; }) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left p-4 bg-white/50 hover:bg-white/80 border border-gray-200/80 rounded-xl transition-all duration-200 shadow-sm hover:shadow-lg hover:-translate-y-1"
    >
      <div className="flex items-start gap-4">
        <div className="text-blue-500 mt-1">{icon}</div>
        <div>
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{text}</p>
        </div>
      </div>
    </button>
  );
}

function renderFormatted(text: string) {
  const lines = text.split(/\r?\n/);
  const blocks: JSX.Element[] = [];
  lines.forEach((line, i) => {
    if (/^\s*$/.test(line)) return;
    blocks.push(
      <p
        key={`p-${i}`}
        className="leading-relaxed break-words"
        dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
      />
    );
  });
  return <div className="space-y-2 text-[15px]">{blocks}</div>;
}

export default function ChatPanel({ onUpsellClick }: { onUpsellClick?: () => void } = {}) {
  const { data: session } = useSession();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);

  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [inlineAlert, setInlineAlert] = useState<string | null>(null);
  const autoScrollOnNext = useRef(false);

  const userWithId = session?.user as SessionUserWithId | undefined;
  const instagramConnected = Boolean((session?.user as any)?.instagramConnected);
  const instagramUsername = ((session?.user as any)?.instagramUsername as string | undefined) || null;
  const planStatus = String((session?.user as any)?.planStatus || '').toLowerCase();
  const isActiveLikePlan = ['active', 'trial', 'trialing', 'non_renewing'].includes(planStatus);

  const handleCorrectInstagramLink = async () => {
    try {
      const response = await fetch('/api/auth/iniciar-vinculacao-fb', { method: 'POST' });
      if (!response.ok) return console.error('Falha ao preparar a vinculação da conta.');
      signIn('facebook', { callbackUrl: '/dashboard/chat?instagramLinked=true' });
    } catch (error) {
      console.error('Erro no processo de vinculação:', error);
      setInlineAlert('Não foi possível iniciar a conexão com o Instagram. Tente novamente.');
    }
  };

  // auto-resize do textarea
  useEffect(() => {
    const el = textAreaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // detectar “fim”
  useEffect(() => {
    const root = scrollRef.current;
    const target = messagesEndRef.current;
    if (!root || !target) return;
    const io = new IntersectionObserver(
      (entries) => setIsAtBottom(entries[0]?.isIntersecting ?? false),
      { root, threshold: 1.0, rootMargin: "0px 0px 60px 0px" }
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  // autoscroll
  useEffect(() => {
    if (autoScrollOnNext.current || isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      autoScrollOnNext.current = false;
    }
  }, [messages, isAtBottom]);

  const handleSend = async () => {
    setInlineAlert(null);
    if (!input.trim()) return;
    if (!userWithId?.id) {
      setInlineAlert('Você precisa estar logado para enviar mensagens.');
      return;
    }
    if (isSending) return;
    if (typeof navigator !== 'undefined' && navigator && !navigator.onLine) {
      setInlineAlert('Sem conexão com a internet no momento.');
      return;
    }

    const prompt = input.trim();
    setInput("");
    setIsSending(true);
    autoScrollOnNext.current = true;

    setMessages(prev => [...prev, { sender: 'user', text: prompt }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query: prompt }),
      });
      const data = await res.json();

      if (res.ok && data.answer) {
        setMessages(prev => [...prev, { sender: 'consultant', text: data.answer, cta: data.cta }]);
      } else {
        throw new Error(data?.error || "Não foi possível obter resposta.");
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { sender: 'consultant', text: 'Ocorreu um erro ao gerar a resposta.' }]);
      setInlineAlert(e?.message || 'Falha ao consultar a IA. Tente novamente.');
    } finally {
      setIsSending(false);
    }
  };

  const isWelcome = messages.length === 0;
  const fullName = (session?.user?.name || "").trim();
  const firstName = fullName ? fullName.split(" ")[0] : "visitante";

  const welcomePrompts = [
    { icon: <FaLightbulb />, title: "Gerar ideias", text: "Me dê 5 ideias de Reels sobre marketing digital.", isConnectedFeature: false, prompt: "Me dê 5 ideias de Reels sobre marketing digital para essa semana." },
    { icon: <FaChartLine />, title: "Analisar posts", text: "Qual dos meus últimos 5 posts teve mais engajamento?", isConnectedFeature: true, prompt: "Qual dos meus últimos 5 posts teve mais engajamento?" },
    { icon: <FaQuestionCircle />, title: "Tirar dúvidas", text: "Como usar o CTA 'salvar' de forma mais eficiente?", isConnectedFeature: false, prompt: "Como usar o CTA 'salvar' de forma mais eficiente?" },
  ];

  const safeBottom = 'env(safe-area-inset-bottom, 0px)';

  return (
    // trocado overflow-hidden -> overflow-x-hidden para não cortar a sombra no rodapé
    <div className="relative flex flex-col h-full w-full bg-white overflow-x-hidden">
      {/* timeline */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar"
        style={{
          paddingTop: 'var(--header-h, 4rem)',
        }}
      >
        <div className="flex flex-col justify-end min-h-full">
          {isWelcome ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
                <h1 className="text-4xl sm:text-5xl font-bold text-center">
                  <span className="text-gray-800">Olá, </span>
                  <span className="text-blue-600">{firstName}</span>
                </h1>
                <p className="text-gray-500 text-center mt-2">O que podemos criar hoje?</p>
              </motion.div>
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
                className="w-full max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 mt-10"
              >
                {welcomePrompts.map((p, i) => (
                  <motion.div key={i} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                    <PromptSuggestionCard
                      icon={p.icon}
                      title={p.title}
                      text={p.text}
                      onClick={() => {
                        if (p.isConnectedFeature && !instagramConnected) {
                          handleCorrectInstagramLink();
                        } else {
                          setInput(p.prompt);
                          setTimeout(handleSend, 0);
                        }
                      }}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          ) : (
            <div className="mx-auto max-w-[800px] w-full px-4">
              <ul role="list" aria-live="polite" className="space-y-2">
                {messages.map((msg, idx) => (
                  <li key={idx} className={`w-full flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-4 py-3 shadow-md ${msg.sender === 'user' ? 'rounded-t-2xl rounded-bl-2xl bg-blue-600 text-white' : 'rounded-t-2xl rounded-br-2xl bg-gray-200 text-gray-800'}`}>
                      {renderFormatted(msg.text)}
                      {msg.cta && (
                        <div className="mt-4">
                          <button
                            className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors
                            ${msg.sender === 'user' ? 'bg-white/20 text-white border border-white/30 hover:bg-white/30' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                            onClick={() => {
                              if (msg.cta?.action === 'connect_instagram') return handleCorrectInstagramLink();
                              if (msg.cta?.action === 'go_to_billing') {
                                if (onUpsellClick) return onUpsellClick();
                                return router.push('/dashboard/billing');
                              }
                            }}
                          >
                            {msg.cta.action === 'connect_instagram' && <FaInstagram />}
                            {msg.cta.label}
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div
        ref={inputWrapperRef}
        className="
          flex-none
          px-2 sm:px-4 pt-2
          bg-white/80 backdrop-blur-sm
          lg:bg-transparent lg:backdrop-blur-0
        "
        // apenas o safe-area; em desktop vira 0px
        style={{ paddingBottom: safeBottom }}
      >
        {/* Alertas inline */}
        <AnimatePresence>
          {inlineAlert && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="mb-2 mx-auto max-w-[800px] flex items-center gap-2 text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-lg"
              role="alert"
              aria-live="polite"
            >
              <FaExclamationTriangle className="flex-shrink-0" />
              <span>{inlineAlert}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative mx-auto max-w-[800px] bg-gray-100 rounded-2xl p-2 shadow-2xl border border-gray-200/80">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsToolsOpen(true)}
              className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-gray-600 hover:bg-gray-300 transition-colors"
              aria-label="Abrir ferramentas"
            >
              <FaPlus />
            </button>

            {!instagramConnected ? (
              <button
                onClick={handleCorrectInstagramLink}
                className="flex-shrink-0 text-xs sm:text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded-lg transition-colors"
              >
                Conectar Instagram
              </button>
            ) : (
              <span
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-800 border border-green-300"
                title="Instagram conectado"
              >
                <FaCheckCircle className="w-3 h-3" />
                IG conectado {instagramUsername ? `• @${instagramUsername}` : ''}
              </span>
            )}
          </div>

          <div className="relative flex items-end mt-2">
            <textarea
              ref={textAreaRef}
              value={input}
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isSending) handleSend();
                }
              }}
              placeholder="Envie uma mensagem..."
              className="flex-1 resize-none bg-transparent py-2 pl-2 pr-10 border-0 ring-0 focus:ring-0 outline-none text-[15px] leading-6 placeholder-gray-500 text-gray-900 max-h-[25vh]"
              aria-label="Campo de mensagem"
              disabled={isSending}
            />
            <motion.button
              key="send"
              animate={{ scale: input.trim().length > 0 && !isSending ? 1 : 0.95, opacity: input.trim().length > 0 || isSending ? 1 : 0.5 }}
              transition={{ duration: 0.15 }}
              onClick={handleSend}
              className="absolute right-1 bottom-1 flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={!input.trim() || isSending}
              aria-label="Enviar mensagem"
            >
              {isSending ? <span className="text-sm leading-none">…</span> : <FaPaperPlane className="w-4 h-4" />}
            </motion.button>
          </div>
        </div>
      </div>
      {/* Voltar ao fim */}
      <AnimatePresence>
        {!isAtBottom && messages.length > 0 && (
          <motion.button
            key="back-to-end"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="absolute right-4 z-20 rounded-full px-3 py-2 text-xs sm:text-sm bg-gray-900 text-white shadow-lg hover:bg-gray-800"
            aria-label="Voltar ao fim da conversa"
            style={{ bottom: `calc(6rem + ${safeBottom})` }}
          >
            Voltar ao fim
          </motion.button>
        )}
      </AnimatePresence>

      {/* Respondendo... */}
      <AnimatePresence>
        {isSending && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute left-1/2 -translate-x-1/2 z-20 text-xs sm:text-sm bg-gray-900 text-white px-3 py-1.5 rounded-full shadow"
            style={{ bottom: `calc(6rem + ${safeBottom})` }}
            aria-live="polite"
          >
            Respondendo…
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drawer de ferramentas */}
      <AnimatePresence>
        {isToolsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsToolsOpen(false)}
              className="fixed inset-0 bg-black/40 z-50"
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="fixed bottom-0 left-0 right-0 bg-white p-4 pt-5 rounded-t-2xl shadow-2xl z-[60] border-t"
              style={{ paddingBottom: safeBottom }}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-gray-600 px-1">Ferramentas e Ações</h3>
                <button onClick={() => setIsToolsOpen(false)} className="p-1 rounded-full hover:bg-gray-100 text-gray-500"><FaTimes /></button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between w-full text-left p-3 bg-gray-100 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-4">
                    <FaInstagram className="text-pink-600 text-xl" />
                    <div>
                      <span className="text-sm font-medium text-gray-800">Análise Personalizada</span>
                      <p className="text-xs text-gray-500">Use suas métricas do Instagram.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleCorrectInstagramLink}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${instagramConnected ? 'bg-blue-600' : 'bg-gray-300'}`}
                    disabled={instagramConnected}
                    aria-label={instagramConnected ? "Instagram conectado" : "Conectar Instagram"}
                  >
                    <span aria-hidden="true" className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${instagramConnected ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {instagramConnected && (
                  <button
                    onClick={() => { router.push('/dashboard/media-kit'); setIsToolsOpen(false); }}
                    className="flex items-center gap-4 w-full text-left p-3 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 transition-colors"
                  >
                    <FaExternalLinkAlt className="text-gray-600 text-lg" />
                    <div>
                      <span className="text-sm font-medium text-gray-800">Acessar Mídia Kit</span>
                      <p className="text-xs text-gray-500">Ver e compartilhar seus dados.</p>
                    </div>
                  </button>
                )}

                {instagramConnected && isActiveLikePlan && (
                  <div className="p-3 bg-gray-100 rounded-lg border border-gray-200">
                    <WhatsAppConnectInline />
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
