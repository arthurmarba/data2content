// src/app/dashboard/ChatPanel.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession, signIn } from "next-auth/react";
import {
  FaPaperPlane, FaInstagram, FaPlus, FaExternalLinkAlt,
  FaTimes, FaCheckCircle, FaExclamationTriangle
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

/** Botões de sugestão minimalistas (mesma largura) */
function PromptChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="
        w-full h-10
        inline-flex items-center justify-center
        rounded-lg border border-gray-200
        bg-gray-50 hover:bg-gray-100
        px-3 text-sm font-medium text-gray-800
        whitespace-nowrap overflow-hidden text-ellipsis
        transition-colors
      "
      title={label}
      aria-label={label}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

/* ---------- Renderização tipográfica “chat-like” ---------- */

function escapeHtml(s: string) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/** `**bold**`, `code` e links (sobre HTML escapado) */
function applyInlineMarkup(escaped: string) {
  let out = escaped;
  out = out.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-gray-100 text-gray-800">$1</code>');
  out = out.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
  out = out.replace(
    /(https?:\/\/[^\s)]+)(?![^<]*>)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="underline decoration-gray-300 hover:decoration-gray-500">$1</a>'
  );
  return out;
}

/** Tipografia compacta (14px / lh-6) com respiro reduzido */
function renderFormatted(text: string) {
  const blocks = text.trim().split(/\n{2,}/);
  const elements: JSX.Element[] = [];

  blocks.forEach((rawBlock, idx) => {
    const trimmed = rawBlock.trim();

    // HR
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
      elements.push(<hr key={`hr-${idx}`} className="my-4 border-t border-gray-200" />);
      return;
    }

    // Blockquote
    if (/^>\s+/.test(trimmed)) {
      const quote = trimmed.replace(/^>\s+/, "");
      const html = applyInlineMarkup(escapeHtml(quote));
      elements.push(
        <blockquote
          key={`bq-${idx}`}
          className="border-l-2 border-gray-200 pl-3 italic text-[14px] leading-6 text-gray-700 my-3"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
      return;
    }

    // Headings
    const h = trimmed.match(/^#{1,3}\s+(.*)$/);
    if (h) {
      const level = trimmed.match(/^#+/)?.[0].length ?? 1;
      const headingText = h[1] ?? "";
      const content = applyInlineMarkup(escapeHtml(headingText));
      if (level === 1) {
        elements.push(
          <h2 key={`h1-${idx}`} className="text-[16px] leading-6 font-semibold text-gray-900 mt-3 mb-1 tracking-tight"
              dangerouslySetInnerHTML={{ __html: content }} />
        );
      } else if (level === 2) {
        elements.push(
          <h3 key={`h2-${idx}`} className="text-[15px] leading-6 font-semibold text-gray-900 mt-3 mb-1 tracking-tight"
              dangerouslySetInnerHTML={{ __html: content }} />
        );
      } else {
        elements.push(
          <h4 key={`h3-${idx}`} className="text-[14px] leading-6 font-semibold text-gray-900 mt-2 mb-1 tracking-tight"
              dangerouslySetInnerHTML={{ __html: content }} />
        );
      }
      return;
    }

    // Listas / Tabelas
    const lines = trimmed.split(/\n/).map(l => l.trim()).filter(Boolean);

    // Tabela simples (markdown pipes com linha de separação ---)
    const isTable =
      lines.length >= 2 &&
      lines[0].includes("|") &&
      lines[1].includes("|") &&
      /---/.test(lines[1]);

    if (isTable) {
      const headers = lines[0].split("|").map(c => c.trim()).filter(Boolean);
      const rows = lines.slice(2).map(row => row.split("|").map(c => c.trim()).filter(Boolean));
      elements.push(
        <div key={`tbl-${idx}`} className="overflow-x-auto my-2">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr>
                {headers.map((h, i) => {
                  const html = applyInlineMarkup(escapeHtml(h));
                  return (
                    <th
                      key={i}
                      className="px-2 py-1 border-b font-semibold text-gray-800"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => {
                    const html = applyInlineMarkup(escapeHtml(cell));
                    return (
                      <td
                        key={cIdx}
                        className="px-2 py-1 border-b text-gray-700"
                        dangerouslySetInnerHTML={{ __html: html }}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      return;
    }

    const isBulleted = lines.length > 0 && lines.every(l => /^[-*]\s+/.test(l));
    const isNumbered = lines.length > 0 && lines.every(l => /^\d+\.\s+/.test(l));

    if (isBulleted) {
      const items = lines.map((l) => l.replace(/^[-*]\s+/, ""));
      elements.push(
        <ul key={`ul-${idx}`} className="list-disc ml-5 pl-1 space-y-1 text-[14px] leading-6 text-gray-800 my-2">
          {items.map((it, i) => {
            const html = applyInlineMarkup(escapeHtml(it));
            return <li key={i} dangerouslySetInnerHTML={{ __html: html }} />;
          })}
        </ul>
      );
      return;
    }

    if (isNumbered) {
      const items = lines.map((l) => l.replace(/^\d+\.\s+/, ""));
      elements.push(
        <ol key={`ol-${idx}`} className="list-decimal ml-5 pl-1 space-y-1 text-[14px] leading-6 text-gray-800 my-2">
          {items.map((it, i) => {
            const html = applyInlineMarkup(escapeHtml(it));
            return <li key={i} dangerouslySetInnerHTML={{ __html: html }} />;
          })}
        </ol>
      );
      return;
    }

    // Parágrafo
    const html = applyInlineMarkup(escapeHtml(trimmed)).replace(/\n/g, "<br/>");
    elements.push(
      <p
        key={`p-${idx}`}
        className="text-[14px] leading-6 text-gray-800 my-2"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  });

  // Wrapper enxuto (sem prose)
  return <div className="max-w-none">{elements}</div>;
}

/* ---------- Componente principal ---------- */

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

  // detectar “fim” — corrigido: early return + cleanup
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

  // mede a altura do composer em --composer-h
  useEffect(() => {
    const el = inputWrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty("--composer-h", `${el.offsetHeight}px`);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    { label: "narrativa que gera compartilhamentos", requiresIG: true },
    { label: "melhor dia/hora pra postar por formato", requiresIG: true },
    { label: "planejamento baseado em categorias", requiresIG: true },
  ];

  const safeBottom = 'env(safe-area-inset-bottom, 0px)';

  return (
    <div
      className="relative flex flex-col h-full w-full bg-white overflow-x-hidden"
      style={{ minHeight: 'calc(100svh - var(--header-h, 4rem))' }}
    >
      {/* timeline */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-hide overscroll-contain"
        style={{
          scrollPaddingTop: 'var(--header-h, 4rem)',
          scrollPaddingBottom: 'calc(var(--composer-h, 80px) + var(--sab, 0px))',
        }}
      >
        {isWelcome ? (
          // ESTADO VAZIO CENTRALIZADO ENTRE HEADER E COMPOSER
          <section
            className="grid place-items-center px-4"
            style={{
              height: 'calc(100svh - var(--header-h, 4rem) - var(--composer-h, 80px))',
            }}
          >
            <div className="w-full max-w-[680px] text-center">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
                <h1 className="text-4xl sm:text-5xl font-bold">
                  <span className="text-gray-800">Olá, </span>
                  <span className="text-blue-600">{firstName}</span>
                </h1>
                <p className="text-gray-500 mt-2">O que podemos criar hoje?</p>
              </motion.div>

              <motion.div
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
                className="w-full max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-8"
              >
                {welcomePrompts.map((p, i) => (
                  <motion.div key={i} variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
                    <PromptChip
                      label={p.label}
                      onClick={() => {
                        if (p.requiresIG && !instagramConnected) {
                          handleCorrectInstagramLink();
                        } else {
                          setInput(p.label);
                          setTimeout(handleSend, 0);
                        }
                      }}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>
        ) : (
          // FEED DE MENSAGENS (scrollbar oculta, rolagem preservada)
          <div className="mx-auto max-w-[680px] w-full px-4">
            <ul role="list" aria-live="polite" className="space-y-3">
              {messages.map((msg, idx) => {
                const isUser = msg.sender === 'user';
                return (
                  <li key={idx} className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {isUser ? (
                      <div className="max-w-[85%] px-3 py-2 rounded-2xl border border-gray-200 bg-white text-gray-900">
                        {renderFormatted(msg.text)}
                        {msg.cta && (
                          <div className="mt-3">
                            <button
                              className="inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                              onClick={() => {
                                if (msg.cta?.action === 'connect_instagram') return handleCorrectInstagramLink();
                                if (msg.cta?.action === 'go_to_billing') {
                                  if (onUpsellClick) return onUpsellClick();
                                  return router.push('/dashboard/billing');
                                }
                              }}
                            >
                              {msg.cta.label}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="max-w-[85%]">
                        {renderFormatted(msg.text)}
                        {msg.cta && (
                          <div className="mt-3">
                            <button
                              className="inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                              onClick={() => {
                                if (msg.cta?.action === 'connect_instagram') return handleCorrectInstagramLink();
                                if (msg.cta?.action === 'go_to_billing') {
                                  if (onUpsellClick) return onUpsellClick();
                                  return router.push('/dashboard/billing');
                                }
                              }}
                            >
                              {msg.cta.label}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}

              {/* “Respondendo…” inline */}
              <AnimatePresence>
                {isSending && (
                  <motion.li
                    key="respondendo-inline"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="w-full flex justify-start"
                  >
                    <div className="max-w-[85%] text-[13px] leading-5 text-gray-500 italic flex items-center gap-2">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-400 animate-pulse" />
                      Respondendo…
                    </div>
                  </motion.li>
                )}
              </AnimatePresence>
            </ul>
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer minimalista com “respiro” extra do rodapé */}
      <div
        ref={inputWrapperRef}
        className="flex-none px-2 sm:px-4 pt-2 bg-white"
        style={{ paddingBottom: `calc(${safeBottom} + 12px)` }}
      >
        <AnimatePresence>
          {inlineAlert && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="mb-2 mx-auto max-w-[680px] flex items-center gap-2 text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-lg"
              role="alert"
              aria-live="polite"
            >
              <FaExclamationTriangle className="flex-shrink-0" />
              <span>{inlineAlert}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative mx-auto max-w-[680px] bg-white rounded-xl p-2 border border-gray-150">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsToolsOpen(true)}
              className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Abrir ferramentas"
            >
              <FaPlus />
            </button>

            {!instagramConnected ? (
              <button
                onClick={handleCorrectInstagramLink}
                className="flex-shrink-0 text-xs sm:text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg transition-colors"
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
              placeholder="Envie uma mensagem…"
              className="flex-1 resize-none bg-white py-2 pl-2 pr-10 border-0 ring-0 focus:ring-0 outline-none text-[14px] leading-6 placeholder-gray-500 text-gray-900 max-h-[25vh]"
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
            style={{ bottom: 'calc(var(--composer-h, 80px) + var(--sab, 0px) + 8px)' }}
            aria-label="Voltar ao fim da conversa"
          >
            Voltar ao fim
          </motion.button>
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
              style={{ paddingBottom: `calc(${safeBottom} + 20px)` }}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-gray-600 px-1">Ferramentas e Ações</h3>
                <button onClick={() => setIsToolsOpen(false)} className="p-1 rounded-full hover:bg-gray-100 text-gray-500"><FaTimes /></button>
              </div>

              {/* Conteúdo rolável para evitar corte em telas pequenas/teclado aberto */}
              <div className="grid grid-cols-1 gap-3 max-h-[60svh] overflow-y-auto scrollbar-hide overscroll-contain">
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
