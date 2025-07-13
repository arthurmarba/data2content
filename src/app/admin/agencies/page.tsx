'use client';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import AdminAuthGuard from '../components/AdminAuthGuard';
import ModalConfirm from '../components/ModalConfirm';

interface Agency {
  _id: string;
  name: string;
  inviteCode: string;
  planStatus?: string;
  contactEmail?: string;
  managerEmail?: string;
}

export default function AdminAgenciesPage() {
  const { data: session } = useSession();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [agencyToDelete, setAgencyToDelete] = useState<Agency | null>(null);
  const [form, setForm] = useState({
    name: '',
    contactEmail: '',
    managerEmail: '',
    managerPassword: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/admin/agencies').then(res => res.json()).then(data => setAgencies(data.agencies));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleDelete = async () => {
    if (!agencyToDelete) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/agencies?id=${agencyToDelete._id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao excluir agência');
      }
      setAgencies(prev => prev.filter(a => a._id !== agencyToDelete._id));
      toast.success('Agência excluída com sucesso');
      setIsDeleteModalOpen(false);
      setAgencyToDelete(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir agência');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const url = editingId ? `/api/admin/agencies?id=${editingId}` : '/api/admin/agencies';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar agência');
      if (editingId) {
        setAgencies(prev => prev.map(a => a._id === editingId ? { ...a, ...form } : a));
        toast.success('Agência atualizada com sucesso');
      } else {
        setAgencies(prev => [...prev, data.agency]);
        toast.success('Agência criada com sucesso');
      }
      setIsModalOpen(false);
      setEditingId(null);
      setForm({ name: '', contactEmail: '', managerEmail: '', managerPassword: '' });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar agência');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminAuthGuard>
      <div className="space-y-4">
        <ModalConfirm
          isOpen={isDeleteModalOpen}
          onClose={() => { if (!isSubmitting) { setIsDeleteModalOpen(false); setAgencyToDelete(null); } }}
          onConfirm={handleDelete}
          title="Confirmar Exclusão"
          message={`Você tem certeza que deseja excluir a agência ${agencyToDelete?.name}? Todos os criadores vinculados perderão o vínculo e o acesso do gestor será removido. Esta ação não pode ser desfeita.`}
          confirmButtonText={isSubmitting ? 'Excluindo...' : 'Confirmar Exclusão'}
          isConfirming={isSubmitting}
        />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Gerenciar Agências</h1>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-red rounded hover:bg-red-700"
          >
            Adicionar Nova Agência
          </button>
        </div>
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Convite</th>
              <th className="px-3 py-2 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {agencies.map(a => (
              <tr key={a._id} className="border-t">
                <td className="px-3 py-2">{a.name}</td>
                <td className="px-3 py-2">{a.planStatus}</td>
                <td className="px-3 py-2 text-sm">{`${typeof window !== 'undefined' ? window.location.origin : ''}/assinar?codigo_agencia=${a.inviteCode}`}</td>
                <td className="px-3 py-2 space-x-2">
                  <button onClick={() => {
                    setEditingId(a._id);
                    setForm({ name: a.name, contactEmail: a.contactEmail || '', managerEmail: a.managerEmail || '', managerPassword: '' });
                    setIsModalOpen(true);
                  }} className="text-blue-600 hover:text-blue-800">
                    Editar
                  </button>
                  <button onClick={() => { setAgencyToDelete(a); setIsDeleteModalOpen(true); }} className="text-red-600 hover:text-red-800">
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white w-full max-w-md rounded-lg p-6 space-y-4">
              <h2 className="text-lg font-semibold">{editingId ? 'Editar Agência' : 'Nova Agência'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="name">Nome da Agência</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={form.name}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="contactEmail">Email de Contato</label>
                  <input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    value={form.contactEmail}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="managerEmail">Email do Gestor</label>
                  <input
                    id="managerEmail"
                    name="managerEmail"
                    type="email"
                    required={!editingId}
                    disabled={!!editingId}
                    value={form.managerEmail}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="managerPassword">Senha do Gestor</label>
                  <input
                    id="managerPassword"
                    name="managerPassword"
                    type="password"
                    placeholder={editingId ? 'Deixe em branco para não alterar' : ''}
                    required={!editingId}
                    value={form.managerPassword}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => { setIsModalOpen(false); setEditingId(null); }}
                    className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-brand-red rounded hover:bg-red-700 disabled:opacity-60"
                  >
                    {isSubmitting ? 'Enviando...' : editingId ? 'Salvar Alterações' : 'Criar Agência'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminAuthGuard>
  );
}
