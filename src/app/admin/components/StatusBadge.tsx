// src/app/admin/components/StatusBadge.tsx
'use client'; // Se usar ícones como componentes React diretamente

import React from 'react';
import { AdminCreatorStatus } from '@/types/admin/creators'; // Ajuste o caminho se necessário
import {
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  NoSymbolIcon, // Para status desconhecido ou não mapeado
  InformationCircleIcon, // Para 'active' se diferente de 'approved'
} from '@heroicons/react/24/solid'; // Usando solid para badges, pode ser outline

interface StatusConfig {
  label: string;
  Icon: React.ElementType;
  badgeColorClass: string; // ex: 'bg-green-100 text-green-700'
}

// Mapeamento de AdminCreatorStatus para configuração de display
const statusDisplayConfig: Record<AdminCreatorStatus, StatusConfig> = {
  approved: {
    label: 'Aprovado',
    Icon: CheckCircleIcon,
    badgeColorClass: 'bg-green-100 text-green-700 dark:bg-green-700/30 dark:text-green-300',
  },
  active: { // 'active' pode ter um significado diferente de 'approved' em alguns contextos
    label: 'Ativo',
    Icon: CheckCircleIcon, // Ou InformationCircleIcon se quiser diferenciar
    badgeColorClass: 'bg-blue-100 text-blue-700 dark:bg-blue-700/30 dark:text-blue-300',
  },
  pending: {
    label: 'Pendente',
    Icon: ClockIcon,
    badgeColorClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-700/30 dark:text-yellow-300',
  },
  rejected: {
    label: 'Rejeitado',
    Icon: XCircleIcon,
    badgeColorClass: 'bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300',
  },
};

const unknownStatusConfig: StatusConfig = {
  label: 'Desconhecido',
  Icon: NoSymbolIcon,
  badgeColorClass: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

interface StatusBadgeProps {
  status: AdminCreatorStatus | string; // Permite string para flexibilidade, mas tentará mapear de AdminCreatorStatus
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusDisplayConfig[status as AdminCreatorStatus] || unknownStatusConfig;
  const { Icon, label, badgeColorClass } = config;

  const paddingClasses = size === 'sm' ? 'px-2.5 py-0.5' : 'px-3 py-1';
  const textSizeClasses = size === 'sm' ? 'text-xs' : 'text-sm';
  const iconSizeClasses = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <span
      className={`inline-flex items-center ${paddingClasses} ${textSizeClasses} font-semibold leading-5 rounded-full ${badgeColorClass}`}
    >
      <Icon className={`${iconSizeClasses} mr-1.5 -ml-0.5`} />
      {label}
    </span>
  );
}
