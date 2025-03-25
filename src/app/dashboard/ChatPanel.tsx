"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

// Definimos um tipo que inclui 'id' (além de name, email, image, etc. se necessário)
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
}

export default function ChatPanel() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([
    { sender: "consultant", text: "Olá, como posso ajudar com suas métricas?" },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fazemos o cast para garantir que TypeScript reconheça 'id'
  const userWithId = session?.user as SessionUserWithId | undefined;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    // Verifica se há userId
    if (!userWithId?.id) {
      alert("É necessário estar logado para usar o chat.");
      return;
    }

    const userText = input.trim();

    // Adiciona a mensagem do usuário localmente
    setMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setInput("");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Envia cookies de sessão
        body: JSON.stringify({
          userId: userWithId.id, // ID do usuário logado
          query: userText,
        }),
      });

      // Se a resposta não for ok, trata status code
      if (!res.ok) {
        if (res.status === 401) {
          // Não autenticado
          setMessages((prev) => [
            ...prev,
            {
              sender: "consultant",
              text: "Não autenticado. Faça login novamente.",
            },
          ]);
        } else if (res.status === 403) {
          // Plano inativo ou acesso negado
          setMessages((prev) => [
            ...prev,
            {
              sender: "consultant",
              text: "Acesso negado ou plano inativo.",
            },
          ]);
        } else {
          // Outros códigos de erro
          const data = await res.json();
          setMessages((prev) => [
            ...prev,
            {
              sender: "consultant",
              text: data.error || "Não foi possível obter resposta.",
            },
          ]);
        }
        return; // Importante para não processar o resto
      }

      // Se a resposta for OK, tenta parsear
      const data = await res.json();
      if (data.answer) {
        setMessages((prev) => [
          ...prev,
          { sender: "consultant", text: data.answer },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            sender: "consultant",
            text: data.error || "Não foi possível obter resposta.",
          },
        ]);
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 scrollbar-hide">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`text-xs ${
              msg.sender === "user" ? "text-right" : "text-left"
            }`}
          >
            <div
              className={`inline-block px-3 py-2 rounded-xl mb-1 ${
                msg.sender === "user"
                  ? "bg-blue-50 text-blue-800"
                  : "bg-gray-50 text-gray-800"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="mt-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Digite sua pergunta..."
          className="
            w-full
            px-3
            py-2
            text-sm
            placeholder-gray-400
            border
            border-gray-300
            rounded-xl
            focus:outline-none
            focus:border-blue-400
          "
        />
      </div>
    </div>
  );
}
