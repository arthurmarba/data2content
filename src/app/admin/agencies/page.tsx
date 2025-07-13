'use client';
import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import AdminAuthGuard from '../components/AdminAuthGuard';

interface Agency {
  _id: string;
  name: string;
  inviteCode: string;
  planStatus?: string;
}

export default function AdminAgenciesPage() {
  const { data: session } = useSession();
  const [agencies, setAgencies] = useState<Agency[]>([]);

  useEffect(() => {
    fetch('/api/admin/agencies').then(res => res.json()).then(data => setAgencies(data.agencies));
  }, []);

  return (
    <AdminAuthGuard>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Gerenciar Agências</h1>
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Convite</th>
            </tr>
          </thead>
          <tbody>
            {agencies.map(a => (
              <tr key={a._id} className="border-t">
                <td className="px-3 py-2">{a.name}</td>
                <td className="px-3 py-2">{a.planStatus}</td>
                <td className="px-3 py-2 text-sm">{`${typeof window !== 'undefined' ? window.location.origin : ''}/assinar?codigo_agencia=${a.inviteCode}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminAuthGuard>
  );
}
