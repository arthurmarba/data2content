/**
 * @fileoverview Página principal da Central de Inteligência.
 * Contém a interface de chat com layout e cores aprimorados para melhor legibilidade.
 * @version 3.0.0 - Refinamento completo da UI.
 */
'use client';

import React, { useState, useEffect, useRef, FC, Fragment } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// --- Tipos e Interfaces ---
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

type VisualizationType = 'kpi' | 'bar_chart' | 'list';

interface KpiData {
  value: string | number;
  unit?: string;
  change?: string;
  changeType?: 'positive' | 'negative';
}

interface BarChartData {
  name: string;
  value: number;
}

interface ListData {
  items: string[];
}

export interface Visualization {
  type: VisualizationType;
  title: string;
  data: KpiData | BarChartData[] | ListData;
}

// --- Componente de Renderização de Markdown ---
const SimpleMarkdown: FC<{ text: string }> = ({ text }) => {
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
};


// --- Componentes de UI ---
const VisualizationCard: FC<{ visualization: Visualization }> = ({ visualization }) => {
    const { type, title, data } = visualization;
    const renderContent = () => {
        switch (type) {
            case 'kpi':
                const kpiData = data as KpiData;
                return (
                    <div className="p-6 text-center">
                    <p className="text-5xl font-bold text-gray-900 dark:text-white">{kpiData.value}<span className="text-2xl font-medium text-gray-500 dark:text-gray-400 ml-1">{kpiData.unit}</span></p>
                    </div>
                );
            case 'bar_chart':
                const chartData = data as BarChartData[];
                return (
                    <div className="p-4 h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.1)" />
                            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: 'rgba(238, 242, 255, 0.5)' }} contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }} />
                            <Bar dataKey="value" name="Interações" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                        </BarChart>
                        </ResponsiveContainer>
                    </div>
                );
            case 'list':
                 const listData = data as ListData;
                 return (
                   <ul className="p-6 space-y-2">
                     {listData.items.map((item, index) => (
                       <li key={index} className="text-sm text-gray-600 dark:text-gray-300 flex items-start"><span className="text-indigo-600 mr-2 mt-1">&#9679;</span><span>{item}</span></li>
                     ))}
                   </ul>
                 );
            default: return null;
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <h3 className="text-md font-semibold text-gray-800 dark:text-white bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-b border-gray-200 dark:border-gray-700">{title}</h3>
        {renderContent()}
        </div>
    );
};


const MessageBubble: FC<{ message: Message }> = ({ message }) => {
    const isUser = message.role === 'user';
    return (
        <div className={`flex items-start gap-4 my-6`}>
            {!isUser && (
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-xl">
                    💡
                </div>
            )}
            <div className={`px-5 py-3 rounded-2xl max-w-lg ${isUser ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm'}`}>
                <SimpleMarkdown text={message.content} />
            </div>
             {isUser && (
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-xl">
                    🧑‍💻
                </div>
            )}
        </div>
    );
};

// --- Componente Principal da Página ---
const VISUALIZATION_DELIMITER = '---JSON_VISUALIZATIONS---';

export default function IntelligenceHubPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visualizations, setVisualizations] = useState<Visualization[]>([]);

  const formRef = useRef<HTMLFormElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    setError(null);
    setVisualizations([]);
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setInput('');

    try {
      const res = await fetch('/api/admin/intelligence-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      if (!res.ok || !res.body) throw new Error(`A API retornou um erro: ${res.statusText}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      const assistantId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullResponse += decoder.decode(value, { stream: true });
        const textPart = fullResponse.split(VISUALIZATION_DELIMITER)[0] ?? '';
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: textPart } : m));
      }

      const [textPart, jsonPart] = fullResponse.split(VISUALIZATION_DELIMITER);
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: (textPart ?? '').trim() } : m));
      
      if (jsonPart) {
        try {
          const parsedVisualizations: Visualization[] = JSON.parse(jsonPart);
          setVisualizations(parsedVisualizations);
        } catch (jsonError) {
          console.error("Erro ao parsear JSON de visualizações:", jsonError);
          setError("Falha ao renderizar os dados visuais da resposta.");
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <header className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Central de Inteligência</h1>
            <p className="text-md text-gray-600 dark:text-gray-400 mt-2">Faça uma pergunta sobre o mercado para obter análises e insights agregados.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-12">
          {/* Coluna da Conversa */}
          <div className="flex flex-col">
            <main className="flex-1">
                {messages.length === 0 && !isLoading && (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-16">
                      <div className="mx-auto bg-white dark:bg-slate-800 border dark:border-slate-700 w-16 h-16 rounded-full flex items-center justify-center text-3xl">💡</div>
                      <p className="text-lg mt-4 font-semibold text-gray-700 dark:text-gray-300">Bem-vindo, Administrador.</p>
                      <p className="text-sm mt-2">Você pode começar perguntando algo como:</p>
                      <p className="text-sm font-mono bg-gray-200 dark:bg-gray-800 rounded px-2 py-1 mt-3 inline-block">"Qual a performance de Reels educativos?"</p>
                    </div>
                )}
                <div className="space-y-8">
                    {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
                    {isLoading && messages[messages.length-1]?.role === 'user' && (
                        <MessageBubble message={{ id: 'loading', role: 'assistant', content: 'Analisando dados...' }} />
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </main>

            <footer className="pt-8 mt-auto">
                {error && <p className="text-center text-sm text-red-500 mb-2">{error}</p>}
                <form ref={formRef} onSubmit={handleSubmit}>
                <div className="relative">
                    <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Digite sua pergunta aqui..." rows={1}
                    className="w-full resize-none p-4 pr-28 border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white transition-shadow" disabled={isLoading} />
                    <button type="submit" disabled={isLoading || !input.trim()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed dark:focus:ring-offset-gray-800 transition-colors">
                    {isLoading ? 'Enviando...' : 'Enviar'}
                    </button>
                </div>
                </form>
            </footer>
          </div>

          {/* Coluna das Visualizações */}
          <aside className="mt-8 lg:mt-0">
            {visualizations.length > 0 && (
                <div className="space-y-6">
                    {visualizations.map((vis, index) => <VisualizationCard key={index} visualization={vis} />)}
                </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
