'use client';

import useSWR from 'swr';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function MonitoringPage() {
  const { data } = useSWR('/api/admin/monitoring/summary', fetcher, {
    refreshInterval: 30000,
  });
  const { data: planGuard } = useSWR(
    '/api/admin/plan-guard/metrics',
    fetcher,
    { refreshInterval: 30000 }
  );

  if (!data || !planGuard) {
    return <p>Carregando...</p>;
  }

  const creatorsData = [
    { type: 'Usuários', value: data.creators.users },
    { type: 'Convidados', value: data.creators.guests }
  ];

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Monitoramento & Observabilidade</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white shadow p-4 rounded">
          <p className="text-sm text-gray-500">Agências Ativas</p>
          <p className="text-2xl font-semibold">{data.activeAgencies}</p>
        </div>
        <div className="bg-white shadow p-4 rounded">
          <p className="text-sm text-gray-500">MRR Total</p>
          <p className="text-2xl font-semibold">
            R$ {data.mrr.total.toFixed(2)}
          </p>
        </div>
        <div className="bg-white shadow p-4 rounded">
          <p className="text-sm text-gray-500">Bloqueios de Plano</p>
          <p className="text-2xl font-semibold">{planGuard.blocked}</p>
        </div>
      </div>

      <div className="bg-white shadow p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Criadores</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={creatorsData}>
              <XAxis dataKey="type" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white shadow p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">MRR Segmentado</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2">Segmento</th>
              <th className="py-2">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-2">Criadores</td>
              <td className="py-2">R$ {data.mrr.creators.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="py-2">Agências</td>
              <td className="py-2">R$ {data.mrr.agencies.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
