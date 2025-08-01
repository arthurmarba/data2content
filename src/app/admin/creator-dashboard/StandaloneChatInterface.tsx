'use client';

import React, { useState, useEffect, useRef, FC, Fragment, useCallback } from 'react';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'; // For OpenAI message types
// Assuming BarChart related components are not directly used in the chat message/input part itself,
// but in VisualizationCard. If needed, they would be imported here or in VisualizationCard.
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';


// --- TYPES AND INTERFACES ---
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
  title:string;
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

interface StandaloneChatInterfaceProps {
  initialPrompt?: string;
}

// --- CONSTANTS ---
const DATA_DELIMITER = '---JSON_DATA_PAYLOAD---';
const STATUS_DELIMITER = '---STATUS_UPDATE---';

// --- HOOK: useIntelligenceChat ---
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
    let currentAssistantMessage = ''; // To build current message content

    setMessages(prev => {
        const lastMsg = prev[prev.length -1];
        if(lastMsg && lastMsg.id === assistantIdRef.current) {
            currentAssistantMessage = lastMsg.content;
        }
        return prev;
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      fullResponse = buffer; // Keep track of the absolute full response for parsing JSON later
      const dataDelimiterIndex = fullResponse.indexOf(DATA_DELIMITER);
      let textToProcess = dataDelimiterIndex === -1 ? buffer : buffer.substring(0, buffer.indexOf(DATA_DELIMITER));

      // Handle status updates within the text part
      const statusParts = textToProcess.split(STATUS_DELIMITER);
      const latestStatus = statusParts.length > 1 ? statusParts.pop()?.trim() : null;
      const mainTextChunk = statusParts.join('').trim(); // New text chunk since last read

      currentAssistantMessage += (currentAssistantMessage ? " " : "") + mainTextChunk; // Append new text

      const contentToShow = latestStatus ? `${currentAssistantMessage} ${latestStatus}...` : currentAssistantMessage;

      setMessages(prev =>
        prev.map(m =>
          m.id === assistantIdRef.current ? { ...m, content: contentToShow } : m
        )
      );
       // If we processed up to a delimiter, reset buffer for next part (text part)
      if (buffer.includes(STATUS_DELIMITER) || dataDelimiterIndex !== -1) {
          buffer = dataDelimiterIndex !== -1 ? fullResponse.substring(dataDelimiterIndex) : "";
          // if data delimiter is found, buffer will now contain the JSON part or start of it.
          // if only status delimiter, buffer is reset to empty for next text chunk.
      }
    }

    const [finalTextContent, jsonPart] = fullResponse.split(DATA_DELIMITER);
    setMessages(prev =>
      prev.map(m =>
        m.id === assistantIdRef.current ? { ...m, content: (finalTextContent || '').replace(/---STATUS_UPDATE---/g, '').trim() || ' ' } : m
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
    // Initialize assistant message with a placeholder or empty content
    const assistantMessage: Message = { id: newAssistantId, role: 'assistant', content: '' };

    const conversationHistory = [...messages, userMessage];
    setMessages([...conversationHistory, assistantMessage]);

    try {
      // NOTE: The API endpoint is hardcoded here. This might need to be configurable if used in different contexts.
      const res = await fetch('/api/admin/intelligence-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationHistory.map(m => ({role: m.role, content: m.content})) }), // Send only needed fields
      });

      if (!res.ok || !res.body) {
        throw new Error(`A API retornou um erro inesperado: ${res.status} ${res.statusText}`);
      }

      await processStream(res.body.getReader());

    } catch (err: any) {
      setError(err.message || "Ocorreu um erro desconhecido.");
      setMessages(prev => prev.filter(m => m.id !== assistantIdRef.current)); // Remove placeholder on error
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


// --- UI COMPONENTS ---

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
                            <Bar dataKey="value" name="Interações" fill={"#4f46e5"} radius={[4, 4, 0, 0]} />
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
                return <p>Tipo de visualização não suportado.</p>;
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden my-4">
            <h3 className="text-md font-semibold text-gray-800 dark:text-white bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-b border-gray-200 dark:border-gray-700">{title}</h3>
            {renderContent()}
        </div>
    );
});
VisualizationCard.displayName = 'VisualizationCard';

