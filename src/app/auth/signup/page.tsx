"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Aqui você normalmente chamaria uma API para registrar o usuário.
    // Para demonstração, simularemos o registro e em seguida o login automático.
    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
      name,
    });
    if (result?.error) {
      setError(result.error);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full p-8 border border-gray-200 rounded-lg shadow-sm">
        <h1 className="text-3xl font-bold text-center mb-6 font-sans">Cadastre-se</h1>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Seu nome"
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Seu email"
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Crie uma senha"
            />
          </div>
          <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded text-sm hover:bg-blue-600 transition">
            Criar Conta
          </button>
        </form>
        <p className="text-center text-gray-600 text-sm mt-4">
          Já tem uma conta?{" "}
          <a href="/auth/signin" className="text-blue-500 hover:underline">
            Entre
          </a>
        </p>
      </div>
    </div>
  );
}
