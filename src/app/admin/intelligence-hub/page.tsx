/**
 * @fileoverview Página principal da Central de Inteligência, refatorada para máxima robustez e manutenibilidade.
 * @version 12.1.0
 * @description
 * ## Principais Melhorias na Versão 12.1.0:
 * - **Correção de Erro:** Corrigido um erro de tipo onde `finalText` poderia ser `undefined` durante o processamento do stream.
 * * ## Melhorias Anteriores:
 * - **Hook Customizado (`useIntelligenceChat`):** Lógica de chat abstraída para um hook.
 * - **Segurança de Tipos Aprimorada:** Uso de Uniões Discriminadas para `Visualization`.
 * - **Componentização e Performance:** Componentes otimizados com `React.memo`.
 * - **UX Melhorada:** Introdução de `Skeleton Loaders` para feedback de carregamento.
 */
'use client';

import React, { useState, useEffect, useRef, FC, Fragment, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ============================================================================
// --- SEÇÃO DE TIPOS E INTERFACES (Idealmente em: /types/intelligence.ts) ---
// ============================================================================

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface KpiVisualization {
  type: 'kpi';
  title: string;
  data: {
    value: string | number;
    unit?: string;
  };
}

interface BarChartVisualization {
  type: 'bar_chart';
  title: string;
  data: {
    name: string;
    value: number;
    handle?: string;
    exactValue?: number;
  }[];
}

interface ListVisualization {
  type: 'list';
  title: string;
  data: {
    items: string[];
  };
}

type Visualization = KpiVisualization | BarChartVisualization | ListVisualization;

interface FinalPayload {
  visualizations: Visualization[];
  suggestions: string[];
}

// ============================================================================
// --- CONSTANTES (Idealmente em: /constants/intelligence.ts) ---
// ============================================================================

const DATA_DELIMITER = '---JSON_DATA_PAYLOAD---';
const STATUS_DELIMITER = '---STATUS_UPDATE---';

// ============================================================================
// --- HOOK CUSTOMIZADO (Idealmente em: /hooks/useIntelligenceChat.ts) ---
// ============================================================================

const useIntelligenceChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visualizations, setVisualizations] = useState<Visualization[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const assistantIdRef = useRef<string | null>(null);

  const processStream = useCallback(async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    const decoder = new TextDecoder();
    let fullResponse = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      fullResponse = buffer;
      const dataDelimiterIndex = fullResponse.indexOf(DATA_DELIMITER);

      let currentText = dataDelimiterIndex === -1 ? fullResponse : fullResponse.substring(0, dataDelimiterIndex);
      
      const statusParts = currentText.split(STATUS_DELIMITER);
      const latestStatus = statusParts.length > 1 ? statusParts.pop()?.trim() : null;

      const mainText = statusParts.join('').trim();
      
      const contentToShow = latestStatus ? `${mainText} ${latestStatus}...` : mainText;

      setMessages(prev =>
        prev.map(m =>
          m.id === assistantIdRef.current ? { ...m, content: contentToShow } : m
        )
      );
    }
    
    // Limpeza final após o fim do stream
    const [finalText, jsonPart] = fullResponse.split(DATA_DELIMITER);

    // CORREÇÃO: Garante que 'finalText' não seja 'undefined' antes de usar métodos de string.
    setMessages(prev =>
      prev.map(m =>
        m.id === assistantIdRef.current ? { ...m, content: (finalText || '').replace(/---STATUS_UPDATE---/g, '').trim() || ' ' } : m
      )
    );

    if (jsonPart) {
      try {
        const payload: FinalPayload = JSON.parse(jsonPart);
        setVisualizations(payload.visualizations || []);
        setSuggestions(payload.suggestions || []);
      } catch (jsonError) {
        console.error("JSON parsing error:", jsonError);
        setError("Falha ao processar os dados da resposta.");
      }
    }
  }, []);

  const startConversation = useCallback(async (userMessageContent: string) => {
    if (!userMessageContent.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setVisualizations([]);
    setSuggestions([]);

    const userMessage: Message = { id: `user-${Date.now()}`, role: 'user', content: userMessageContent };
    const newAssistantId = `assistant-${Date.now()}`;
    assistantIdRef.current = newAssistantId;
    const assistantMessage: Message = { id: newAssistantId, role: 'assistant', content: '' }; 
    
    const conversationHistory = [...messages, userMessage];
    setMessages([...conversationHistory, assistantMessage]);

    try {
      const res = await fetch('/api/admin/intelligence-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationHistory }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`A API retornou um erro inesperado: ${res.status} ${res.statusText}`);
      }
      
      await processStream(res.body.getReader());

    } catch (err: any) {
      setError(err.message || "Ocorreu um erro desconhecido.");
      setMessages(prev => prev.filter(m => m.id !== assistantIdRef.current));
    } finally {
      setIsLoading(false);
      assistantIdRef.current = null;
    }
  }, [isLoading, messages, processStream]);

  const askRadarEffectiveness = useCallback(
    (alertType?: string, periodDays: number = 30) => {
      const query = alertType
        ? `Qual a eficácia do Radar Mobi para alertas do tipo '${alertType}' nos últimos ${periodDays} dias?`
        : `Qual a eficácia do Radar Mobi nos últimos ${periodDays} dias?`;
      startConversation(query);
    },
    [startConversation]
  );

  return { messages, isLoading, error, visualizations, suggestions, startConversation, askRadarEffectiveness, setMessages };
};

