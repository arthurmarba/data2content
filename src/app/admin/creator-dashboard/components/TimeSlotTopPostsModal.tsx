"use client";
import React, { useEffect, useState } from 'react';
import { getPortugueseWeekdayName } from '@/utils/weekdays';

interface TimeSlotTopPostsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayOfWeek: number;
  timeBlock: string;
  filters: { timePeriod: string; format?: string; proposal?: string; context?: string; metric: string };
  userId?: string;
}

interface PostItem {
  _id: string;
  description?: string;
  postLink?: string;
  coverUrl?: string;
  metricValue: number;
}

const TimeSlotTopPostsModal: React.FC<TimeSlotTopPostsModalProps> = ({ isOpen, onClose, dayOfWeek, timeBlock, filters, userId }) => {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const fetchPosts = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          dayOfWeek: String(dayOfWeek),
          timeBlock,
          timePeriod: filters.timePeriod,
          metric: filters.metric,
        });
        if (filters.format) params.append('format', filters.format);
        if (filters.proposal) params.append('proposal', filters.proposal);
        if (filters.context) params.append('context', filters.context);
        const base = userId
          ? `/api/v1/users/${userId}/performance/time-distribution/posts`
          : '/api/v1/platform/performance/time-distribution/posts';
        const res = await fetch(`${base}?${params.toString()}`);
        if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
        const json = await res.json();
        setPosts(json.posts || []);
      } catch (e: any) {
        setError(e.message || 'Erro ao carregar posts');
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, [isOpen, dayOfWeek, timeBlock, filters, userId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-lg shadow-lg relative p-4 space-y-3 max-h-[80vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500" aria-label="Fechar">x</button>
        <h4 className="text-sm font-semibold">
          Top Posts: {getPortugueseWeekdayName(dayOfWeek)} ({timeBlock}h)
        </h4>
        {loading && <p className="text-sm">Carregando...</p>}
        {error && <p className="text-sm text-red-600">Erro: {error}</p>}
        {!loading && !error && posts.length === 0 && <p className="text-sm">Nenhum post encontrado.</p>}
        {!loading && !error && posts.length > 0 && (
          <ul className="space-y-2 text-sm">
            {posts.map((p) => (
              <li key={p._id} className="border-b pb-1">
                {p.coverUrl && (
                  <img src={p.coverUrl} alt="capa" className="w-full h-32 object-cover rounded mb-1" />
                )}
                <a href={p.postLink} target="_blank" rel="noopener" className="font-medium text-indigo-600 hover:underline">
                  {p.description || p.postLink || 'Post'}
                </a>
                <div className="text-gray-600">{p.metricValue.toLocaleString('pt-BR')}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TimeSlotTopPostsModal;
