'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { toast } from 'react-hot-toast';

export default function AgencySignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', contactEmail: '', managerEmail: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/agency/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          contactEmail: form.contactEmail || undefined,
          managerEmail: form.managerEmail,
          managerPassword: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar parceiro');

      const result = await signIn('credentials', {
        redirect: false,
        email: form.managerEmail,
        password: form.password,
      });

      if (result?.error) {
        toast.error(result.error || 'Falha na autenticação');
      } else {
        router.push('/agency/subscription');
      }
    } catch (err: any) {
      toast.error(err.message || 'Falha ao registrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-bold">Cadastro de Parceiro</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input name="name" required placeholder="Nome do parceiro" value={form.name} onChange={handleChange} className="w-full border p-2" />
        <input name="contactEmail" type="email" placeholder="Email de contato" value={form.contactEmail} onChange={handleChange} className="w-full border p-2" />
        <input name="managerEmail" type="email" required placeholder="Email do gestor" value={form.managerEmail} onChange={handleChange} className="w-full border p-2" />
        <input name="password" type="password" required placeholder="Senha" value={form.password} onChange={handleChange} className="w-full border p-2" />
        <button type="submit" disabled={loading} className="px-4 py-2 bg-brand-pink text-white rounded disabled:opacity-50">
          {loading ? 'Enviando...' : 'Registrar'}
        </button>
      </form>
    </div>
  );
}
