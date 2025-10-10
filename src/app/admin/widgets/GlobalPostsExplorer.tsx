'use client';

import Image from 'next/image';
import React, { useState, useEffect, useCallback } from 'react';
import { InboxIcon } from '@heroicons/react/24/outline';

// --- Componentes de Apoio (Definidos localmente) ---
const SkeletonBlock = ({ width = 'w-full', height = 'h-4', className = '' }: { width?: string; height?: string; className?: string; }) => (
  <div className={`${width} ${height} bg-gray-200 rounded-md animate-pulse ${className}`}></div>
);

const EmptyState = ({ icon, title, message }: { icon: React.ReactNode; title: string; message: string; }) => (
  <div className="text-center py-8">
    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100">{icon}</div>
    <h3 className="mt-2 text-sm font-semibold text-gray-900">{title}</h3>
    <p className="mt-1 text-sm text-gray-500">{message}</p>
  </div>
);


// --- Tipos e Interfaces ---
// MODIFICAÇÃO: Adicionada a propriedade opcional 'coverUrl'.
interface IGlobalPostResult {
  _id: string;
  description?: string;
  creatorName?: string;
  postDate?: string;
  coverUrl?: string; // <-- NOVO CAMPO
  stats?: {
    total_interactions?: number;
    likes?: number;
    shares?: number;
  };
}

interface GlobalPostsExplorerProps {
  dateRangeFilter?: {
    startDate: string;
    endDate: string;
  };
}

export default function GlobalPostsExplorer({ dateRangeFilter }: GlobalPostsExplorerProps) {
  const [posts, setPosts] = useState<IGlobalPostResult[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState({
    context: '',
    proposal: '',
    format: '',
    minInteractions: 0,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: name === 'minInteractions' ? parseInt(value, 10) || 0 : value,
    }));
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    const queryParams = new URLSearchParams({
      page: String(currentPage),
      limit: String(limit),
    });

    if (dateRangeFilter?.startDate) queryParams.append('startDate', dateRangeFilter.startDate);
    if (dateRangeFilter?.endDate) queryParams.append('endDate', dateRangeFilter.endDate);
    if (filters.context) queryParams.append('context', filters.context);
    if (filters.proposal) queryParams.append('proposal', filters.proposal);
    if (filters.format) queryParams.append('format', filters.format);
    if (filters.minInteractions > 0) queryParams.append('minInteractions', String(filters.minInteractions));

    try {
      // Simulação da chamada à API
      await new Promise(res => setTimeout(res, 1200));
      
      // Dados mock para demonstração
      const mockPosts: IGlobalPostResult[] = Array.from({ length: 7 }).map((_, i) => {
        const postId = `post_${currentPage}_${i}`;
        return {
          _id: postId,
          // MODIFICAÇÃO: Adicionada coverUrl aos dados mock.
          coverUrl: `https://picsum.photos/seed/${postId}/50/50`,
          description: `Este é um exemplo de post sobre ${filters.context || 'tópicos gerais'} no formato ${filters.format || 'qualquer'}. O conteúdo foca em ${filters.proposal || 'propostas diversas'}.`,
          creatorName: `Criador ${i + 1}`,
          postDate: new Date().toISOString(),
          stats: {
            total_interactions: Math.floor(Math.random() * 5000) + (filters.minInteractions || 0),
            likes: Math.floor(Math.random() * 3000),
            shares: Math.floor(Math.random() * 500),
          }
        }
      });
      
      setPosts(mockPosts);
      setTotalPosts(25); // Valor mock
      
    } catch (e: any) {
      setError(e.message || 'Falha ao buscar posts.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, limit, dateRangeFilter, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(totalPosts / limit);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Filtros */}
        <div>
          <label htmlFor="context" className="block text-sm font-medium text-gray-700">Contexto</label>
          <input type="text" name="context" id="context" value={filters.context} onChange={handleFilterChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Ex: Finanças"/>
        </div>
        <div>
          <label htmlFor="proposal" className="block text-sm font-medium text-gray-700">Proposta</label>
          <input type="text" name="proposal" id="proposal" value={filters.proposal} onChange={handleFilterChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Ex: Educativo"/>
        </div>
        <div>
          <label htmlFor="format" className="block text-sm font-medium text-gray-700">Formato</label>
          <input type="text" name="format" id="format" value={filters.format} onChange={handleFilterChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Ex: Reel"/>
        </div>
        <div>
          <label htmlFor="minInteractions" className="block text-sm font-medium text-gray-700">Mín. Interações</label>
          <input type="number" name="minInteractions" id="minInteractions" value={filters.minInteractions} onChange={handleFilterChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"/>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conteúdo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criador</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Interações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={`skel_post_${index}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                        <SkeletonBlock height="h-8" width="w-8" className="mr-3"/>
                        <SkeletonBlock height="h-3" width="w-full" />
                    </div>
                  </td>
                  <td className="px-6 py-4"><SkeletonBlock height="h-3" width="w-24" /></td>
                  <td className="px-6 py-4"><SkeletonBlock height="h-3" width="w-20" /></td>
                  <td className="px-6 py-4"><SkeletonBlock height="h-3" width="w-12" className="ml-auto" /></td>
                </tr>
              ))
            ) : error ? (
              <tr><td colSpan={4} className="text-center py-10 text-red-500">Erro: {error}</td></tr>
            ) : posts.length === 0 ? (
              <tr><td colSpan={4}><EmptyState icon={<InboxIcon className="w-12 h-12" />} title="Nenhum Post Encontrado" message="Tente ajustar os filtros para encontrar resultados." /></td></tr>
            ) : (
              posts.map(post => (
                <tr key={post._id}>
                  {/* MODIFICAÇÃO: Lógica para exibir a imagem da capa */}
                  <td className="px-6 py-4 max-w-sm">
                    <div className="flex items-center">
                      {post.coverUrl && (
                        <Image 
                          src={post.coverUrl} 
                          alt="Capa do post" 
                          width={32}
                          height={32}
                          className="h-8 w-8 object-cover rounded-md mr-3 flex-shrink-0" 
                        />
                      )}
                      <p className="text-sm text-gray-700 truncate" title={post.description}>
                        {post.description}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{post.creatorName}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(post.postDate!).toLocaleDateString('pt-BR')}</td>
                  <td className="px-6 py-4 text-sm text-gray-800 text-right font-medium">{post.stats?.total_interactions?.toLocaleString('pt-BR')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && totalPosts > 0 && (
          <div className="py-3 flex items-center justify-between border-t border-gray-200 mt-4">
            <p className="text-sm text-gray-700">Página {currentPage} de {totalPages} ({totalPosts} posts)</p>
            <div>
              <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="px-4 py-2 border border-gray-300 text-sm rounded-md hover:bg-gray-50 disabled:opacity-50">Anterior</button>
              <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} className="ml-3 px-4 py-2 border border-gray-300 text-sm rounded-md hover:bg-gray-50 disabled:opacity-50">Próxima</button>
            </div>
          </div>
        )}
    </div>
  );
};