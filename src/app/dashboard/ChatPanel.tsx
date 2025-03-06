"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!session?.user?.id) {
      alert("É necessário estar logado para usar o chat.");
      return;
    }

    const userText = input.trim();

    setMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setInput("");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          query: userText,
        }),
      });
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
