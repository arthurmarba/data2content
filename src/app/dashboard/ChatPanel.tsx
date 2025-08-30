// src/app/dashboard/ChatPanel.tsx

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession, signIn } from "next-auth/react";
import { FaPaperPlane, FaInstagram } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import WhatsAppConnectInline from './WhatsAppConnectInline';

// Definimos um tipo que inclui 'id'
interface SessionUserWithId {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

// Interface para cada mensagem do chat
interface Message {
  sender: "user" | "consultant";
  text: string;
  cta?: { label: string; action: 'connect_instagram' | 'go_to_billing' };
}

type PromptStatus = 'locked' | 'unlocked';

function SmartPromptCard({
  icon,
  text,
  status,
  onClick,
}: {
  icon: React.ReactNode;
  text: string;
  status: PromptStatus;
  onClick: () => void;
}) {
  const isLocked = status === 'locked';
  return (
    <button
      onClick={onClick}
      className={`group text-left rounded-xl border px-4 py-3 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 ${
        isLocked ? 'border-gray-300 hover:bg-gray-50 bg-white' : 'border-blue-200 hover:bg-blue-50 bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`text-xl ${isLocked ? 'opacity-80' : ''}`}>{icon}</div>
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">{text}</div>
          <div className="mt-1 text-xs text-gray-500">
            {isLocked ? 'Requer Instagram conectado' : 'Sugerido'}
          </div>
        </div>
      </div>
    </button>
  );
}

// Renderizador de Markdown simples
function renderFormatted(text: string) {
  const lines = text.split(/\r?\n/);
  const blocks: JSX.Element[] = [];
  
  lines.forEach((line, i) => {
    // Simplificado para o exemplo - uma implementação real teria um parser mais robusto
    if (/^\s*$/.test(line)) return;
    blocks.push(
      <p key={`p-${i}`} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
    );
  });

  return <div className="space-y-2 text-[15px] text-gray-800">{blocks}</div>;
}


export default function ChatPanel({ onUpsellClick }: { onUpsellClick?: () => void } = {}) {
  const { data: session } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    { sender: "consultant", text: "Olá! Em que posso te ajudar hoje?" },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const [inputHeight, setInputHeight] = useState(96); // Altura padrão inicial

  const userWithId = session?.user as SessionUserWithId | undefined;
  const instagramConnected = Boolean((session?.user as any)?.instagramConnected);
  const planStatus = String((session?.user as any)?.planStatus || '').toLowerCase();
  const isActiveLikePlan = ['active','trial','trialing','non_renewing'].includes(planStatus);

  // --- Media Kit banner state ---
  const [mkLoading, setMkLoading] = useState(false);
  const [, setMkError] = useState<string | null>(null);
  const [mkUrl, setMkUrl] = useState<string | null>(null);
  const mkAutogenRef = useRef(false);
  const [mkCollapsed, setMkCollapsed] = useState(true);
  const [mkHidden, setMkHidden] = useState(false);
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [avgReachPerPost, setAvgReachPerPost] = useState<number | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize do textarea
  useEffect(() => {
    const el = textAreaRef.current;
    if (!el) return;
    el.style.height = 'auto'; // Reseta a altura
    el.style.height = el.scrollHeight + 'px';
  }, [input]);

  // Observa a altura da barra de input para ajustar o padding do histórico
  useEffect(() => {
    const el = inputWrapperRef.current;
    if (!el) return;
    
    const observer = new ResizeObserver(() => {
      setInputHeight(el.offsetHeight);
    });
    
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || !userWithId?.id) return;

    const userText = input.trim();
    setMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setInput("");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query: userText }),
      });

      const data = await res.json();
      if (res.ok && data.answer) {
        setMessages((prev) => [
          ...prev,
          { sender: "consultant", text: data.answer, cta: data.cta },
        ]);
      } else {
        throw new Error(data.error || "Falha ao obter resposta.");
      }
    } catch (error) {
      console.error("Erro ao chamar /api/ai/chat:", error);
      setMessages((prev) => [
        ...prev,
        {
          sender: "consultant",
          text: "Ocorreu um erro ao gerar a resposta.",
        },
      ]);
    }
  };

  const isWelcome = messages.length <= 1;
  const fullName = (session?.user?.name || "").trim();
  const firstName = fullName ? fullName.split(" ")[0] : "você";
  const avatarUrl = (session?.user as any)?.image as string | undefined;
  // Init persisted UI prefs and existing MK link
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { setMkHidden(localStorage.getItem('d2c_hide_mk_banner') === '1'); } catch {}
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!instagramConnected) return;
      setMkLoading(true);
      setMkError(null);
      try {
        const res = await fetch('/api/users/media-kit-token', { cache: 'no-store' });
        const data = await res.json();
        if (!mounted) return;
        if (res.ok) setMkUrl(data.url ?? null);
      } catch (e: any) {
        if (!mounted) return;
        setMkError(e?.message || '');
      } finally {
        if (mounted) setMkLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [instagramConnected]);

  // Auto-generate MK link once after IG connect
  useEffect(() => {
    if (!instagramConnected) return;
    if (mkUrl) return;
    if (mkAutogenRef.current) return;
    mkAutogenRef.current = true;
    (async () => { try { await handleGenerateMkLink(); } catch {} })();
  }, [instagramConnected, mkUrl]);

  // Load basic metrics for banner
  useEffect(() => {
    const uid = (session?.user as any)?.id as string | undefined;
    if (!instagramConnected || !uid) return;
    let mounted = true;
    (async () => {
      try {
        const resFollowers = await fetch('/api/user/summary', { cache: 'no-store' });
        if (resFollowers.ok) {
          const data = await resFollowers.json();
          if (mounted) setFollowersCount(typeof data.followersCount === 'number' ? data.followersCount : null);
        }
      } catch {}
      try {
        const resKpi = await fetch(`/api/v1/users/${uid}/kpis/periodic-comparison?comparisonPeriod=last_30d_vs_previous_30d`, { cache: 'no-store' });
        if (resKpi.ok) {
          const data = await resKpi.json();
          const v = data?.avgReachPerPost?.currentValue;
          if (mounted) setAvgReachPerPost(typeof v === 'number' ? v : null);
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, [instagramConnected, session]);

  const hideMk = () => {
    setMkHidden(true);
    try { localStorage.setItem('d2c_hide_mk_banner', '1'); } catch {}
  };

  const handleGenerateMkLink = async () => {
    setMkLoading(true);
    setMkError(null);
    try {
      const res = await fetch('/api/users/media-kit-token', { method: 'POST' });
      const data = await res.json();
      if (res.ok) setMkUrl(data.url);
      else setMkError(data.error || 'Falha ao gerar link.');
    } catch (e: any) {
      setMkError(e?.message || 'Erro inesperado.');
    } finally {
      setMkLoading(false);
    }
  };

  const handleCopyMkLink = async () => {
    if (!mkUrl) return;
    try { await navigator.clipboard.writeText(mkUrl); } catch {}
  };

  const sendMessage = async (text: string) => {
    const prompt = text.trim();
    if (!prompt) return;
    if (!userWithId?.id) { alert('É necessário estar logado para usar o chat.'); return; }

    setMessages((prev) => [...prev, { sender: 'user', text: prompt }]);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query: prompt }),
      });
      const data = await res.json();
      if (res.ok && data.answer) {
        setMessages((prev) => [...prev, { sender: 'consultant', text: data.answer, cta: data.cta }]);
      } else {
        setMessages((prev) => [...prev, { sender: 'consultant', text: data.error || 'Não foi possível obter resposta.' }]);
      }
    } catch (e) {
      setMessages((prev) => [...prev, { sender: 'consultant', text: 'Ocorreu um erro ao gerar a resposta.' }]);
    }
  };

  return (
    // Container principal que serve de âncora para o posicionamento absoluto
    <div className="relative h-full w-full">
      
      {/* Área rolável do histórico de mensagens */}
      <div 
        className="absolute inset-0 overflow-y-auto custom-scrollbar pt-6" // Adicionado padding no topo
        style={{ paddingBottom: `${inputHeight + 16}px` }} // Padding dinâmico
      >
        {/* Wrapper para alinhar as mensagens na base (quando há poucas) e crescer para cima */}
        <div className="flex flex-col justify-end min-h-full">
          {isWelcome ? (
            instagramConnected ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-full px-4 py-6">
                  <div className="w-full max-w-[800px] mx-auto">
                    <div className="mb-3 text-center">
                      <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight text-blue-600">Olá, {firstName}</h2>
                      <p className="mt-1 text-base sm:text-lg text-gray-500">Sugestões rápidas para começar</p>
                    </div>

                    {/* heading removed per request */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      <SmartPromptCard
                        icon={<span>📅</span>}
                        text="Plano semanal com Proposta+Formato+Contexto+Tom+Referência"
                        status="unlocked"
                        onClick={() => sendMessage('Usando minhas métricas reais do Instagram, monte um plano semanal combinando Proposta, Formato, Contexto, Tom e Referência por dia e horário, priorizando as combinações com melhor retenção e engajamento.')}
                      />
                      <SmartPromptCard
                        icon={<span>⏰</span>}
                        text="Qual dia e hora de postagem gera mais curtidas?"
                        status="unlocked"
                        onClick={() => sendMessage('Com base nos meus dados do Instagram, quais são o dia e a hora que mais geram curtidas nos próximos 7 dias? Traga as 3 melhores janelas por formato (Reel 18–22s, Carrossel 5–7) priorizando curtidas, e inclua a justificativa rápida.')}
                      />
                      <SmartPromptCard
                        icon={<span>💬</span>}
                        text="Propostas e Toms que elevam comentários/salvamentos"
                        status="unlocked"
                        onClick={() => sendMessage('Com base nos últimos 30 dias, quais combinações de Proposta e Tom mais aumentam comentários e salvamentos para mim? Traga exemplos de posts e horários.')}
                      />
                      <SmartPromptCard
                        icon={<span>🔎</span>}
                        text="Quais das minhas narrativas não engajam?"
                        status="unlocked"
                        onClick={() => sendMessage('Com base no meu histórico de desempenho, quais narrativas (Proposta/Contexto/Tom) estão com engajamento e retenção abaixo da média? Liste 3–5 apostas a pausar, cite horários/janelas fracas e sugira alternativas.')}
                      />
                    </div>

                    {null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-full px-4 py-6">
                  <div className="w-full max-w-[800px] mx-auto">
                    <div className="mb-3">
                      <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight text-blue-600">Olá, {firstName}</h2>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Faça uma pergunta</h3>

                    {/* heading removed per request */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      <SmartPromptCard
                        icon={<span>📅</span>}
                        text="Plano semanal com Proposta+Formato+Contexto+Tom+Referência"
                        status="locked"
                        onClick={() => signIn('facebook', { callbackUrl: '/dashboard/chat?instagramLinked=true' })}
                      />
                      <SmartPromptCard
                        icon={<span>⏰</span>}
                        text="Qual dia e hora de postagem gera mais curtidas?"
                        status="locked"
                        onClick={() => signIn('facebook', { callbackUrl: '/dashboard/chat?instagramLinked=true' })}
                      />
                      <SmartPromptCard
                        icon={<span>💬</span>}
                        text="Propostas e Toms que elevam comentários/salvamentos"
                        status="locked"
                        onClick={() => signIn('facebook', { callbackUrl: '/dashboard/chat?instagramLinked=true' })}
                      />
                      <SmartPromptCard
                        icon={<span>🔎</span>}
                        text="Quais das minhas narrativas não engajam?"
                        status="locked"
                        onClick={() => signIn('facebook', { callbackUrl: '/dashboard/chat?instagramLinked=true' })}
                      />
                    </div>

                    {null}
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="mx-auto max-w-[800px] w-full space-y-5 px-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`w-full flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-4 py-2.5 ${msg.sender === 'user' ? 'shadow-sm border border-gray-300 bg-gray-100 text-gray-900' : 'bg-transparent text-gray-800'}`}>
                    {renderFormatted(msg.text)}
                    {msg.cta && (
                      <div className="mt-4">
                        <button
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-200 transition-colors"
                          onClick={() => {
                            if (msg.cta?.action === 'connect_instagram') {
                              return signIn('facebook', { callbackUrl: '/dashboard/chat?instagramLinked=true' });
                            }
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
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Barra de input com posicionamento absoluto, fixada na base */}
      <div 
        ref={inputWrapperRef}
        className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-2 bg-white/85 backdrop-blur-sm"
      >
        {instagramConnected && !mkHidden && (
          <div className="mx-auto max-w-[800px] w-full mb-2">
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs sm:text-sm">
              <div className="text-gray-700 flex items-center gap-2 min-w-0">
                <span className="truncate">Mídia Kit pronto para compartilhar</span>
                {(followersCount !== null || avgReachPerPost !== null) && !mkCollapsed && (
                  <span className="hidden sm:inline-flex items-center gap-2 text-[11px] text-gray-500">
                    {typeof followersCount === 'number' && (
                      <span>Seguidores: <strong>{followersCount.toLocaleString('pt-BR')}</strong></span>
                    )}
                    {typeof avgReachPerPost === 'number' && (
                      <span>• Alcance/post: <strong>{avgReachPerPost.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })}</strong></span>
                    )}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <button
                  onClick={() => setMkCollapsed(v => !v)}
                  className="px-2 py-1 rounded-md border border-gray-200 text-[11px] sm:text-xs text-gray-700 hover:bg-gray-50"
                  aria-label={mkCollapsed ? 'Mostrar detalhes' : 'Ocultar detalhes'}
                >{mkCollapsed ? 'Detalhes' : 'Ocultar'}</button>
                {mkUrl ? (
                  <>
                    <a href={mkUrl} target="_blank" rel="noopener noreferrer" className="px-2 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs bg-gray-900 text-white font-semibold">Abrir</a>
                    <button
                      className="px-2 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs bg-gray-100 border border-gray-300 text-gray-800"
                      onClick={handleCopyMkLink}
                    >Copiar</button>
                  </>
                ) : (
                  <button
                    disabled={mkLoading}
                    onClick={handleGenerateMkLink}
                    className="px-2 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-semibold text-white bg-pink-600 hover:bg-pink-700 disabled:opacity-50"
                  >{mkLoading ? 'Gerando…' : 'Gerar Link'}</button>
                )}
                <button
                  onClick={hideMk}
                  className="ml-1 px-2 py-1 rounded-md text-gray-400 hover:text-gray-600"
                  aria-label="Fechar banner do Mídia Kit"
                  title="Fechar"
                >×</button>
              </div>
            </div>
          </div>
        )}
        {instagramConnected && isActiveLikePlan && (
          <div className="mx-auto max-w-[800px] w-full mb-2">
            <WhatsAppConnectInline />
          </div>
        )}
        {!instagramConnected && (
          <div className="mx-auto max-w-[800px] w-full mb-2">
            <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 text-blue-900 px-3 py-2">
              <div className="text-xs sm:text-sm flex items-center gap-2">
                <span aria-hidden>✨</span>
                Conecte seu Instagram para respostas personalizadas e Mídia Kit gratuito.
              </div>
              <button
                onClick={() => signIn('facebook', { callbackUrl: '/dashboard/chat?instagramLinked=true' })}
                className="ml-3 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md"
              >
                Conectar agora
              </button>
            </div>
          </div>
        )}
        <div className="relative mx-auto max-w-[800px] flex items-end gap-2.5 border border-gray-300 rounded-2xl px-3.5 py-2.5 bg-white shadow-md focus-within:border-gray-400">
          <div className="shrink-0 self-end mb-0.5">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Você" className="w-10 h-10 rounded-full object-cover border border-gray-300" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-200 border border-gray-300" aria-hidden />
            )}
          </div>
          <textarea
            ref={textAreaRef}
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Insira um comando ou faça uma pergunta...`}
            className="flex-1 resize-none overflow-y-auto bg-transparent border-0 ring-0 focus:ring-0 outline-none text-[15px] leading-6 placeholder-gray-500 text-gray-900 max-h-[40vh] pl-2"
          />
          <AnimatePresence>
            {input.trim().length > 0 && (
              <motion.button
                key="send"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                onClick={handleSend}
                className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-pink-600 text-white hover:bg-pink-700"
              >
                <FaPaperPlane className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