const MessageBubble: FC<{ message: Message }> = React.memo(({ message }) => {
    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';
    const showSkeleton = isAssistant && !message.content && message.id.startsWith('assistant-'); // Show skeleton for empty assistant message

    return (
        <div className={`flex items-start gap-3 my-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {isAssistant && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-lg shadow-sm">
                    💡
                </div>
            )}
            <div className={`px-4 py-2.5 rounded-xl max-w-lg ${isUser ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm'}`}>
                {showSkeleton ? <MessageSkeleton /> : <SimpleMarkdown text={message.content || " "} />}
            </div>
             {isUser && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-lg shadow-sm">
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
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${scrollHeight > 128 ? 128 : scrollHeight}px`; // Max height of 128px (8rem)
    }
  }, [input]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Faça uma pergunta..."
        rows={1}
        className="w-full resize-none p-3 pr-24 border-gray-300 rounded-lg shadow-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-150 text-sm"
        disabled={isLoading}
        style={{ maxHeight: '128px', minHeight: '44px' }}
      />
      <button type="button" onClick={onSendMessage} disabled={isLoading || !input.trim()}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed dark:focus:ring-offset-gray-800 transition-colors">
        {isLoading ? '...' : 'Enviar'}
      </button>
    </div>
  );
};

// --- MAIN CHAT INTERFACE COMPONENT ---
const StandaloneChatInterface: React.FC<StandaloneChatInterfaceProps> = ({ initialPrompt }) => {
  const { messages, isLoading, error, visualizations, suggestions, startConversation, askRadarEffectiveness } = useIntelligenceChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Inicia a conversa automaticamente se um prompt inicial for fornecido e não houver mensagens
    if (initialPrompt && messages.length === 0 && !isLoading) {
      startConversation(initialPrompt);
    }
    // A dependência de 'startConversation' garante que a função mais recente seja usada.
  }, [initialPrompt, messages.length, isLoading, startConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, suggestions, visualizations]); // Scroll on new content

  const handleSendMessage = () => {
    startConversation(input);
    setInput('');
  };

  const handleSuggestionClick = (question: string) => {
    startConversation(question); 
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-800">
      {/* Chat Messages Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-10">
            <div className="mx-auto bg-white dark:bg-gray-700 border dark:border-gray-600 w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-3">💡</div>
            <p className="text-md font-semibold text-gray-700 dark:text-gray-300">Como posso ajudar?</p>
            <p className="text-xs mt-1">Faça perguntas sobre criadores, conteúdo ou tendências.</p>
            <button
              onClick={() => askRadarEffectiveness()}
              className="mt-4 inline-flex items-center px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
            >
              Radar Mobi
            </button>
          </div>
        )}
        {messages.map((m) => <MessageBubble key={m.id} message={m} />)}

        {visualizations.length > 0 && !isLoading && (
          <div className="my-4 space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400">Visualizações:</h4>
            {visualizations.map((vis, index) => <VisualizationCard key={index} visualization={vis} />)}
          </div>
        )}

        {suggestions.length > 0 && !isLoading && (
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Sugestões:</h4>
                <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((q, i) => (
                        <button key={i} onClick={() => handleSuggestionClick(q)}
                        className="px-2.5 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full text-xs text-indigo-700 dark:text-indigo-300 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all">
                            {q}
                        </button>
                    ))}
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Chat Input Area */}
      <footer className="p-3 md:p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50">
        {error && <p className="text-center text-xs text-red-500 mb-1.5">{error}</p>}
        <ChatInput isLoading={isLoading} input={input} setInput={setInput} onSendMessage={handleSendMessage} />
      </footer>
    </div>
  );
}

export default StandaloneChatInterface;