// ============================================================================
// --- COMPONENTES DE UI (Idealmente em: /components/*) ---
// ============================================================================

const SimpleMarkdown: FC<{ text: string }> = React.memo(({ text }) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <p className="text-sm whitespace-pre-wrap leading-relaxed text-gray-700 dark:text-gray-200">
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} className="font-semibold text-gray-900 dark:text-white">{part.slice(2, -2)}</strong>;
        }
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </p>
  );
});
SimpleMarkdown.displayName = 'SimpleMarkdown';

const CustomTooltip: FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg">
        <p className="font-bold text-gray-900 dark:text-white">{label}</p>
        {data.handle && <p className="text-sm text-indigo-500 dark:text-indigo-400">@{data.handle}</p>}
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
          <span className="font-semibold">Valor:</span> {(data.exactValue ?? data.value).toLocaleString('pt-BR')}
        </p>
      </div>
    );
  }
  return null;
};

const MessageSkeleton: FC = () => (
  <div className="flex items-center space-x-2">
    <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></div>
    <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse [animation-delay:0.2s]"></div>
    <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse [animation-delay:0.4s]"></div>
  </div>
);

const VisualizationCard: FC<{ visualization: Visualization }> = React.memo(({ visualization }) => {
    const { type, title, data } = visualization;
    const renderContent = () => {
        switch (type) {
            case 'kpi': return (
                <div className="p-6 text-center">
                    <p className="text-5xl font-bold text-gray-900 dark:text-white">{data.value}
                        {data.unit && <span className="text-2xl font-medium text-gray-500 dark:text-gray-400 ml-1">{data.unit}</span>}
                    </p>
                </div>
            );
            case 'bar_chart': return (
                <div className="p-4 h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.1)" />
                            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(value as number)} />
                            <Tooltip cursor={{ fill: 'rgba(79, 70, 229, 0.1)' }} content={<CustomTooltip />} />
                            <Bar dataKey="value" name="Interações" fill="var(--color-indigo-600)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );
            case 'list': return (
               <ul className="p-6 space-y-2">
                 {data.items.map((item, index) => (
                   <li key={index} className="text-sm text-gray-600 dark:text-gray-300 flex items-start">
                     <span className="text-indigo-500 mr-3 mt-1">&#9679;</span>
                     <span>{item}</span>
                   </li>
                 ))}
               </ul>
            );
            default:
                const exhaustiveCheck: never = type;
                return exhaustiveCheck;
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in">
            <h3 className="text-md font-semibold text-gray-800 dark:text-white bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-b border-gray-200 dark:border-gray-700">{title}</h3>
            {renderContent()}
        </div>
    );
});
VisualizationCard.displayName = 'VisualizationCard';

const MessageBubble: FC<{ message: Message }> = React.memo(({ message }) => {
    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';
    const showSkeleton = isAssistant && !message.content;

    return (
        <div className={`flex items-start gap-4 my-6 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            {isAssistant && (
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-xl shadow-sm">
                    💡
                </div>
            )}
            <div className={`px-5 py-3 rounded-2xl max-w-2xl ${isUser ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm'}`}>
                {showSkeleton ? <MessageSkeleton /> : <SimpleMarkdown text={message.content} />}
            </div>
             {isUser && (
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-xl shadow-sm">
                    🧑‍💻
                </div>
            )}
        </div>
    );
});
MessageBubble.displayName = 'MessageBubble';

const ChatInput: FC<{
  isLoading: boolean;
  input: string;
  setInput: (value: string) => void;
  onSendMessage: () => void;
}> = ({ isLoading, input, setInput, onSendMessage }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [input]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Faça uma pergunta sobre o mercado..."
        rows={1}
        className="w-full resize-none p-4 pr-28 border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white transition-all duration-200"
        disabled={isLoading}
      />
      <button type="button" onClick={onSendMessage} disabled={isLoading || !input.trim()}
        className="absolute right-3 top-1/2 -translate-y-1/2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed dark:focus:ring-offset-gray-800 transition-colors">
        {isLoading ? 'Analisando...' : 'Enviar'}
      </button>
    </div>
  );
};

// ============================================================================
// --- COMPONENTE PRINCIPAL DA PÁGINA ---
// ============================================================================

export default function IntelligenceHubPage() {
  const { messages, isLoading, error, visualizations, suggestions, startConversation, askRadarEffectiveness } = useIntelligenceChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, suggestions, visualizations]);

  const handleSendMessage = () => {
    startConversation(input);
    setInput('');
  };

  const handleSuggestionClick = (question: string) => {
    startConversation(question);
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen" style={{'--color-indigo-600': '#4f46e5'} as React.CSSProperties}>
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Central de Inteligência</h1>
          <p className="text-md text-gray-600 dark:text-gray-400 mt-2">Pergunte, analise e obtenha insights estratégicos sobre o seu mercado.</p>
          <button
            onClick={() => askRadarEffectiveness()}
            className="mt-4 inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Ver eficácia do Radar
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-12">
          {/* Coluna da Conversa */}
          <div className="flex flex-col h-full">
            <main className="flex-1 space-y-8">
              {messages.length === 0 && !isLoading && (
                <div className="text-center text-gray-500 dark:text-gray-400 py-16">
                  <div className="mx-auto bg-white dark:bg-slate-800 border dark:border-slate-700 w-16 h-16 rounded-full flex items-center justify-center text-3xl">💡</div>
                  <p className="text-lg mt-4 font-semibold text-gray-700 dark:text-gray-300">Bem-vindo, Administrador.</p>
                  <p className="text-sm mt-2">Comece com uma pergunta como:</p>
                  <p className="text-sm font-mono bg-gray-200 dark:bg-gray-800 rounded px-2 py-1 mt-3 inline-block">"Ranking de criadores por engajamento no último mês"</p>
                </div>
              )}
              {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
            
              {suggestions.length > 0 && !isLoading && (
                  <div className="mt-8 animate-fade-in">
                      <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">Sugestões de análise:</h4>
                      <div className="flex flex-wrap gap-2">
                          {suggestions.map((q, i) => (
                              <button key={i} onClick={() => handleSuggestionClick(q)}
                              className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full text-sm text-indigo-700 dark:text-indigo-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all">
                                  {q}
                              </button>
                          ))}
                      </div>
                  </div>
              )}
              <div ref={messagesEndRef} />
            </main>

            <footer className="pt-8 mt-auto sticky bottom-0 bg-slate-50 dark:bg-slate-900 pb-4">
              {error && <p className="text-center text-sm text-red-500 mb-2">{error}</p>}
              <ChatInput isLoading={isLoading} input={input} setInput={setInput} onSendMessage={handleSendMessage} />
            </footer>
          </div>

          {/* Coluna das Visualizações */}
          <aside className="mt-8 lg:mt-0">
            {visualizations.length > 0 && (
                <div className="space-y-6 sticky top-8">
                    {visualizations.map((vis, index) => <VisualizationCard key={index} visualization={vis} />)}
                </div>
            )}
             {isLoading && messages.length > 0 && visualizations.length === 0 && (
                <div className="space-y-6 sticky top-8">
                    <div className="bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 h-48 animate-pulse">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
                        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </div>
                </div>
             )}
          </aside>
        </div>
      </div>
    </div>
  );
}
